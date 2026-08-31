// «Мозг» ассистента: модель с вызовом инструментов вместо жёстких регулярок.
// Понимает свободную речь, помнит диалог и знает, что уже выучила о пользователе.
import type { AssistantPrefs, CalDirection, CalItem } from "@/lib/calendar/model";
import { AiBlockedError } from "@/lib/calendar/parse.server";
import { isToolName, runTool, toolSchemas, type ToolCtx, type ToolResult } from "@/lib/calendar/tools.server";
import { listMemory, memoryPrompt } from "@/lib/calendar/memory.server";
import { appendDialog, focusFromDialog, loadDialog } from "@/lib/calendar/dialog.server";
import { buildPersona } from "@/lib/calendar/persona";
import { toTgHtml } from "@/lib/calendar/tg-format";

type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";
const MAX_STEPS = 6;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface BrainResult {
  /** Готовые блоки для отправки: текст + кнопки к конкретной записи. */
  blocks: Array<{ text: string; item?: CalItem }>;
  /** Плоский текст для голоса/лога. */
  text: string;
  items: CalItem[];
  focusItemId: string | null;
  usedTools: string[];
}

function systemPrompt(opts: {
  prefs: AssistantPrefs;
  dirs: CalDirection[];
  memory: string;
  now: Date;
  focusItemId: string | null;
  focusTitle: string | null;
}): string {
  return [
    buildPersona({
      prefs: opts.prefs,
      dirs: opts.dirs,
      now: opts.now,
      channel: "telegram",
      memory: opts.memory,
      focusTitle: opts.focusTitle,
    }),
    opts.focusItemId ? `id записи в фокусе: ${opts.focusItemId}` : "",
    "«Отмени» / «верни как было» — undo_last.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function chat(messages: ChatMessage[], tools: unknown[]): Promise<ChatMessage> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AiBlockedError("LOVABLE_API_KEY не настроен", 401);
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[planner-brain] ${res.status}: ${body.slice(0, 400)}`);
    if (res.status === 402 || res.status === 403 || res.status === 429) {
      throw new AiBlockedError(body.slice(0, 300) || `AI недоступен (${res.status})`, res.status);
    }
    throw new Error(`AI ${res.status}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: ChatMessage }> };
  return json.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

/**
 * Полный проход: реплика → инструменты → готовые блоки ответа.
 * Ничего не отправляет в каналы — это делает вызывающая сторона.
 */
export async function runBrain(
  db: Db,
  input: { text: string; chatKey: string; channel: string; prefs: AssistantPrefs; dirs: CalDirection[]; now?: Date },
): Promise<BrainResult> {
  const now = input.now ?? new Date();
  const [memory, history] = await Promise.all([listMemory(db), loadDialog(db, input.chatKey)]);
  const focusItemId = focusFromDialog(history);
  const focusTitle =
    focusItemId
      ? ((await db.from("calendar_items").select("title").eq("id", focusItemId).maybeSingle()).data as { title?: string } | null)?.title ?? null
      : null;

  const ctx: ToolCtx = { db, prefs: input.prefs, dirs: input.dirs, now, chatKey: input.chatKey, focusItemId };
  const tools = toolSchemas(input.dirs.map((d) => d.key));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt({ prefs: input.prefs, dirs: input.dirs, memory: memoryPrompt(memory), now, focusItemId, focusTitle }) },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: input.text },
  ];

  const blocks: BrainResult["blocks"] = [];
  const items: CalItem[] = [];
  const usedTools: string[] = [];
  let nextFocus = focusItemId;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const msg = await chat(messages, tools);
    messages.push(msg);
    const calls = msg.tool_calls ?? [];
    if (!calls.length) {
      const finalText = (msg.content ?? "").trim();
      if (finalText) blocks.push({ text: toTgHtml(finalText) });
      break;
    }

    for (const call of calls) {
      const name = call.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      let result: ToolResult;
      if (!isToolName(name)) {
        result = { text: "Неизвестное действие.", items: [] };
      } else {
        try {
          result = await runTool({ ...ctx, focusItemId: nextFocus }, name, args);
        } catch (e) {
          console.error(`[planner-brain] tool ${name} failed`, e);
          result = { text: "Не получилось выполнить действие, попробуйте иначе.", items: [] };
        }
        usedTools.push(name);
      }
      if (result.focusItemId !== undefined) nextFocus = result.focusItemId;
      items.push(...result.items);
      // Списковые ответы отдаём как есть; карточки — с кнопками к записи.
      if (result.items.length === 1 && ["create_item", "update_item", "reschedule_item", "set_status", "add_note", "undo_last"].includes(name)) {
        blocks.push({ text: result.text, item: result.items[0] as CalItem });
      } else {
        blocks.push({ text: result.text });
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true, summary: result.text.replace(/<[^>]+>/g, "").slice(0, 900), count: result.items.length }),
      });
    }
  }

  const text = blocks.map((b) => b.text).join("\n\n");
  await appendDialog(db, { chatKey: input.chatKey, channel: input.channel, role: "user", content: input.text });
  await appendDialog(db, {
    chatKey: input.chatKey,
    channel: input.channel,
    role: "assistant",
    content: text.replace(/<[^>]+>/g, "").slice(0, 1500),
    focusItemId: nextFocus,
  });

  return { blocks, text, items, focusItemId: nextFocus, usedTools };
}
