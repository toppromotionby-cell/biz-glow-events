// Хранилище помощника: сессии, сообщения, планы (runs). Только сервер.
import { admin } from "@/lib/copilot/guard.server";
import type {
  CopilotContext,
  CopilotMessage,
  CopilotOp,
  CopilotRun,
  CopilotRunStatus,
  CopilotSession,
  CopilotSource,
  CopilotStep,
} from "@/lib/copilot/types";

type Row = Record<string, unknown>;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mapRun(row: Row): CopilotRun {
  return {
    id: String(row.id),
    session_id: (row.session_id as string) ?? null,
    status: (row.status as CopilotRunStatus) ?? "pending",
    title: String(row.title ?? "План"),
    summary: (row.summary as string) ?? null,
    request: (row.request as string) ?? null,
    risk: (row.risk as CopilotRun["risk"]) ?? "write",
    steps: arr<CopilotStep>(row.steps),
    preview: arr<CopilotOp>(row.preview),
    questions: arr<string>(row.questions),
    sources: arr<CopilotSource>(row.sources),
    result: (row.result as string) ?? null,
    error: (row.error as string) ?? null,
    applied_at: (row.applied_at as string) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export function mapMessage(row: Row): CopilotMessage {
  return {
    id: String(row.id),
    role: (row.role as CopilotMessage["role"]) ?? "assistant",
    content: String(row.content ?? ""),
    sources: arr<CopilotSource>(row.sources),
    run_id: (row.run_id as string) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function ensureSession(userId: string, sessionId: string | null, context: CopilotContext | null): Promise<CopilotSession> {
  const db = await admin();
  if (sessionId) {
    const { data } = await db.from("copilot_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (data) {
      const row = data as Row;
      return {
        id: String(row.id),
        title: String(row.title ?? "Диалог"),
        last_message_at: String(row.last_message_at ?? row.created_at),
        created_at: String(row.created_at),
      };
    }
  }
  const { data, error } = await db
    .from("copilot_sessions")
    .insert({ user_id: userId, title: "Новый диалог", context: context ?? {} } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Row;
  return {
    id: String(row.id),
    title: String(row.title ?? "Новый диалог"),
    last_message_at: String(row.last_message_at ?? row.created_at),
    created_at: String(row.created_at),
  };
}

export async function listSessions(userId: string, limit = 20): Promise<CopilotSession[]> {
  const db = await admin();
  const { data } = await db
    .from("copilot_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Диалог"),
    last_message_at: String(r.last_message_at ?? r.created_at),
    created_at: String(r.created_at),
  }));
}

export async function addMessage(input: {
  sessionId: string;
  role: CopilotMessage["role"];
  content: string;
  sources?: CopilotSource[];
  runId?: string | null;
}): Promise<CopilotMessage> {
  const db = await admin();
  const { data, error } = await db
    .from("copilot_messages")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? [],
      run_id: input.runId ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await db
    .from("copilot_sessions")
    .update({ last_message_at: new Date().toISOString() } as never)
    .eq("id", input.sessionId);
  return mapMessage(data as Row);
}

export async function listMessages(sessionId: string, limit = 40): Promise<CopilotMessage[]> {
  const db = await admin();
  const { data } = await db
    .from("copilot_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapMessage);
}

export async function renameSessionFromFirstMessage(sessionId: string, text: string): Promise<void> {
  const db = await admin();
  const { data } = await db.from("copilot_sessions").select("title").eq("id", sessionId).maybeSingle();
  const title = String((data as Row | null)?.title ?? "");
  if (title && title !== "Новый диалог") return;
  await db
    .from("copilot_sessions")
    .update({ title: text.trim().slice(0, 60) || "Диалог" } as never)
    .eq("id", sessionId);
}

export async function createRun(input: {
  sessionId: string;
  userId: string;
  title: string;
  summary: string;
  request: string;
  risk: CopilotRun["risk"];
  steps: CopilotStep[];
  preview: CopilotOp[];
  questions?: string[];
  sources?: CopilotSource[];
}): Promise<CopilotRun> {
  const db = await admin();
  const { data, error } = await db
    .from("copilot_runs")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      status: "pending",
      title: input.title.slice(0, 200),
      summary: input.summary,
      request: input.request.slice(0, 4000),
      risk: input.risk,
      steps: input.steps,
      preview: input.preview,
      questions: input.questions ?? [],
      sources: input.sources ?? [],
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data as Row);
}

export async function getRun(id: string, userId: string): Promise<CopilotRun | null> {
  const db = await admin();
  const { data } = await db.from("copilot_runs").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? mapRun(data as Row) : null;
}

export async function listRuns(userId: string, limit = 30): Promise<CopilotRun[]> {
  const db = await admin();
  const { data } = await db
    .from("copilot_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapRun);
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: CopilotRunStatus;
    preview: CopilotOp[];
    snapshot: CopilotOp[];
    result: string | null;
    error: string | null;
    applied_at: string | null;
    decided_at: string | null;
  }>,
): Promise<CopilotRun | null> {
  const db = await admin();
  const { data, error } = await db
    .from("copilot_runs")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRun(data as Row) : null;
}

export async function runSnapshot(id: string): Promise<CopilotOp[]> {
  const db = await admin();
  const { data } = await db.from("copilot_runs").select("snapshot").eq("id", id).maybeSingle();
  return arr<CopilotOp>((data as Row | null)?.snapshot);
}
