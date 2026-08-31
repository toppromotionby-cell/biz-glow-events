// Планы и карточки решений бота-помощника: хранение, решения, исполнение. Только сервер.
import { admin, type Identity } from "@/lib/assistant/store.server";
import { isExecutable, isAllowedAction, ALLOWED_ACTIONS, type ActionName } from "@/lib/assistant/actions";
import type { AssistantPlanStep } from "@/lib/assistant/cards";

export const PLAN_KIND = "assistant";
export const PLAN_TTL_HOURS = 24;

export type AssistantPlanStatus = "pending" | "editing" | "approved" | "rejected" | "expired" | "failed";

export interface AssistantPlanRow {
  id: string;
  kind: string;
  status: AssistantPlanStatus;
  title: string;
  summary: string | null;
  request: string | null;
  steps: AssistantPlanStep[];
  questions: string[];
  attachments: { file_id?: string; mime?: string; kind?: string }[];
  result: string | null;
  tg_chat_id: number | null;
  tg_message_id: number | null;
  expires_at: string;
  created_at: string;
}

function rowToPlan(r: Record<string, unknown>): AssistantPlanRow {
  return {
    ...(r as unknown as AssistantPlanRow),
    steps: Array.isArray(r.steps) ? (r.steps as AssistantPlanStep[]) : [],
    questions: Array.isArray(r.questions) ? (r.questions as string[]) : [],
    attachments: Array.isArray(r.attachments) ? (r.attachments as AssistantPlanRow["attachments"]) : [],
  };
}

export async function createPlan(input: {
  chatId: number;
  title: string;
  summary?: string | null;
  request?: string | null;
  steps?: AssistantPlanStep[];
  questions?: string[];
  attachments?: AssistantPlanRow["attachments"];
}): Promise<AssistantPlanRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("assistant_plans")
    .insert({
      kind: PLAN_KIND,
      chat_key: `assistant:${input.chatId}`,
      status: "pending",
      title: input.title.slice(0, 200),
      summary: input.summary ?? null,
      request: input.request ?? null,
      steps: (input.steps ?? []) as never,
      questions: (input.questions ?? []) as never,
      attachments: (input.attachments ?? []) as never,
      tg_chat_id: input.chatId,
      expires_at: new Date(Date.now() + PLAN_TTL_HOURS * 3600_000).toISOString(),
    } as never)
    .select("*")
    .single();
  if (error) {
    console.error("[assistant-plan] insert failed", error.message);
    return null;
  }
  return rowToPlan(data as Record<string, unknown>);
}

