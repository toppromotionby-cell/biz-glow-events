// Задачи планера в Google Календаре.
//
// Google Tasks недоступны через коннектор (у OAuth-подключения нет права
// tasks.googleapis.com и выдать его нельзя), поэтому задачи уходят отдельными
// календарями «Задачи · <Направление>» событиями на весь день.
// Только серверный код.
import type { CalDirection, CalItem } from "@/lib/calendar/model";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

/** Служебная метка события-задачи в extendedProperties.private. */
export const TASK_MARK = "planner_task";
/** Префикс выполненной задачи в названии события. */
export const DONE_PREFIX = "✅";

export interface GCalendar {
  id: string;
  summary?: string;
  description?: string;
  timeZone?: string;
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

export function taskCalendarsConfigured(): boolean {
  return keys() !== null;
}

/** Ошибка прав Google (401/403): показываем плашку, но не роняем планер. */
export class GoogleScopeError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(`google-calendar-scope ${status}: ${detail.slice(0, 200)}`);
    this.status = status;
    this.detail = detail.slice(0, 300);
  }
}

export function isScopeError(e: unknown): e is GoogleScopeError {
  return e instanceof GoogleScopeError;
}

export async function gcalRaw<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const k = keys();
  if (!k) throw new Error("google-calendar-not-configured");
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
    console.error(`[gcal-tasks] ${init?.method ?? "GET"} ${path} failed [${res.status}]: ${body}`);
    if (res.status === 401 || res.status === 403) throw new GoogleScopeError(res.status, body);
    const err = new Error(`google-calendar ${res.status}: ${body.slice(0, 300)}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Название календаря задач для направления. */
export function taskCalendarTitle(dir: Pick<CalDirection, "title"> | null): string {
  return `Задачи · ${dir?.title ?? "Личное"}`;
}

export async function listCalendars(): Promise<GCalendar[]> {
  const res = await gcalRaw<{ items?: GCalendar[] }>("/users/me/calendarList?maxResults=250&minAccessRole=writer");
  return res?.items ?? [];
}

/** Ищет календарь задач по названию либо создаёт его и красит в цвет направления. */
export async function ensureTaskCalendar(dir: CalDirection | null, tz = "Europe/Minsk"): Promise<string> {
  const title = taskCalendarTitle(dir);
  const existing = (await listCalendars()).find((c) => (c.summary ?? "").trim() === title);
  if (existing) return existing.id;
  const created = await gcalRaw<GCalendar>("/calendars", {
    method: "POST",
    body: { summary: title, description: "Задачи планера event-hub.by", timeZone: tz },
  });
  if (dir?.google_color_id) {
    try {
      await gcalRaw(`/users/me/calendarList/${encodeURIComponent(created.id)}`, {
        method: "PATCH",
        body: { colorId: dir.google_color_id },
      });
    } catch (e) {
      console.warn("[gcal-tasks] не удалось покрасить календарь", e);
    }
  }
  return created.id;
}

/** Дата дедлайна задачи в формате YYYY-MM-DD (в часовом поясе записи). */
export function taskDay(item: Pick<CalItem, "due_at" | "starts_at" | "tz">, now = new Date()): string {
  const iso = item.due_at ?? item.starts_at ?? now.toISOString();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: item.tz || "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const PRIORITY_TEXT: Record<number, string> = { 1: "P1 — срочно", 2: "P2 — важно", 3: "P3 — обычно", 4: "P4 — потом" };

/** Событие-задача на весь день: заголовок с эмодзи направления и служебные метки. */
export function taskToEvent(item: CalItem, dir: CalDirection | null, now = new Date()): Record<string, unknown> {
  const day = taskDay(item, now);
  const summary = [item.status === "done" ? DONE_PREFIX : null, dir?.emoji ?? null, item.title]
    .filter(Boolean)
    .join(" ");
  const description = [
    item.notes,
    dir ? `Направление: ${dir.title}` : null,
    item.location ? `Место: ${item.location}` : null,
    `Приоритет: ${PRIORITY_TEXT[item.priority] ?? `P${item.priority}`}`,
    item.importance === "hard" ? "⚠️ Жёсткая — не переносить" : null,
    item.tags.length ? `Метки: ${item.tags.join(", ")}` : null,
    `Карточка в планере: https://event-hub.by/admin/planner?item=${item.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    description,
    colorId: dir?.google_color_id ?? undefined,
    transparency: "transparent",
    start: { date: day },
    end: { date: nextDay(day) },
    extendedProperties: {
      private: {
        planner_id: item.id,
        planner_kind: TASK_MARK,
        planner_direction: dir?.key ?? "",
        planner_status: item.status,
      },
    },
    reminders: { useDefault: false },
  };
}

/** Разбор события-задачи обратно в поля планера. */
export function eventToTaskPatch(ev: {
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}): { title: string; due_at: string | null; done: boolean } {
  const raw = (ev.summary ?? "").trim();
  const done = raw.startsWith(DONE_PREFIX);
  const title = raw
    .replace(new RegExp(`^${DONE_PREFIX}\\s*`), "")
    // Убираем ведущий эмодзи направления, если он есть.
    .replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "")
    .trim();
  const day = ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
  return { title: title || "Без названия", due_at: day ? `${day}T00:00:00.000Z` : null, done };
}

/** Событие принадлежит планеру как задача? */
export function isTaskEvent(ev: { extendedProperties?: { private?: Record<string, string> } }): boolean {
  return ev.extendedProperties?.private?.planner_kind === TASK_MARK;
}

export interface GTaskEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  etag?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export async function insertTaskEvent(calendarId: string, body: Record<string, unknown>): Promise<GTaskEvent> {
  return gcalRaw<GTaskEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body });
}

export async function patchTaskEvent(
  calendarId: string,
  eventId: string,
  body: Record<string, unknown>,
): Promise<GTaskEvent> {
  return gcalRaw<GTaskEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body },
  );
}

export async function deleteTaskEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await gcalRaw(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 404 && status !== 410) throw e;
  }
}

/** Инкрементальная выборка изменений календаря задач. */
export async function taskCalendarChanges(
  calendarId: string,
  syncToken: string | null,
): Promise<{ events: GTaskEvent[]; syncToken: string | null }> {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const full = () => {
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 365 * 86_400_000).toISOString();
    return `${base}?singleEvents=true&showDeleted=true&maxResults=250&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`;
  };
  try {
    const path = syncToken
      ? `${base}?singleEvents=true&showDeleted=true&maxResults=250&syncToken=${encodeURIComponent(syncToken)}`
      : full();
    const res = await gcalRaw<{ items?: GTaskEvent[]; nextSyncToken?: string }>(path);
    return { events: res.items ?? [], syncToken: res.nextSyncToken ?? null };
  } catch (e) {
    if ((e as { status?: number }).status === 410) {
      const res = await gcalRaw<{ items?: GTaskEvent[]; nextSyncToken?: string }>(full());
      return { events: res.items ?? [], syncToken: res.nextSyncToken ?? null };
    }
    throw e;
  }
}
