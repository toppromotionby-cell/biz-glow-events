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
  deleteTaskEvent,
  ensureTaskCalendar,
  eventToTaskPatch,
  insertTaskEvent,
  isScopeError,
  isTaskEvent,
  patchTaskEvent,
  taskCalendarChanges,
  taskCalendarsConfigured,
  taskToEvent,
} from "@/lib/calendar/task-events.server";

import { routeTarget } from "@/lib/calendar/routing";
import { reminderLabel, type SyncStatus } from "@/lib/calendar/tg-format";

export interface PushResult {
  item: CalItem;
  status: SyncStatus;
}

/** Запись вместе со статусами выгрузки в Google (для ответа ассистента). */
export type SyncedItem = CalItem & { sync?: SyncStatus[] };


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

/** Выгрузка записи в Google. Ошибки не роняют сохранение — возвращаем статус. */
export async function pushToGoogle(db: Admin, item: CalItem, prefs?: AssistantPrefs): Promise<PushResult> {
  if (!googleConfigured()) {
    return { item, status: { target: "calendar", state: "skipped", detail: "Google не подключён" } };
  }
  try {
    const calendarId = await syncCalendarId(db);
    const dirs = await getDirections(db);
    const dir = dirs.find((d) => d.id === item.direction_id) ?? null;
    const mins = prefs
      ? item.importance === "hard"
        ? prefs.hard_reminder_minutes
        : prefs.reminder_minutes
      : [];
    // Задача без времени уходит all-day событием на дату срока (или на сегодня).
    let forGoogle = item;
    if (!item.starts_at && !item.due_at) {
      forGoogle = { ...item, all_day: true, due_at: new Date().toISOString() };
    } else if (!item.starts_at && item.due_at && !item.all_day && item.kind === "task") {
      forGoogle = { ...item, all_day: true };
    }
    const body = itemToEvent(forGoogle, dir, { reminderMinutes: mins });
    const ev = item.google_event_id
      ? await gcalPatch(calendarId, item.google_event_id, body)
      : await gcalInsert(calendarId, body);
    const patch = { google_event_id: ev.id, google_etag: ev.etag ?? null, google_updated_at: ev.updated ?? null };
    await db.from("calendar_items").update(patch).eq("id", item.id);
    return {
      item: { ...item, ...patch } as CalItem,
      status: {
        target: "calendar",
        state: "ok",
        reminderLabel: reminderLabel(mins),
      },
    };
  } catch (e) {
    console.error("[planner] push to google failed", e);
    return {
      item,
      status: { target: "calendar", state: "failed", detail: (e as Error).message?.slice(0, 120) ?? "ошибка" },
    };
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

// ——— Задачи в Google Календаре ———
//
// Google Tasks недоступны (у подключения нет права tasks.googleapis.com),
// поэтому задачи живут отдельными календарями «Задачи · <Направление>».
// В БД переиспользуем поля: google_task_id — id события, google_tasklist_id —
// id календаря задач.

/** Календарь задач для направления записи (создаётся при первой выгрузке). */
export async function taskCalendarForItem(db: Admin, item: CalItem): Promise<{ calendarId: string; dir: CalDirection | null }> {
  const dirs = await getDirections(db);
  const dir = dirs.find((d) => d.id === item.direction_id) ?? null;
  const known = (dir as (CalDirection & { google_calendar_id?: string | null }) | null)?.google_calendar_id;
  if (known) return { calendarId: known, dir };
  const calendarId = await ensureTaskCalendar(dir);
  if (dir) await db.from("calendar_directions").update({ google_calendar_id: calendarId } as never).eq("id", dir.id);
  return { calendarId, dir };
}

/** Выгрузка задачи событием на весь день. Ошибки не роняют сохранение. */
export async function pushToTasks(db: Admin, item: CalItem): Promise<PushResult> {
  if (!taskCalendarsConfigured()) {
    return { item, status: { target: "tasks", state: "skipped", detail: "Google не подключён" } };
  }
  try {
    const { calendarId, dir } = await taskCalendarForItem(db, item);
    const body = taskToEvent(item, dir);
    let ev;
    if (item.google_task_id && item.google_tasklist_id && item.google_tasklist_id !== calendarId) {
      // Сменилось направление — переносим задачу в другой календарь.
      await deleteTaskEvent(item.google_tasklist_id, item.google_task_id);
      ev = await insertTaskEvent(calendarId, body);
    } else if (item.google_task_id) {
      ev = await patchTaskEvent(calendarId, item.google_task_id, body);
    } else {
      ev = await insertTaskEvent(calendarId, body);
    }
    const patch = {
      google_task_id: ev.id,
      google_tasklist_id: calendarId,
      google_tasks_etag: ev.etag ?? null,
      google_tasks_updated_at: ev.updated ?? null,
    };
    await db.from("calendar_items").update(patch).eq("id", item.id);
    return {
      item: { ...item, ...patch } as CalItem,
      status: { target: "tasks", state: "ok", detail: dir?.title ?? null },
    };
  } catch (e) {
    if (isScopeError(e)) {
      const { reportGoogleIssue } = await import("@/lib/calendar/health.server");
      await reportGoogleIssue(db, e.detail);
      return { item, status: { target: "tasks", state: "skipped", detail: "нет доступа к Google" } };
    }
    console.error("[planner] push task event failed", e);
    return { item, status: { target: "tasks", state: "failed", detail: (e as Error).message?.slice(0, 120) } };
  }
}

export async function removeFromTasks(db: Admin, item: CalItem): Promise<void> {
  if (!taskCalendarsConfigured() || !item.google_task_id || !item.google_tasklist_id) return;
  try {
    await deleteTaskEvent(item.google_tasklist_id, item.google_task_id);
  } catch (e) {
    console.error("[planner] delete task event failed", e);
  }
}

/** Единая точка выгрузки: решает, куда именно уходит запись, и отдаёт статусы. */
export async function syncTargets(db: Admin, item: CalItem, prefs: AssistantPrefs): Promise<SyncedItem> {
  const target = routeTarget(item, prefs.task_routing);
  let out: CalItem = item;
  const sync: SyncStatus[] = [];
  if (target === "calendar" || target === "both") {
    const res = await pushToGoogle(db, out, prefs);
    out = res.item;
    sync.push(res.status);
  } else if (out.google_event_id) {
    await removeFromGoogle(db, out);
  }
  if (prefs.gtasks_enabled && (target === "tasks" || target === "both")) {
    const res = await pushToTasks(db, out);
    out = res.item;
    sync.push(res.status);
  } else if (out.google_task_id && target !== "both") {
    await removeFromTasks(db, out);
  }
  return { ...out, sync };
}

/** Импорт изменений из календарей задач (названия, даты, отметка ✅). */
export async function pullFromTasks(db: Admin): Promise<{ applied: number }> {
  if (!taskCalendarsConfigured()) return { applied: 0 };
  const prefs = await getPrefs(db);
  if (!prefs.gtasks_enabled) return { applied: 0 };
  const dirs = (await getDirections(db)) as Array<CalDirection & { google_calendar_id?: string | null; google_sync_token?: string | null }>;
  let applied = 0;
  try {
    for (const dir of dirs) {
      if (!dir.active || !dir.google_calendar_id) continue;
      const { events, syncToken } = await taskCalendarChanges(dir.google_calendar_id, dir.google_sync_token ?? null);
      for (const ev of events) {
        const { data: found } = await db.from("calendar_items").select("*").eq("google_task_id", ev.id).maybeSingle();
        const local = (found as unknown as CalItem) ?? null;
        if (ev.status === "cancelled") {
          if (local && local.status !== "canceled") {
            await db.from("calendar_items").update({ status: "canceled" }).eq("id", local.id);
            applied += 1;
          }
          continue;
        }
        // Чужие события в календаре задач не трогаем — только свои и вручную созданные задачи.
        const mine = isTaskEvent(ev) || Boolean(local);
        if (!mine && !ev.start?.date) continue;
        const parsed = eventToTaskPatch(ev);
        const patch = {
          title: parsed.title,
          due_at: parsed.due_at,
          status: parsed.done ? "done" : local?.status === "done" ? "planned" : (local?.status ?? "planned"),
          completed_at: parsed.done ? (local?.completed_at ?? new Date().toISOString()) : null,
          google_task_id: ev.id,
          google_tasklist_id: dir.google_calendar_id,
          google_tasks_updated_at: ev.updated ?? null,
        };
        if (local) {
          const localNewer =
            local.updated_at && ev.updated && new Date(local.updated_at).getTime() > new Date(ev.updated).getTime();
          if (localNewer) continue;
          await db.from("calendar_items").update(patch).eq("id", local.id);
        } else {
          await db.from("calendar_items").insert({
            ...patch,
            kind: "task",
            all_day: true,
            direction_id: dir.id,
            tz: prefs.tz,
            source: "google_calendar_tasks",
          } as never);
        }
        applied += 1;
      }
      if (syncToken && syncToken !== dir.google_sync_token) {
        await db.from("calendar_directions").update({ google_sync_token: syncToken } as never).eq("id", dir.id);
      }
    }
    const { reportGoogleOk } = await import("@/lib/calendar/health.server");
    await reportGoogleOk(db);
  } catch (e) {
    if (isScopeError(e)) {
      const { reportGoogleIssue } = await import("@/lib/calendar/health.server");
      await reportGoogleIssue(db, e.detail);
      return { applied };
    }
    console.error("[planner] pull task events failed", e);
  }
  return { applied };
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
  priority?: number;
  tags?: string[];
  parent_id?: string | null;
  recurrence?: string | null;
}

export async function saveItem(db: Admin, input: SaveInput): Promise<SyncedItem> {
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
    priority: input.priority ?? 3,
    tags: input.tags ?? [],
    parent_id: input.parent_id ?? null,
    recurrence: input.recurrence ?? null,
  };
  const q = input.id
    ? db.from("calendar_items").update(payload).eq("id", input.id).select("*").single()
    : db.from("calendar_items").insert(payload).select("*").single();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const saved = data as unknown as CalItem;
  await scheduleReminders(db, saved, prefs);
  return await syncTargets(db, saved, prefs);
}

export async function setStatus(db: Admin, id: string, status: CalItem["status"]): Promise<SyncedItem | null> {
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
  if (status === "canceled") {
    await removeFromGoogle(db, item);
    await removeFromTasks(db, item);
    return item;
  }
  return await syncTargets(db, item, prefs);
}

/** Перенос — только по явной команде пользователя. */
export async function rescheduleItem(db: Admin, id: string, startsAtIso: string): Promise<SyncedItem | null> {
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
  return await syncTargets(db, updated, prefs);
}

export async function deleteItem(db: Admin, id: string): Promise<void> {
  const item = await getItem(db, id);
  if (!item) return;
  await removeFromGoogle(db, item);
  await removeFromTasks(db, item);
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