export async function getPlan(id: string): Promise<AssistantPlanRow | null> {
  const db = await admin();
  const { data } = await db.from("assistant_plans").select("*").eq("id", id).maybeSingle();
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

export async function attachMessage(id: string, messageId: number): Promise<void> {
  const db = await admin();
  await db.from("assistant_plans").update({ tg_message_id: messageId }).eq("id", id);
}

export async function setPlanStatus(
  id: string,
  status: AssistantPlanStatus,
  result?: string | null,
): Promise<void> {
  const db = await admin();
  await db
    .from("assistant_plans")
    .update({ status, result: result ?? null, decided_at: new Date().toISOString() })
    .eq("id", id);
}

/** План, который ждёт правок от этого чата (для режима «Редактировать»). */
export async function planAwaitingEdit(chatId: number): Promise<AssistantPlanRow | null> {
  const db = await admin();
  const { data } = await db
    .from("assistant_plans")
    .select("*")
    .eq("kind", PLAN_KIND)
    .eq("tg_chat_id", chatId)
    .eq("status", "editing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

export type PlanGuard =
  | { ok: true; plan: AssistantPlanRow }
  | { ok: false; reason: "not_found" | "foreign" | "decided" | "expired"; message: string };

/** Проверка перед решением: план существует, принадлежит чату, не просрочен и ещё не закрыт. */
export function checkPlan(plan: AssistantPlanRow | null, chatId: number, now = new Date()): PlanGuard {
  if (!plan) return { ok: false, reason: "not_found", message: "Карточка не найдена — она устарела." };
  if (plan.tg_chat_id !== chatId) return { ok: false, reason: "foreign", message: "Эта карточка из другого чата." };
  if (plan.status !== "pending" && plan.status !== "editing") {
    return { ok: false, reason: "decided", message: "Решение по карточке уже принято." };
  }
  if (new Date(plan.expires_at) <= now) {
    return { ok: false, reason: "expired", message: "Срок карточки истёк — попросите собрать заново." };
  }
  return { ok: true, plan };
}

/* --------------------------------- исполнение --------------------------------- */

export interface StepResult {
  label: string;
  ok: boolean;
  note: string;
}

async function logAction(entry: { chatId: number; action: string; args: unknown; ok: boolean }): Promise<void> {
  try {
    const db = await admin();
    await db.from("assistant_actions").insert({
      chat_key: `assistant:${entry.chatId}`,
      action: entry.action,
      after_state: { args: entry.args, ok: entry.ok } as never,
    });
  } catch (e) {
    console.error("[assistant-plan] audit failed", e instanceof Error ? e.message : e);
  }
}

async function runStep(who: Identity, step: AssistantPlanStep): Promise<StepResult> {
  const name = step.action;
  const args = (step.args ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string).trim() : "");

  if (!isAllowedAction(name)) {
    return { label: step.label, ok: false, note: "действие не разрешено помощнику — сделайте вручную" };
  }
  if (!isExecutable(name)) {
    return { label: step.label, ok: true, note: `вручную: ${str("where") || "в админке"}` };
  }
  const meta = ALLOWED_ACTIONS[name as ActionName];
  if (meta.adminOnly && !who.isAdmin) {
    return { label: step.label, ok: false, note: "нужны права администратора" };
  }

  try {
    switch (name) {
      case "kb_add": {
        const fact = str("fact");
        if (!fact) return { label: step.label, ok: false, note: "не указан текст факта" };
        const { upsertFact } = await import("@/lib/knowledge/facts.server");
        await upsertFact({
          subject: str("subject") || "Общее",
          fact,
          sourceKind: "dialog",
          authorId: who.userId,
          confidence: 0.8,
        });
        return { label: step.label, ok: true, note: "записано в базу знаний" };
      }
      case "kb_archive": {
        const id = str("id");
        if (!id) return { label: step.label, ok: false, note: "не указан факт" };
        const { setFactStatus } = await import("@/lib/knowledge/facts.server");
        await setFactStatus(id, "stale");
        return { label: step.label, ok: true, note: "факт помечен устаревшим" };
      }
      case "hygiene_fix":
      case "hygiene_dismiss": {
        const id = str("id");
        if (!id) return { label: step.label, ok: false, note: "не указано замечание" };
        const { decideFinding } = await import("@/lib/hygiene/engine.server");
        await decideFinding(id, name === "hygiene_fix" ? "fixed" : "dismissed", who.userId);
        return { label: step.label, ok: true, note: name === "hygiene_fix" ? "замечание закрыто" : "замечание отклонено" };
      }
      case "send_doc": {
        const kind = str("kind");
        const id = str("id");
        const { TG_DOC_KINDS } = await import("@/lib/telegram/doc-kinds");
        if (!id || !TG_DOC_KINDS.includes(kind as never)) {
          return { label: step.label, ok: false, note: "документ не распознан" };
        }
        const { sendDoc } = await import("@/lib/assistant/files.server");
        const res = await sendDoc(who, kind as never, id);
        return { label: step.label, ok: res.ok, note: res.ok ? "файл отправлен" : res.message };
      }
      case "order_note": {
        const orderId = str("orderId");
        const note = str("note");
        if (!orderId || !note) return { label: step.label, ok: false, note: "не хватает заявки или текста" };
        const db = await admin();
        const { data: prev } = await db
          .from("order_internal_notes")
          .select("notes")
          .eq("order_id", orderId)
          .maybeSingle();
        const merged = [(prev as { notes?: string } | null)?.notes ?? "", note].filter(Boolean).join("\n");
        const { error } = await db
          .from("order_internal_notes")
          .upsert({ order_id: orderId, notes: merged, updated_by: who.userId } as never, { onConflict: "order_id" });
        if (error) return { label: step.label, ok: false, note: error.message };
        return { label: step.label, ok: true, note: "заметка добавлена" };
      }
      default:
        return { label: step.label, ok: false, note: "действие не поддержано" };
    }
  } catch (e) {
    return { label: step.label, ok: false, note: e instanceof Error ? e.message : "ошибка выполнения" };
  } finally {
    await logAction({ chatId: who.chatId, action: name, args, ok: true });
  }
}

/** Исполнение утверждённого плана. Возвращает человекочитаемый отчёт. */
export async function executePlan(who: Identity, plan: AssistantPlanRow): Promise<string> {
  if (!plan.steps.length) return "Шагов для автоматического выполнения не было — карточка отмечена как принятая.";
  const results: StepResult[] = [];
  for (const step of plan.steps.slice(0, 7)) results.push(await runStep(who, step));
  return results.map((r) => `${r.ok ? "🟢" : "🔴"} ${r.label} — ${r.note}`).join("\n");
}
