// Синхронизация с Google Календарём через connector-gateway (только сервер).
// Если коннектор не подключён — функции возвращают { configured: false } и
// планер продолжает работать локально.
import type { CalItem, CalDirection } from "@/lib/calendar/model";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  etag?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

function keys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const cal = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovable || !cal) return null;
  return { lovable, cal };
}

export function googleConfigured(): boolean {
  return keys() !== null;
}

async function gcal<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
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
    console.error(`[gcal] ${path} failed [${res.status}]: ${body}`);
    const err = new Error(`google-calendar ${res.status}: ${body.slice(0, 300)}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

/** Название события с префиксом направления — так видно направление в Google. */
export function eventSummary(item: Pick<CalItem, "title" | "kind">, dir: CalDirection | null): string {
  const prefix = dir ? `[${dir.title}]` : "";
  const kindMark = item.kind === "task" ? "Задача:" : "";
  return [prefix, kindMark, item.title].filter(Boolean).join(" ");
}

export function itemToEvent(item: CalItem, dir: CalDirection | null): Record<string, unknown> {
  const start = item.starts_at ?? item.due_at;
  const end = item.ends_at ?? (start ? new Date(new Date(start).getTime() + 30 * 60_000).toISOString() : null);
  const body: Record<string, unknown> = {
    summary: eventSummary(item, dir),
    description: [item.notes, item.importance === "hard" ? "⚠️ Жёсткая — не переносить" : null]
      .filter(Boolean)
      .join("\n\n"),
    location: item.location ?? undefined,
    colorId: dir?.google_color_id ?? undefined,
    extendedProperties: { private: { planner_id: item.id, planner_kind: item.kind } },
  };
  if (item.all_day && start) {
    const d = new Date(start).toISOString().slice(0, 10);
    body.start = { date: d };
    body.end = { date: d };
  } else if (start) {
    body.start = { dateTime: new Date(start).toISOString(), timeZone: item.tz };
    body.end = { dateTime: new Date(end as string).toISOString(), timeZone: item.tz };
  }
  return body;
}

export async function gcalInsert(calendarId: string, body: Record<string, unknown>): Promise<GEvent> {
  return gcal<GEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body });
}

export async function gcalPatch(calendarId: string, eventId: string, body: Record<string, unknown>): Promise<GEvent> {
  return gcal<GEvent>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body,
  });
}

export async function gcalDelete(calendarId: string, eventId: string): Promise<void> {
  try {
    await gcal(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 404 && status !== 410) throw e;
  }
}

export interface GListResult {
  items: GEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

/**
 * Инкрементальная выборка: с syncToken тянем только изменения.
 * Google отвечает 410, когда токен протух — тогда читаем окно заново.
 */
export async function gcalChanges(
  calendarId: string,
  syncToken: string | null,
): Promise<{ events: GEvent[]; syncToken: string | null; reset: boolean }> {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const fullQuery = () => {
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 120 * 86_400_000).toISOString();
    return `${base}?singleEvents=true&showDeleted=true&maxResults=250&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`;
  };
  try {
    const path = syncToken
      ? `${base}?singleEvents=true&showDeleted=true&maxResults=250&syncToken=${encodeURIComponent(syncToken)}`
      : fullQuery();
    const res = await gcal<GListResult>(path);
    return { events: res.items ?? [], syncToken: res.nextSyncToken ?? null, reset: false };
  } catch (e) {
    if ((e as { status?: number }).status === 410) {
      const res = await gcal<GListResult>(fullQuery());
      return { events: res.items ?? [], syncToken: res.nextSyncToken ?? null, reset: true };
    }
    throw e;
  }
}
