// Серверные функции планера для админки. Доступ — право orders.manage.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/authz";
import type { AssistantPrefs, CalDirection, CalItem } from "@/lib/calendar/model";

const iso = z.string().datetime({ offset: true }).nullable().optional();

export const listPlannerData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: z.string().min(4), to: z.string().min(4) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{
    items: CalItem[];
    directions: CalDirection[];
    prefs: AssistantPrefs;
    inbox: Array<{ id: string; raw_text: string | null; question: string | null; status: string; created_at: string }>;
    googleConnected: boolean;
  }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getDirections, getPrefs, listItemsBetween } = await import("@/lib/calendar/store.server");
    const { googleConfigured } = await import("@/lib/calendar/google.server");
    const db = await admin();
    const [items, directions, prefs] = await Promise.all([
      listItemsBetween(db, new Date(data.from).toISOString(), new Date(data.to).toISOString()),
      getDirections(db),
      getPrefs(db),
    ]);
    const { data: inbox } = await db
      .from("calendar_inbox")
      .select("id, raw_text, question, status, created_at")
      .in("status", ["clarify", "error"])
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      items,
      directions,
      prefs,
      inbox: (inbox ?? []) as never,
      googleConnected: googleConfigured(),
    };
  });

export const savePlannerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        kind: z.enum(["task", "meeting"]),
        title: z.string().min(1).max(200),
        notes: z.string().max(4000).nullable().optional(),
        direction_id: z.string().uuid().nullable().optional(),
        starts_at: iso,
        ends_at: iso,
        due_at: iso,
        all_day: z.boolean().optional(),
        tz: z.string().max(60).optional(),
        status: z.enum(["planned", "in_progress", "done", "canceled"]).optional(),
        importance: z.enum(["normal", "hard"]).optional(),
        location: z.string().max(300).nullable().optional(),
        participants: z.array(z.string().max(120)).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CalItem> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, saveItem } = await import("@/lib/calendar/store.server");
    return saveItem(await admin(), { ...data, source: "web" });
  });

export const setPlannerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["planned", "in_progress", "done", "canceled"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CalItem | null> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, setStatus } = await import("@/lib/calendar/store.server");
    return setStatus(await admin(), data.id, data.status);
  });

export const reschedulePlannerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), starts_at: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }): Promise<CalItem | null> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, rescheduleItem } = await import("@/lib/calendar/store.server");
    return rescheduleItem(await admin(), data.id, new Date(data.starts_at).toISOString());
  });

export const deletePlannerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, deleteItem } = await import("@/lib/calendar/store.server");
    await deleteItem(await admin(), data.id);
    return { ok: true };
  });

export const savePlannerDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z.string().min(1).max(40),
        title: z.string().min(1).max(80),
        color: z.string().max(20).default("#6366f1"),
        google_color_id: z.string().max(5).nullable().optional(),
        emoji: z.string().max(8).nullable().optional(),
        keywords: z.array(z.string().max(60)).max(40).default([]),
        work_start: z.string().max(8).default("09:00"),
        work_end: z.string().max(8).default("19:00"),
        sort: z.number().int().min(0).max(999).default(0),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CalDirection> => {
    await assertPermission(context as never, "orders.manage");
    const { admin } = await import("@/lib/calendar/store.server");
    const db = await admin();
    const q = data.id
      ? db.from("calendar_directions").update(data).eq("id", data.id).select("*").single()
      : db.from("calendar_directions").insert(data).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row as unknown as CalDirection;
  });

export const savePlannerPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tz: z.string().max(60).optional(),
        tg_chat_id: z.number().int().nullable().optional(),
        morning_time: z.string().max(8).optional(),
        evening_time: z.string().max(8).optional(),
        quiet_start: z.string().max(8).optional(),
        quiet_end: z.string().max(8).optional(),
        reminder_minutes: z.array(z.number().int().min(0).max(2880)).max(6).optional(),
        hard_reminder_minutes: z.array(z.number().int().min(0).max(2880)).max(6).optional(),
        followup_minutes: z.number().int().min(0).max(1440).optional(),
        style_profile: z.string().max(1000).nullable().optional(),
        device_tz: z.string().max(60).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<AssistantPrefs> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getPrefs } = await import("@/lib/calendar/store.server");
    const db = await admin();
    const { device_tz, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    // Часовой пояс берём с устройства пользователя, если он не задан вручную.
    if (device_tz) {
      patch.last_device_tz = device_tz;
      if (!rest.tz) patch.tz = device_tz;
    }
    if (Object.keys(patch).length) await db.from("assistant_prefs").update(patch).eq("id", 1);
    return getPrefs(db);
  });

/** Ручная синхронизация с Google из интерфейса. */
export const syncPlannerGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ applied: number; configured: boolean }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, pullFromGoogle } = await import("@/lib/calendar/store.server");
    const { googleConfigured } = await import("@/lib/calendar/google.server");
    if (!googleConfigured()) return { applied: 0, configured: false };
    const res = await pullFromGoogle(await admin());
    return { applied: res.applied, configured: true };
  });
