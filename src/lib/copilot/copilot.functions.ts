// Серверные функции ИИ-помощника админки. Клиентобезопасный модуль: тяжёлое — внутри handler.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CopilotContext, CopilotMessage, CopilotRun, CopilotSession, CopilotSettings } from "@/lib/copilot/types";

export interface CopilotSendResult {
  sessionId: string;
  reply: string;
  runId: string | null;
  run: CopilotRun | null;
  messages: CopilotMessage[];
}

export const copilotSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId?: string | null; text: string; context?: CopilotContext | null }) => {
    const text = (input?.text ?? "").trim();
    if (!text) throw new Error("Пустой запрос");
    return { sessionId: input.sessionId ?? null, text: text.slice(0, 4000), context: input.context ?? null };
  })
  .handler(async ({ data, context }): Promise<CopilotSendResult> => {
    const { assertCopilotAccess } = await import("@/lib/copilot/guard.server");
    await assertCopilotAccess({ supabase: context.supabase as never, userId: context.userId });
    const { ensureSession, listMessages, getRun } = await import("@/lib/copilot/store.server");
    const { copilotTurn } = await import("@/lib/copilot/agent.server");

    const session = await ensureSession(context.userId, data.sessionId, data.context);
    const reply = await copilotTurn({
      userId: context.userId,
      sessionId: session.id,
      text: data.text,
      context: data.context,
    });
    return {
      sessionId: session.id,
      reply: reply.text,
      runId: reply.runId,
      run: reply.runId ? await getRun(reply.runId, context.userId) : null,
      messages: await listMessages(session.id, 40),
    };
  });

export const copilotHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId?: string | null }) => ({ sessionId: input?.sessionId ?? null }))
  .handler(async ({ data, context }): Promise<{ sessions: CopilotSession[]; messages: CopilotMessage[]; runs: CopilotRun[]; settings: CopilotSettings }> => {
    const { assertCopilotAccess, getCopilotSettings } = await import("@/lib/copilot/guard.server");
    await assertCopilotAccess({ supabase: context.supabase as never, userId: context.userId });
    const { listSessions, listMessages, listRuns } = await import("@/lib/copilot/store.server");
    const sessions = await listSessions(context.userId);
    const sessionId = data.sessionId ?? sessions[0]?.id ?? null;
    return {
      sessions,
      messages: sessionId ? await listMessages(sessionId, 40) : [],
      runs: await listRuns(context.userId, 20),
      settings: await getCopilotSettings(),
    };
  });

