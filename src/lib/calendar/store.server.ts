// Хранилище планера: чтение/запись записей, напоминания, выгрузка в Google.
// Только серверный код (service-role клиент).
import { isOverdue, type AssistantPrefs, type CalDirection, type CalItem, type CalKind } from "@/lib/calendar/model";
import {
  gcalChanges,
  gcalDelete,
  gcalInsert,
  gcalPatch,
  googleConfigured,
  itemToEvent,
} from "@/lib/calendar/google.server";
import {
  deleteTask,
  ensureTaskList,
  gtasksConfigured,
  GTasksScopeError,
  insertTask,
  itemToTask,
  listTasks,
  patchTask,
} from "@/lib/calendar/gtasks.server";
import { routeTarget } from "@/lib/calendar/routing";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getPrefs(db: Admin): Promise<AssistantPrefs> {
  const { data } = await db.from("assistant_prefs").select("*").eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    tz: (row.tz as string) ?? "Europe/Minsk",
    tg_chat_id: (row.tg_chat_id as number) ?? (process.env.TELEGRAM_CHAT_ID ? Number(process.env.TELEGRAM_CHAT_ID) : null),
    morning_time: (row.morning_time as string) ?? "08:00",
    evening_time: (row.evening_time as string) ?? "20:00",
    quiet_start: (row.quiet_start as string) ?? "23:00",
    quiet_end: (row.quiet_end as string) ?? "07:30",
    reminder_minutes: (row.reminder_minutes as number[]) ?? [60, 15],
    hard_reminder_minutes: (row.hard_reminder_minutes as number[]) ?? [120, 60, 15],
    followup_minutes: (row.followup_minutes as number) ?? 30,
    style_profile: (row.style_profile as string) ?? null,
    last_device_tz: (row.last_device_tz as string) ?? null,
    tg_allowed_chat_ids: ((row.tg_allowed_chat_ids as number[]) ?? []).map(Number),
    tg_bot_username: (row.tg_bot_username as string) ?? null,
    alice_user_ids: ((row.alice_user_ids as string[]) ?? []).map(String),
    alice_skill_id: (row.alice_skill_id as string) ?? null,
    alice_link_code: (row.alice_link_code as string) ?? null,
    alice_push_enabled: Boolean(row.alice_push_enabled),
    alice_mirror_tg: row.alice_mirror_tg == null ? true : Boolean(row.alice_mirror_tg),
    owner_name: (row.owner_name as string) ?? null,
    tone: ((row.tone as string) ?? "friendly") as AssistantPrefs["tone"],
    voice_reply: Boolean(row.voice_reply),
    brain_enabled: row.brain_enabled == null ? true : Boolean(row.brain_enabled),
    visuals_enabled: row.visuals_enabled == null ? true : Boolean(row.visuals_enabled),
    visual_mode: row.visual_mode === "text" ? "text" : "image",
    digest_visual: row.digest_visual == null ? true : Boolean(row.digest_visual),
    task_routing: ((row.task_routing as string) ?? "auto") as AssistantPrefs["task_routing"],
    gtasks_enabled: row.gtasks_enabled == null ? true : Boolean(row.gtasks_enabled),
  };
}

/**
 * Доступ к боту-планеру: если список разрешённых пуст и чат ещё не привязан —
 * пускаем (первичная привязка), иначе только свой chat_id и явный allow-list.
 */
export async function chatAllowed(db: Admin, chatId: number): Promise<boolean> {
  const prefs = await getPrefs(db);
  if (prefs.tg_allowed_chat_ids.length) return prefs.tg_allowed_chat_ids.includes(chatId);
  if (prefs.tg_chat_id == null) return true;
  return prefs.tg_chat_id === chatId;
}

