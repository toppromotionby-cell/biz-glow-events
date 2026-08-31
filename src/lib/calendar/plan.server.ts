// Режим «сначала план»: ассистент собирает контекст, при явной просьбе смотрит в интернет,
// предлагает единый план и НИЧЕГО не меняет до утверждения владельцем.
import type { AssistantPrefs, CalDirection, CalItem } from "@/lib/calendar/model";
import { fmtWhen, isOverdue } from "@/lib/calendar/model";
import { AiBlockedError } from "@/lib/calendar/parse.server";
import { isToolName, runTool, type ToolCtx, type ToolName } from "@/lib/calendar/tools.server";
import { getDirections, getPrefs, listItemsBetween, listOpenTail } from "@/lib/calendar/store.server";
import { listMemory, memoryPrompt } from "@/lib/calendar/memory.server";
import { esc } from "@/lib/calendar/render";
import { buildPersona, PLAN_MODE_RULES } from "@/lib/calendar/persona";
import { portalsBlock } from "@/lib/calendar/ai-portals";
import { researchBlock, wantsWeb, webSearch, type ResearchHit } from "@/lib/calendar/research.server";

type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

/** Что ассистенту разрешено предлагать в плане. Только это и ничего сверх. */
export const PLAN_TOOLS: ToolName[] = [
  "create_item",
  "update_item",
  "reschedule_item",
  "set_status",
  "delete_item",
  "add_note",
  "split_task",
  "remember",
];

export interface PlanStep {
  label: string;
  tool: ToolName;
  args: Record<string, unknown>;
}

export type PlanStatus = "pending" | "editing" | "approved" | "rejected" | "expired" | "failed";

export interface PlanRow {
  id: string;
  chat_key: string | null;
  status: PlanStatus;
  title: string;
  summary: string | null;
  request: string | null;
  steps: PlanStep[];
  research: ResearchHit[];
  questions: string[];
  result: string | null;
  tg_chat_id: number | null;
  tg_message_id: number | null;
  reminded_at: string | null;
  decided_at: string | null;
  expires_at: string;
  created_at: string;
}

function rowToPlan(r: Record<string, unknown>): PlanRow {
  return {
    ...(r as unknown as PlanRow),
    steps: Array.isArray(r.steps) ? (r.steps as PlanStep[]) : [],
    research: Array.isArray(r.research) ? (r.research as ResearchHit[]) : [],
    questions: Array.isArray(r.questions) ? (r.questions as string[]) : [],
  };
}

// ——— Контекст (только чтение) ———

function itemsBlock(items: CalItem[], dirs: CalDirection[], tz: string, limit = 40): string {
  if (!items.length) return "(пусто)";
  return items
    .slice(0, limit)
    .map((i) => {
      const d = dirs.find((x) => x.id === i.direction_id);
      return `- [${i.id}] ${i.kind === "meeting" ? "встреча" : "задача"} «${i.title}» · ${fmtWhen(i, tz)} · ${d?.title ?? "без направления"} · P${i.priority}${isOverdue(i) ? " · просрочено" : ""}`;
    })
    .join("\n");
}

async function gatherContext(db: Db, prefs: AssistantPrefs, dirs: CalDirection[], now: Date): Promise<string> {
  const to = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const [upcoming, tail, memory] = await Promise.all([
    listItemsBetween(db, now.toISOString(), to),
    listOpenTail(db, now.toISOString()),
    listMemory(db),
  ]);
  return [
    "Ближайшие 14 дней:",
    itemsBlock(upcoming, dirs, prefs.tz),
    "",
    "Незакрытые хвосты:",
    itemsBlock(tail, dirs, prefs.tz, 20),
    "",
    memoryPrompt(memory),
  ].join("\n");
}

// ——— Генерация плана ———

const SCHEMA_HINT = `Ответь ТОЛЬКО json-объектом:
{
  "title": "короткий заголовок плана",
  "summary": "2-4 строки: что предлагаешь и почему",
  "questions": ["уточняющий вопрос, если чего-то не хватает"],
  "steps": [
    { "label": "человеческое описание шага", "tool": "create_item", "args": { "title": "...", "starts_at": "ISO8601 с офсетом" } }
  ]
}`;

async function askModel(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AiBlockedError("LOVABLE_API_KEY не настроен", 401);
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[planner-plan] ${res.status}: ${body.slice(0, 300)}`);
    if ([402, 403, 429].includes(res.status)) throw new AiBlockedError(body.slice(0, 300) || `AI недоступен (${res.status})`, res.status);
    throw new Error(`AI ${res.status}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "{}";
}