export const copilotDecide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; decision: "approve" | "reject" | "rollback"; ops?: unknown }) => {
    if (!input?.runId) throw new Error("Не указан план");
    if (!["approve", "reject", "rollback"].includes(input.decision)) throw new Error("Неизвестное решение");
    return { runId: input.runId, decision: input.decision, ops: input.ops };
  })
  .handler(async ({ data, context }): Promise<{ run: CopilotRun | null; message: string }> => {
    const { assertCopilotAccess, assertOpsWithinLimits, getCopilotSettings } = await import("@/lib/copilot/guard.server");
    await assertCopilotAccess({ supabase: context.supabase as never, userId: context.userId });
    const { getRun, updateRun, runSnapshot } = await import("@/lib/copilot/store.server");
    const { applyOps } = await import("@/lib/copilot/tools.server");
    const { invertOps } = await import("@/lib/copilot/diff");
    const settings = await getCopilotSettings();

    const run = await getRun(data.runId, context.userId);
    if (!run) throw new Error("План не найден");

    if (data.decision === "reject") {
      const updated = await updateRun(run.id, { status: "rejected", decided_at: new Date().toISOString() });
      return { run: updated, message: "План отклонён — ничего не изменилось." };
    }

    if (data.decision === "rollback") {
      if (run.status !== "applied") throw new Error("Откатывать нечего: план не был применён");
      const snapshot = await runSnapshot(run.id);
      const back = invertOps(snapshot);
      const outcome = await applyOps(back, { runId: run.id, userId: context.userId, tool: "rollback" });
      const updated = await updateRun(run.id, {
        status: outcome.failed.length ? "failed" : "rolled_back",
        error: outcome.failed.length ? outcome.failed.map((f) => f.error).join("; ") : null,
        result: `Откат: ${outcome.applied.length} записей`,
      });
      return {
        run: updated,
        message: outcome.failed.length
          ? `Откат частичный: ${outcome.applied.length} ок, ${outcome.failed.length} с ошибкой.`
          : `Откатил ${outcome.applied.length} изменений.`,
      };
    }

    if (run.status !== "pending") throw new Error("Этот план уже обработан");
    assertOpsWithinLimits(run.preview, settings);
    const outcome = await applyOps(run.preview, { runId: run.id, userId: context.userId, tool: "copilot" });
    const updated = await updateRun(run.id, {
      status: outcome.failed.length && !outcome.applied.length ? "failed" : "applied",
      snapshot: outcome.applied,
      applied_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
      result: `Применено ${outcome.applied.length} из ${run.preview.length}`,
      error: outcome.failed.length ? outcome.failed.map((f) => `${f.op.label}: ${f.error}`).join("; ") : null,
    });
    // Утверждённые изменения попадают в общую базу знаний — ими пользуются боты и коллеги.
    try {
      const { upsertFact } = await import("@/lib/knowledge/facts.server");
      const { summarizeOps } = await import("@/lib/copilot/diff");
      await upsertFact({
        scope: "shared",
        subject: `Копилот · ${run.title}`.slice(0, 200),
        fact: `${new Date().toLocaleDateString("ru-RU")}: ${run.title}. ${summarizeOps(outcome.applied)}. ${
          outcome.applied.map((o) => `${o.table}/${o.label}`).slice(0, 10).join(", ")
        }`,
        sourceKind: "system",
        sourceTable: "copilot_runs",
        sourceId: run.id,
        authorId: context.userId,
      });
    } catch {
      // База знаний не должна ломать применение плана.
    }

    return {
      run: updated,
      message: outcome.failed.length
        ? `Применено ${outcome.applied.length}, с ошибкой ${outcome.failed.length}.`
        : `Готово: применено ${outcome.applied.length} изменений.`,
    };
  });

export interface CopilotAuditRow {
  id: string;
  run_id: string | null;
  tool: string;
  table_name: string | null;
  record_id: string | null;
  label: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

/** Журнал: планы и построчный аудит применённых операций. */
export const copilotJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number }) => ({ limit: Math.min(Math.max(input?.limit ?? 50, 1), 200) }))
  .handler(async ({ data, context }): Promise<{ runs: CopilotRun[]; audit: CopilotAuditRow[]; settings: CopilotSettings }> => {
    const { assertCopilotAccess, getCopilotSettings } = await import("@/lib/copilot/guard.server");
    await assertCopilotAccess({ supabase: context.supabase as never, userId: context.userId });
    const { listRuns } = await import("@/lib/copilot/store.server");
    const { admin } = await import("@/lib/assistant/store.server");
    const db = await admin();
    const { data: audit } = await db
      .from("copilot_audit")
      .select("id, run_id, tool, table_name, record_id, label, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return {
      runs: await listRuns(context.userId, data.limit),
      audit: (audit ?? []) as CopilotAuditRow[],
      settings: await getCopilotSettings(),
    };
  });

export const copilotSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<CopilotSettings>) => input ?? {})
  .handler(async ({ data, context }): Promise<CopilotSettings> => {
    const { assertCopilotAccess, patchCopilotSettings } = await import("@/lib/copilot/guard.server");
    await assertCopilotAccess({ supabase: context.supabase as never, userId: context.userId });
    return patchCopilotSettings(data);
  });