/** Поиск записей по названию/заметкам (для команды /find в Telegram). */
export async function searchItems(db: Admin, query: string, limit = 10): Promise<CalItem[]> {
  const q = query.replace(/[%,()]/g, " ").trim();
  if (!q) return [];
  const { data } = await db
    .from("calendar_items")
    .select("*")
    .neq("status", "canceled")
    .or(`title.ilike.%${q}%,notes.ilike.%${q}%`)
    .order("starts_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as CalItem[];
}

export async function getDirections(db: Admin): Promise<CalDirection[]> {
  const { data } = await db.from("calendar_directions").select("*").order("sort");
  return (data ?? []) as unknown as CalDirection[];
}

export async function getItem(db: Admin, id: string): Promise<CalItem | null> {
  const { data } = await db.from("calendar_items").select("*").eq("id", id).maybeSingle();
  return (data as unknown as CalItem) ?? null;
}

export async function listItemsBetween(db: Admin, fromIso: string, toIso: string): Promise<CalItem[]> {
  const { data } = await db
    .from("calendar_items")
    .select("*")
    .neq("status", "canceled")
    .or(`and(starts_at.gte.${fromIso},starts_at.lte.${toIso}),and(due_at.gte.${fromIso},due_at.lte.${toIso})`)
    .order("starts_at", { ascending: true });
  return (data ?? []) as unknown as CalItem[];
}

/** Открытые записи без даты или просроченные — «хвосты». */
export async function listOpenTail(db: Admin, nowIso: string): Promise<CalItem[]> {
  const { data } = await db
    .from("calendar_items")
    .select("*")
    .in("status", ["planned", "in_progress"])
    .or(`starts_at.is.null,starts_at.lt.${nowIso}`)
    .order("due_at", { ascending: true })
    .limit(100);
  return (data ?? []) as unknown as CalItem[];
}

// ——— Напоминания ———

export async function scheduleReminders(db: Admin, item: CalItem, prefs: AssistantPrefs): Promise<void> {
  await db.from("calendar_reminders").delete().eq("item_id", item.id).is("sent_at", null);
  if (item.status === "done" || item.status === "canceled") return;

  const rows: Array<{ item_id: string; kind: string; fire_at: string; payload: Record<string, unknown> }> = [];
  const anchor = item.starts_at ?? item.due_at;
  if (anchor) {
    const at = new Date(anchor).getTime();
    const mins = item.importance === "hard" ? prefs.hard_reminder_minutes : prefs.reminder_minutes;
    for (const m of mins) {
      const fire = new Date(at - m * 60_000);
      if (fire.getTime() > Date.now()) {
        rows.push({ item_id: item.id, kind: "before", fire_at: fire.toISOString(), payload: { minutes: m } });
      }
    }
    // Контроль исполнения: спрашиваем после планового окончания.
    const endAt = new Date(item.ends_at ?? anchor).getTime() + prefs.followup_minutes * 60_000;
    if (endAt > Date.now()) {
      rows.push({ item_id: item.id, kind: "followup", fire_at: new Date(endAt).toISOString(), payload: {} });
    }
  }
  if (rows.length) await db.from("calendar_reminders").insert(rows as never);
}

// ——— Google ———

export async function syncCalendarId(db: Admin): Promise<string> {
  const { data } = await db.from("calendar_sync_state").select("google_calendar_id").eq("id", 1).maybeSingle();
  return ((data as { google_calendar_id?: string } | null)?.google_calendar_id) || "primary";
}

/** Выгрузка записи в Google. Ошибки не роняют сохранение — пишем в лог. */
export async function pushToGoogle(db: Admin, item: CalItem): Promise<CalItem> {
  if (!googleConfigured()) return item;
  try {
    const calendarId = await syncCalendarId(db);
    const dirs = await getDirections(db);
    const dir = dirs.find((d) => d.id === item.direction_id) ?? null;
    const body = itemToEvent(item, dir);
    if (!body.start) return item; // без времени в Google не выгружаем
    const ev = item.google_event_id
      ? await gcalPatch(calendarId, item.google_event_id, body)
      : await gcalInsert(calendarId, body);
    const patch = { google_event_id: ev.id, google_etag: ev.etag ?? null, google_updated_at: ev.updated ?? null };
    await db.from("calendar_items").update(patch).eq("id", item.id);
    return { ...item, ...patch } as CalItem;
  } catch (e) {
    console.error("[planner] push to google failed", e);
    return item;
  }
}

export async function removeFromGoogle(db: Admin, item: CalItem): Promise<void> {
  if (!googleConfigured() || !item.google_event_id) return;
  try {
    const calendarId = await syncCalendarId(db);
    await gcalDelete(calendarId, item.google_event_id);
  } catch (e) {
    console.error("[planner] delete in google failed", e);
  }
}

/** Импорт изменений из Google. Возвращает список изменившихся записей. */
export async function pullFromGoogle(db: Admin): Promise<{ applied: number; conflicts: CalItem[] }> {
  if (!googleConfigured()) return { applied: 0, conflicts: [] };
  const { data: state } = await db.from("calendar_sync_state").select("*").eq("id", 1).maybeSingle();
  const st = (state ?? {}) as { sync_token?: string | null; google_calendar_id?: string };
  const calendarId = st.google_calendar_id || "primary";
  const { events, syncToken } = await gcalChanges(calendarId, st.sync_token ?? null);
  const dirs = await getDirections(db);
  let applied = 0;
  const conflicts: CalItem[] = [];

  for (const ev of events) {
    const { data: found } = await db.from("calendar_items").select("*").eq("google_event_id", ev.id).maybeSingle();
    const local = (found as unknown as CalItem) ?? null;
    if (ev.status === "cancelled") {
      if (local && local.status !== "canceled") {
        await db.from("calendar_items").update({ status: "canceled" }).eq("id", local.id);
        conflicts.push({ ...local, status: "canceled" });
        applied += 1;
      }
      continue;
    }
    const starts = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
    const ends = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T23:59:00Z` : null);
    if (!starts) continue;
    const title = (ev.summary ?? "Без названия").replace(/^\[[^\]]+\]\s*/, "").replace(/^Задача:\s*/i, "");
    const dirByColor = dirs.find((d) => d.google_color_id && d.google_color_id === ev.colorId) ?? null;
    const dirByTitle = dirs.find((d) => (ev.summary ?? "").startsWith(`[${d.title}]`)) ?? null;
    const kind: CalKind = /^Задача:/i.test(ev.summary ?? "") ? "task" : "meeting";

    if (!local) {
      const { data: ins } = await db
        .from("calendar_items")
        .insert({
          kind,
          title,
          notes: ev.description ?? null,
          direction_id: (dirByTitle ?? dirByColor)?.id ?? null,
          starts_at: new Date(starts).toISOString(),
          ends_at: ends ? new Date(ends).toISOString() : null,
          all_day: Boolean(ev.start?.date),
          location: ev.location ?? null,
          source: "google",
          google_event_id: ev.id,
          google_etag: ev.etag ?? null,
          google_updated_at: ev.updated ?? null,
        })
        .select("*")
        .maybeSingle();
      applied += 1;
      if (ins) conflicts.push(ins as unknown as CalItem);
      continue;
    }

    const changed =
      new Date(starts).toISOString() !== (local.starts_at ?? "") ||
      title !== local.title ||
      (ev.location ?? null) !== local.location;
    if (!changed) continue;
    const patch = {
      title,
      starts_at: new Date(starts).toISOString(),
      ends_at: ends ? new Date(ends).toISOString() : local.ends_at,
      location: ev.location ?? null,
      google_etag: ev.etag ?? null,
      google_updated_at: ev.updated ?? null,
    };
    await db.from("calendar_items").update(patch).eq("id", local.id);
    const updated = { ...local, ...patch } as CalItem;
    conflicts.push(updated);
    applied += 1;
    const prefs = await getPrefs(db);
    await scheduleReminders(db, updated, prefs);
  }

  await db
    .from("calendar_sync_state")
    .update({ sync_token: syncToken, last_pull_at: new Date().toISOString() })
    .eq("id", 1);
  return { applied, conflicts };
}

// ——— Сохранение ———

export interface SaveInput {
  id?: string;
  kind: CalKind;
  title: string;
  notes?: string | null;
  direction_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  due_at?: string | null;
  all_day?: boolean;
  tz?: string;
  status?: CalItem["status"];
  importance?: CalItem["importance"];
  location?: string | null;
  participants?: string[];
  source?: string;
}

export async function saveItem(db: Admin, input: SaveInput): Promise<CalItem> {
  const prefs = await getPrefs(db);
  const payload = {
    kind: input.kind,
    title: input.title,
    notes: input.notes ?? null,
    direction_id: input.direction_id ?? null,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    due_at: input.due_at ?? null,
    all_day: input.all_day ?? false,
    tz: input.tz ?? prefs.tz,
    status: input.status ?? "planned",
    importance: input.importance ?? "normal",
    location: input.location ?? null,
    participants: input.participants ?? [],
    source: input.source ?? "web",
  };
  const q = input.id
    ? db.from("calendar_items").update(payload).eq("id", input.id).select("*").single()
    : db.from("calendar_items").insert(payload).select("*").single();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let item = data as unknown as CalItem;
  await scheduleReminders(db, item, prefs);
  item = await pushToGoogle(db, item);
  return item;
}

export async function setStatus(db: Admin, id: string, status: CalItem["status"]): Promise<CalItem | null> {
  const { data } = await db
    .from("calendar_items")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  const item = (data as unknown as CalItem) ?? null;
  if (!item) return null;
  const prefs = await getPrefs(db);
  await scheduleReminders(db, item, prefs);
  if (status === "canceled") await removeFromGoogle(db, item);
  else await pushToGoogle(db, item);
  return item;
}

/** Перенос — только по явной команде пользователя. */
export async function rescheduleItem(db: Admin, id: string, startsAtIso: string): Promise<CalItem | null> {
  const item = await getItem(db, id);
  if (!item) return null;
  const durationMs = item.starts_at && item.ends_at
    ? new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()
    : 60 * 60_000;
  const starts = new Date(startsAtIso);
  const patch = {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + durationMs).toISOString(),
    due_at: item.due_at ? starts.toISOString() : null,
    reschedule_count: item.reschedule_count + 1,
    status: "planned" as const,
  };
  const { data } = await db.from("calendar_items").update(patch).eq("id", id).select("*").maybeSingle();
  const updated = (data as unknown as CalItem) ?? null;
  if (!updated) return null;
  const prefs = await getPrefs(db);
  await scheduleReminders(db, updated, prefs);
  await pushToGoogle(db, updated);
  return updated;
}

export async function deleteItem(db: Admin, id: string): Promise<void> {
  const item = await getItem(db, id);
  if (!item) return;
  await removeFromGoogle(db, item);
  await db.from("calendar_items").delete().eq("id", id);
}

// ——— Аналитика ———

export interface DirectionStat {
  direction_id: string | null;
  total: number;
  done: number;
  minutes: number;
  reschedules: number;
}

export interface PlannerAnalytics {
  days: number;
  total: number;
  done: number;
  doneRate: number;
  openNow: number;
  overdueNow: number;
  perDirection: DirectionStat[];
  topRescheduled: Array<{ id: string; title: string; reschedule_count: number }>;
}

/** Аналитика за N дней: время и записи по направлениям, доля просрочек, хронические переносы. */
export async function computeAnalytics(db: Admin, days = 30): Promise<PlannerAnalytics> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db.from("calendar_items").select("*").gte("created_at", from);
  const items = (data ?? []) as unknown as CalItem[];
  const now = new Date();
  const tail = await listOpenTail(db, now.toISOString());
  const done = items.filter((i) => i.status === "done").length;

  const per = new Map<string | null, DirectionStat>();
  for (const i of items) {
    const s = per.get(i.direction_id) ?? { direction_id: i.direction_id, total: 0, done: 0, minutes: 0, reschedules: 0 };
    s.total += 1;
    if (i.status === "done") s.done += 1;
    if (i.starts_at && i.ends_at) {
      s.minutes += Math.max(0, (new Date(i.ends_at).getTime() - new Date(i.starts_at).getTime()) / 60_000);
    }
    s.reschedules += i.reschedule_count;
    per.set(i.direction_id, s);
  }

  return {
    days,
    total: items.length,
    done,
    doneRate: items.length ? Math.round((done / items.length) * 100) : 0,
    openNow: tail.filter((i) => !isOverdue(i, now)).length,
    overdueNow: tail.filter((i) => isOverdue(i, now)).length,
    perDirection: [...per.values()].sort((a, b) => b.minutes - a.minutes || b.total - a.total),
    topRescheduled: items
      .filter((i) => i.reschedule_count > 0 && i.status !== "done" && i.status !== "canceled")
      .sort((a, b) => b.reschedule_count - a.reschedule_count)
      .slice(0, 5)
      .map((i) => ({ id: i.id, title: i.title, reschedule_count: i.reschedule_count })),
  };
}
