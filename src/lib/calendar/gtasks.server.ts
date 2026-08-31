// Google Tasks через connector-gateway (только сервер).
// Задачи (дела с дедлайном или без времени) уходят сюда, встречи — в Календарь.
// Списки Google Tasks соответствуют направлениям: Личное / Belight / EventHub / Top Promotion.
import type { CalItem } from "@/lib/calendar/model";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/tasks/v1";

export interface GTask {
  id: string;
  title?: string;
  notes?: string;
  status?: "needsAction" | "completed";
  due?: string | null;
  completed?: string | null;
  updated?: string;
  etag?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
}

export interface GTaskList {
  id: string;
  title: string;
  updated?: string;
}

function keys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const cal =
    process.env.GOOGLE_CALENDAR_API_KEY_1 ??
    process.env.GOOGLE_CALENDAR_API_KEY_2 ??
    process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovable || !cal) return null;
  return { lovable, cal };
}

export function gtasksConfigured(): boolean {
  return keys() !== null;
}

/** Признак «доступ к задачам не выдан» — прячем функциональность, а не роняем планер. */
export class GTasksScopeError extends Error {
  constructor() {
    super("google-tasks-scope-missing");
  }
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const k = keys();
  if (!k) throw new Error("google-tasks-not-configured");
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${k.lovable}`,
      "X-Connection-Api-Key": k.cal,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes("insufficient")) throw new GTasksScopeError();
    console.error(`[gtasks] ${path} failed [${res.status}]: ${body}`);
    const err = new Error(`google-tasks ${res.status}: ${body.slice(0, 300)}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function listTaskLists(): Promise<GTaskList[]> {
  const res = await api<{ items?: GTaskList[] }>("/users/@me/lists?maxResults=100");
  return res?.items ?? [];
}

export async function createTaskList(title: string): Promise<GTaskList> {
  return api<GTaskList>("/users/@me/lists", { method: "POST", body: { title } });
}

/** Находит список по названию либо создаёт его. */
export async function ensureTaskList(title: string): Promise<GTaskList> {
  const lists = await listTaskLists();
  const found = lists.find((l) => l.title.trim().toLowerCase() === title.trim().toLowerCase());
  return found ?? (await createTaskList(title));
}

export async function listTasks(
  listId: string,
  opts?: { updatedMin?: string | null; showCompleted?: boolean },
): Promise<GTask[]> {
  const params = new URLSearchParams({
    maxResults: "100",
    showCompleted: String(opts?.showCompleted ?? true),
    showHidden: "true",
    showDeleted: "true",
  });
  if (opts?.updatedMin) params.set("updatedMin", opts.updatedMin);
  const res = await api<{ items?: GTask[] }>(`/lists/${encodeURIComponent(listId)}/tasks?${params.toString()}`);
  return res?.items ?? [];
}

export function itemToTask(item: CalItem): Record<string, unknown> {
  const due = item.due_at ?? item.starts_at;
  const notes = [
    item.notes,
    item.location ? `Место: ${item.location}` : null,
    item.importance === "hard" ? "⚠️ Жёсткое — не переносить" : null,
    item.starts_at ? `Время: ${new Date(item.starts_at).toISOString()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    title: item.title,
    notes: notes || undefined,
    // Google Tasks хранит только дату дедлайна (время игнорируется).
    due: due ? `${new Date(due).toISOString().slice(0, 10)}T00:00:00.000Z` : undefined,
    status: item.status === "done" ? "completed" : "needsAction",
  };
}

export async function insertTask(listId: string, body: Record<string, unknown>): Promise<GTask> {
  return api<GTask>(`/lists/${encodeURIComponent(listId)}/tasks`, { method: "POST", body });
}

export async function patchTask(listId: string, taskId: string, body: Record<string, unknown>): Promise<GTask> {
  return api<GTask>(`/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body,
  });
}

export async function deleteTask(listId: string, taskId: string): Promise<void> {
  try {
    await api(`/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 404 && status !== 410) throw e;
  }
}

export async function moveTask(fromList: string, toList: string, taskId: string, body: Record<string, unknown>) {
  const created = await insertTask(toList, body);
  await deleteTask(fromList, taskId);
  return created;
}