function parsePlan(raw: string): { title: string; summary: string; questions: string[]; steps: PlanStep[] } {
  let obj: Record<string, unknown> = {};
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    obj = {};
  }
  const steps: PlanStep[] = Array.isArray(obj.steps)
    ? (obj.steps as Array<Record<string, unknown>>)
        .map((s) => ({
          label: typeof s.label === "string" ? s.label : "",
          tool: String(s.tool ?? "") as ToolName,
          args: (s.args && typeof s.args === "object" ? s.args : {}) as Record<string, unknown>,
        }))
        .filter((s) => isToolName(s.tool) && PLAN_TOOLS.includes(s.tool))
        .slice(0, 15)
    : [];
  return {
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "План",
    summary: typeof obj.summary === "string" ? obj.summary.trim() : "",
    questions: Array.isArray(obj.questions) ? (obj.questions as unknown[]).filter((q): q is string => typeof q === "string").slice(0, 3) : [],
    steps,
  };
}

export interface BuildPlanInput {
  request: string;
  chatKey: string;
  chatId?: number | null;
  prefs?: AssistantPrefs;
  dirs?: CalDirection[];
  /** Правки предыдущего плана. */
  previous?: PlanRow | null;
  now?: Date;
}

/** Собирает план и сохраняет его в статусе pending. Ничего не меняет в календаре. */
export async function buildPlan(db: Db, input: BuildPlanInput): Promise<PlanRow> {
  const now = input.now ?? new Date();
  const prefs = input.prefs ?? (await getPrefs(db));
  const dirs = input.dirs ?? (await getDirections(db));

  const research = wantsWeb(input.request) ? await webSearch(input.request, 5) : [];
  const context = await gatherContext(db, prefs, dirs, now);

  const system = [
    buildPersona({ prefs, dirs, now, channel: "telegram" }),
    "",
    "РЕЖИМ ПЛАНА. Ты сейчас НЕ исполнитель, а аналитик:",
    ...PLAN_MODE_RULES.map((r) => `- ${r}`),
    "",
    `Разрешённые шаги (tool): ${PLAN_TOOLS.join(", ")}. Другие инструменты запрещены.`,
    "",
    "Внешние AI-сервисы, которые можно советовать в summary (без автоматических действий):",
    portalsBlock(),
    "",
    SCHEMA_HINT,
  ].join("\n");

  const user = [
    `Запрос владельца: ${input.request}`,
    input.previous ? `\nПредыдущий план «${input.previous.title}» владелец попросил переделать. Шаги были:\n${input.previous.steps.map((s) => `- ${s.label}`).join("\n")}` : "",
    "",
    "Текущий контекст календаря:",
    context,
    research.length ? `\nНайдено в интернете (по явной просьбе):\n${researchBlock(research)}` : "\nВнешний поиск не запрашивался — опирайся только на календарь и память.",
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = parsePlan(await askModel(system, user));

  if (input.previous) {
    await db
      .from("assistant_plans")
      .update({ status: "rejected", result: "Заменён новой версией", decided_at: now.toISOString() })
      .eq("id", input.previous.id);
  }

  const { data, error } = await db
    .from("assistant_plans")
    .insert({
      chat_key: input.chatKey,
      status: "pending",
      title: parsed.title,
      summary: parsed.summary,
      request: input.request,
      steps: parsed.steps as never,
      research: research as never,
      questions: parsed.questions as never,
      tg_chat_id: input.chatId ?? null,
      expires_at: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToPlan(data as Record<string, unknown>);
}

// ——— Отображение ———

export function renderPlan(plan: PlanRow): string {
  const steps = plan.steps.length
    ? plan.steps.map((s, i) => `${i + 1}. ${esc(s.label || s.tool)}`).join("\n")
    : "— конкретных изменений не предлагаю, нужно уточнение.";
  const parts = [
    `🧠 <b>${esc(plan.title)}</b>`,
    plan.summary ? esc(plan.summary) : "",
    "",
    "<b>Что предлагаю сделать:</b>",
    steps,
  ];
  if (plan.research.length) {
    parts.push("", "<b>Источники:</b>", plan.research.map((h) => `• <a href="${esc(h.url)}">${esc(h.title)}</a>`).join("\n"));
  }
  if (plan.questions.length) {
    parts.push("", "<b>Уточните:</b>", plan.questions.map((q) => `• ${esc(q)}`).join("\n"));
  }
  parts.push("", "<i>Ничего не меняю до вашего «Утвердить».</i>");
  return parts.filter((p) => p !== "").join("\n");
}

export function planButtons(plan: PlanRow) {
  return [
    [
      { text: "✅ Утвердить", data: `plan:ok:${plan.id}` },
      { text: "✏️ Переделать", data: `plan:edit:${plan.id}` },
    ],
    [{ text: "🚫 Отменить", data: `plan:no:${plan.id}` }],
  ];
}

// ——— Хранилище ———

export async function getPlan(db: Db, id: string): Promise<PlanRow | null> {
  const { data } = await db.from("assistant_plans").select("*").eq("id", id).maybeSingle();
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

export async function listPlans(db: Db, limit = 20): Promise<PlanRow[]> {
  const { data } = await db.from("assistant_plans").select("*").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map(rowToPlan);
}

export async function attachPlanMessage(db: Db, id: string, chatId: number, messageId: number): Promise<void> {
  await db.from("assistant_plans").update({ tg_chat_id: chatId, tg_message_id: messageId }).eq("id", id);
}

/** Плана ждут правки: ждём следующего сообщения владельца с уточнением. */
export async function markPlanEditing(db: Db, id: string): Promise<void> {
  await db.from("assistant_plans").update({ status: "editing", result: "Ждёт правок владельца" }).eq("id", id);
}

/** План, по которому владелец обещал прислать правки. */
export async function editingPlan(db: Db, chatKey: string): Promise<PlanRow | null> {
  const { data } = await db
    .from("assistant_plans")
    .select("*")
    .eq("chat_key", chatKey)
    .eq("status", "editing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

export async function rejectPlan(db: Db, id: string): Promise<void> {
  await db
    .from("assistant_plans")
    .update({ status: "rejected", result: "Отклонён владельцем", decided_at: new Date().toISOString() })
    .eq("id", id);
}

/** Последний план, ожидающий решения, в этом чате. */
export async function pendingPlan(db: Db, chatKey: string): Promise<PlanRow | null> {
  const { data } = await db
    .from("assistant_plans")
    .select("*")
    .eq("chat_key", chatKey)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

// ——— Исполнение ———

export interface ApplyResult {
  ok: number;
  failed: number;
  items: CalItem[];
  text: string;
}

/** Выполняет шаги утверждённого плана. Вызывать только после явного согласия. */
export async function approvePlan(db: Db, id: string, opts?: { prefs?: AssistantPrefs; dirs?: CalDirection[] }): Promise<ApplyResult> {
  const plan = await getPlan(db, id);
  if (!plan) return { ok: 0, failed: 0, items: [], text: "План не найден." };
  if (plan.status !== "pending") return { ok: 0, failed: 0, items: [], text: "Этот план уже обработан." };

  const prefs = opts?.prefs ?? (await getPrefs(db));
  const dirs = opts?.dirs ?? (await getDirections(db));
  const ctx: ToolCtx = {
    db,
    prefs,
    dirs,
    now: new Date(),
    chatKey: plan.chat_key ?? "plan",
    focusItemId: null,
  };

  const items: CalItem[] = [];
  const lines: string[] = [];
  let ok = 0;
  let failed = 0;
  for (const step of plan.steps) {
    if (!isToolName(step.tool) || !PLAN_TOOLS.includes(step.tool)) {
      failed += 1;
      lines.push(`⚠️ ${esc(step.label)} — шаг не разрешён`);
      continue;
    }
    try {
      const res = await runTool(ctx, step.tool, step.args);
      items.push(...res.items);
      if (res.focusItemId !== undefined) ctx.focusItemId = res.focusItemId;
      ok += 1;
      lines.push(`✅ ${esc(step.label || step.tool)}`);
    } catch (e) {
      failed += 1;
      console.error("[planner-plan] step failed", step.tool, e);
      lines.push(`⚠️ ${esc(step.label || step.tool)} — не выполнено`);
    }
  }

  const text = [`✅ <b>План выполнен:</b> ${esc(plan.title)}`, ...lines].join("\n");
  await db
    .from("assistant_plans")
    .update({
      status: failed && !ok ? "failed" : "approved",
      decided_at: new Date().toISOString(),
      result: `Выполнено ${ok}, ошибок ${failed}`,
    })
    .eq("id", id);

  return { ok, failed, items, text };
}

// ——— Обслуживание (тик) ———

export interface PlanTickResult {
  reminded: PlanRow[];
  expired: number;
}

/** Напоминание через 3 часа и автоистечение через 24. */
export async function tickPlans(db: Db, now = new Date()): Promise<PlanTickResult> {
  const threeHoursAgo = new Date(now.getTime() - 3 * 3_600_000).toISOString();
  const { data: stale } = await db
    .from("assistant_plans")
    .select("*")
    .eq("status", "pending")
    .is("reminded_at", null)
    .lte("created_at", threeHoursAgo)
    .limit(10);
  const reminded = ((stale ?? []) as Array<Record<string, unknown>>).map(rowToPlan);
  if (reminded.length) {
    await db
      .from("assistant_plans")
      .update({ reminded_at: now.toISOString() })
      .in("id", reminded.map((p) => p.id));
  }

  const { data: dead } = await db
    .from("assistant_plans")
    .update({ status: "expired", result: "Истёк срок утверждения", decided_at: now.toISOString() })
    .eq("status", "pending")
    .lte("expires_at", now.toISOString())
    .select("id");
  return { reminded, expired: (dead ?? []).length };
}
