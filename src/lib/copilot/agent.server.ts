// Мозг помощника «Ember»: диалог с моделью, вызов инструментов, сборка плана на утверждение.
import { buildCopilotPersona } from "@/lib/copilot/persona";
import { isToolName, toolMeta, toolSchemas } from "@/lib/copilot/registry";
import { allowedTools, assertOpsWithinLimits, assertToolAllowed, getCopilotSettings } from "@/lib/copilot/guard.server";
import { runTool } from "@/lib/copilot/tools.server";
import { meaningfulOps, summarizeOps } from "@/lib/copilot/diff";
import { addMessage, createRun, listMessages, renameSessionFromFirstMessage } from "@/lib/copilot/store.server";
import { maxRisk, type CopilotContext, type CopilotOp, type CopilotSource, type CopilotStep } from "@/lib/copilot/types";
import { admin } from "@/lib/copilot/guard.server";
import { sharedMemoryPrompt } from "@/lib/botkit/memory.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";
const MAX_STEPS = 8;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface CopilotReply {
  text: string;
  runId: string | null;
  sources: CopilotSource[];
  steps: CopilotStep[];
  ops: CopilotOp[];
}

export class CopilotGatewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "CopilotGatewayError";
  }
}

async function callModel(messages: ChatMessage[], tools: unknown[]): Promise<ChatMessage> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new CopilotGatewayError(401, "ИИ-шлюз не настроен: отсутствует ключ.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new CopilotGatewayError(429, "Слишком много запросов к ИИ. Попробуйте через минуту.");
    if (res.status === 402) throw new CopilotGatewayError(402, "Закончились кредиты ИИ. Пополните баланс в настройках Lovable.");
    throw new CopilotGatewayError(res.status, `ИИ вернул ошибку ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: ChatMessage }[] };
  return json.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

/** Один ход диалога: модель читает данные, готовит изменения и отвечает человеку. */
export async function copilotTurn(input: {
  userId: string;
  sessionId: string;
  text: string;
  context: CopilotContext | null;
}): Promise<CopilotReply> {
  const settings = await getCopilotSettings();
  const tools = allowedTools(settings);
  const db = await admin();
  const memory = await sharedMemoryPrompt(db as never, "assistant").catch(() => "");

  const history = await listMessages(input.sessionId, 20);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildCopilotPersona({
        now: new Date(),
        context: input.context,
        memory,
        allowedTools: tools,
        allowWebSearch: settings.allow_web_search,
        maxRows: settings.max_rows_per_run,
        allowDestructive: settings.allow_destructive,
      }),
    },
    ...history
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: input.text },
  ];

  await addMessage({ sessionId: input.sessionId, role: "user", content: input.text });
  await renameSessionFromFirstMessage(input.sessionId, input.text);

  const ops: CopilotOp[] = [];
  const steps: CopilotStep[] = [];
  const sources: CopilotSource[] = [];
  const schemas = toolSchemas(tools);
  let final = "";

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const reply = await callModel(messages, schemas);
    const calls = reply.tool_calls ?? [];
    if (!calls.length) {
      final = (reply.content ?? "").trim();
      break;
    }
    messages.push({ role: "assistant", content: reply.content ?? "", tool_calls: calls });

    for (const call of calls) {
      const name = call.function.name;
      let payload: string;
      try {
        if (!isToolName(name)) throw new Error(`Неизвестный инструмент ${name}`);
        assertToolAllowed(name, settings);
        const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        const result = await runTool(name, args, settings);
        const meta = toolMeta(name)!;
        if (result.kind === "ops") {
          const real = meaningfulOps(result.ops);
          assertOpsWithinLimits([...ops, ...real], settings);
          ops.push(...real);
          steps.push({ tool: name, title: meta.title, module: meta.module, risk: meta.risk, count: real.length, note: result.note });
          payload = JSON.stringify({
            prepared: true,
            affected: real.length,
            preview: real.slice(0, 10).map((o) => ({ id: o.id, label: o.label, op: o.op })),
            note: "Изменения подготовлены как превью и ждут утверждения человеком.",
          });
        } else {
          if (result.sources?.length) sources.push(...result.sources);
          payload = JSON.stringify(result.data).slice(0, 12000);
        }
      } catch (e) {
        payload = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: payload });
    }
  }

  if (!final) final = ops.length ? "Подготовил изменения — посмотрите превью и утвердите." : "Не удалось сформировать ответ, уточните запрос.";

  let runId: string | null = null;
  if (ops.length) {
    const run = await createRun({
      sessionId: input.sessionId,
      userId: input.userId,
      title: steps[0]?.title ?? "План изменений",
      summary: summarizeOps(ops),
      request: input.text,
      risk: maxRisk(steps),
      steps,
      preview: ops,
      sources,
    });
    runId = run.id;
  }

  await addMessage({ sessionId: input.sessionId, role: "assistant", content: final, sources, runId });
  return { text: final, runId, sources, steps, ops };
}
