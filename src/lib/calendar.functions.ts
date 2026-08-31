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

/** Записи за произвольный диапазон — источник данных для календаря (день/неделя/месяц/год). */
export const listPlannerRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ from: z.string().min(4), to: z.string().min(4) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ items: CalItem[] }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, listItemsBetween } = await import("@/lib/calendar/store.server");
    const items = await listItemsBetween(
      await admin(),
      new Date(data.from).toISOString(),
      new Date(data.to).toISOString(),
    );
    return { items };
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
        owner_name: z.string().max(80).nullable().optional(),
        tone: z.enum(["dry", "friendly", "fun"]).optional(),
        voice_reply: z.boolean().optional(),
        brain_enabled: z.boolean().optional(),
        visuals_enabled: z.boolean().optional(),
        visual_mode: z.enum(["image", "text"]).optional(),
        digest_visual: z.boolean().optional(),
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
    if (Object.keys(patch).length) await db.from("assistant_prefs").update(patch as never).eq("id", 1);
    return getPrefs(db);
  });

/** Аналитика планера за N дней: нагрузка по направлениям, просрочки, переносы. */
export const plannerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(7).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context as never, "orders.manage");
    const { admin, computeAnalytics } = await import("@/lib/calendar/store.server");
    return computeAnalytics(await admin(), data.days);
  });

/** Разбить крупную задачу на шаги через ИИ — создаются подзадачи с тем же дедлайном. */
export const splitPlannerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ created: number }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getItem, saveItem } = await import("@/lib/calendar/store.server");
    const { splitTaskIntoSteps } = await import("@/lib/calendar/parse.server");
    const db = await admin();
    const item = await getItem(db, data.id);
    if (!item) throw new Error("Запись не найдена");
    const steps = await splitTaskIntoSteps(item.title, item.notes);
    if (!steps.length) throw new Error("Не удалось разбить задачу на шаги");
    const due = item.due_at ?? item.starts_at;
    const nowMs = Date.now();
    const dueMs = due ? new Date(due).getTime() : null;
    for (let idx = 0; idx < steps.length; idx++) {
      // Шаги разносим равномерно от сейчас до дедлайна (последний — к дедлайну).
      const stepDue =
        dueMs && dueMs > nowMs
          ? new Date(nowMs + ((dueMs - nowMs) * (idx + 1)) / steps.length).toISOString()
          : null;
      await saveItem(db, {
        kind: "task",
        title: steps[idx]!,
        notes: `Шаг ${idx + 1}/${steps.length} задачи «${item.title}»`,
        direction_id: item.direction_id,
        due_at: stepDue,
        importance: item.importance,
        source: "split",
      });
    }
    return { created: steps.length };
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

/** Статус отдельного Telegram-бота планера: кто подключён и жив ли вебхук. */
export const plannerBotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    configured: boolean;
    ownBot: boolean;
    username: string | null;
    webhookUrl: string | null;
    pending: number;
    lastError: string | null;
    chatId: number | null;
    allowedChatIds: number[];
  }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getPrefs } = await import("@/lib/calendar/store.server");
    const { plannerHasOwnBot, plannerTgKey, tgGetMe, tgWebhookInfo } = await import("@/lib/calendar/telegram.server");
    const prefs = await getPrefs(await admin());
    if (!plannerTgKey()) {
      return { configured: false, ownBot: false, username: null, webhookUrl: null, pending: 0, lastError: null, chatId: prefs.tg_chat_id, allowedChatIds: prefs.tg_allowed_chat_ids };
    }
    const [me, hook] = await Promise.all([tgGetMe(), tgWebhookInfo()]);
    return {
      configured: true,
      ownBot: plannerHasOwnBot(),
      username: me?.username ?? null,
      webhookUrl: hook?.url ?? null,
      pending: hook?.pending_update_count ?? 0,
      lastError: hook?.last_error_message ?? null,
      chatId: prefs.tg_chat_id,
      allowedChatIds: prefs.tg_allowed_chat_ids,
    };
  });

/** Тестовое сообщение от бота планера — проверка связи из админки. */
export const plannerBotTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: boolean; reason: string | null }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getPrefs } = await import("@/lib/calendar/store.server");
    const { tgSend } = await import("@/lib/calendar/telegram.server");
    const prefs = await getPrefs(await admin());
    if (!prefs.tg_chat_id) return { sent: false, reason: "Чат не привязан — напишите боту /start" };
    const res = await tgSend(prefs.tg_chat_id, "✅ Связь с планером работает. Напишите /today, чтобы получить план на сегодня.");
    return { sent: Boolean(res), reason: res ? null : "Telegram не принял сообщение — проверьте подключение" };
  });

/** Перерегистрация вебхука бота планера на публичный адрес проекта. */
export const plannerBotRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; url: string }> => {
    await assertPermission(context as never, "orders.manage");
    const { createHash } = await import("crypto");
    const { plannerTgKey, tgSetWebhook } = await import("@/lib/calendar/telegram.server");
    const key = plannerTgKey();
    if (!key) throw new Error("Бот планера не подключён");
    const url = `${data.origin.replace(/\/$/, "")}/api/public/planner/telegram`;
    const secret = createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
    const ok = await tgSetWebhook(url, secret);
    return { ok, url };
  });

/** Настройки голосового навыка Алисы: код привязки, привязанные аккаунты, push. */
export const alicePrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    skillId: string | null;
    linkCode: string | null;
    linkedCount: number;
    pushEnabled: boolean;
    pushConfigured: boolean;
    mirrorTg: boolean;
    webhookPath: string;
  }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getPrefs } = await import("@/lib/calendar/store.server");
    const { alicePushConfigured } = await import("@/lib/calendar/alice.server");
    const prefs = await getPrefs(await admin());
    return {
      skillId: prefs.alice_skill_id,
      linkCode: prefs.alice_link_code,
      linkedCount: prefs.alice_user_ids.length,
      pushEnabled: prefs.alice_push_enabled,
      pushConfigured: alicePushConfigured(),
      mirrorTg: prefs.alice_mirror_tg,
      webhookPath: "/api/public/planner/alice",
    };
  });

/** Сохранение настроек Алисы; при generateCode выдаётся новый код привязки. */
export const saveAlicePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        skillId: z.string().max(120).nullable().optional(),
        pushEnabled: z.boolean().optional(),
        mirrorTg: z.boolean().optional(),
        generateCode: z.boolean().optional(),
        unlinkAll: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ linkCode: string | null; linkedCount: number }> => {
    await assertPermission(context as never, "orders.manage");
    const { admin, getPrefs } = await import("@/lib/calendar/store.server");
    const db = await admin();
    const patch: Record<string, unknown> = {};
    if (data.skillId !== undefined) patch.alice_skill_id = data.skillId || null;
    if (data.pushEnabled !== undefined) patch.alice_push_enabled = data.pushEnabled;
    if (data.mirrorTg !== undefined) patch.alice_mirror_tg = data.mirrorTg;
    if (data.generateCode) patch.alice_link_code = String(Math.floor(1000 + Math.random() * 9000));
    if (data.unlinkAll) patch.alice_user_ids = [];
    if (Object.keys(patch).length) await db.from("assistant_prefs").update(patch as never).eq("id", 1);
    const prefs = await getPrefs(db);
    return { linkCode: prefs.alice_link_code, linkedCount: prefs.alice_user_ids.length };
  });
