// Хранилище DJ-бота: привязки чатов, коды, настройки, очередь исходящих. Только сервер.
import { randomBytes } from "crypto";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface DjTgSettings {
  group_chat_id: number | null;
  admin_chat_id: number | null;
  notify_applications: boolean;
  notify_tracks: boolean;
  notify_rejects: boolean;
  notify_digest: boolean;
  announce_publications: boolean;
  daily_digest_hour: number;
  weekly_digest_dow: number;
  last_daily_at: string | null;
  last_weekly_at: string | null;
  last_reject_digest_at: string | null;
}

const DEFAULTS: DjTgSettings = {
  group_chat_id: null,
  admin_chat_id: null,
  notify_applications: true,
  notify_tracks: true,
  notify_rejects: true,
  notify_digest: true,
  announce_publications: true,
  daily_digest_hour: 10,
  weekly_digest_dow: 1,
  last_daily_at: null,
  last_weekly_at: null,
  last_reject_digest_at: null,
};

export async function getSettings(): Promise<DjTgSettings> {
  const db = await admin();
  const { data } = await db.from("dj_tg_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULTS, ...(data ?? {}) } as DjTgSettings;
}

export async function patchSettings(patch: Partial<DjTgSettings>): Promise<DjTgSettings> {
  const db = await admin();
  const { data, error } = await db
    .from("dj_tg_settings")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { ...DEFAULTS, ...(data ?? {}) } as DjTgSettings;
}

/* ------------------------------- привязка чатов ------------------------------- */

export interface DjTgLink {
  id: string;
  user_id: string;
  chat_id: number;
  tg_username: string | null;
  tg_first_name: string | null;
  muted_until: string | null;
}

export async function linkByChat(chatId: number): Promise<DjTgLink | null> {
  const db = await admin();
  const { data } = await db.from("dj_tg_links").select("*").eq("chat_id", chatId).maybeSingle();
  return (data as DjTgLink | null) ?? null;
}

export async function linksByUser(userId: string): Promise<DjTgLink[]> {
  const db = await admin();
  const { data } = await db.from("dj_tg_links").select("*").eq("user_id", userId);
  return (data ?? []) as DjTgLink[];
}

export async function unlinkChat(chatId: number): Promise<void> {
  const db = await admin();
  await db.from("dj_tg_links").delete().eq("chat_id", chatId);
}

export async function setMuted(chatId: number, until: Date | null): Promise<void> {
  const db = await admin();
  await db.from("dj_tg_links").update({ muted_until: until ? until.toISOString() : null }).eq("chat_id", chatId);
}

/** Создание кода привязки для пользователя (действует 15 минут). */
export async function issueLinkCode(userId: string): Promise<string> {
  const db = await admin();
  const code = randomBytes(4).toString("hex").toUpperCase();
  const { error } = await db.from("dj_tg_link_codes").insert({
    code,
    user_id: userId,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

/** Погашение кода: привязывает чат к пользователю. */
export async function redeemLinkCode(
  code: string,
  chat: { id: number; username?: string | null; first_name?: string | null },
): Promise<string | null> {
  const db = await admin();
  const normalized = code.trim().toUpperCase();
  const { data } = await db
    .from("dj_tg_link_codes")
    .select("*")
    .eq("code", normalized)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await db.from("dj_tg_link_codes").update({ used_at: new Date().toISOString() }).eq("code", normalized);
  const { error } = await db.from("dj_tg_links").upsert(
    {
      user_id: data.user_id,
      chat_id: chat.id,
      tg_username: chat.username ?? null,
      tg_first_name: chat.first_name ?? null,
    },
    { onConflict: "chat_id" },
  );
  if (error) throw new Error(error.message);
  return data.user_id as string;
}

/* -------------------------------- дедупликация -------------------------------- */

/** true — обновление новое и его нужно обработать. */
export async function claimUpdate(updateId: number): Promise<boolean> {
  const db = await admin();
  const { error } = await db.from("dj_tg_updates").insert({ update_id: updateId });
  if (error) return false; // конфликт первичного ключа — уже обработано
  return true;
}

/* ---------------------------------- очередь ----------------------------------- */

export type OutboxKind =
  | "member_application"
  | "track_pending"
  | "track_published"
  | "reject_digest"
  | "daily_digest"
  | "weekly_digest"
  | "text";

export interface OutboxRow {
  id: string;
  kind: OutboxKind;
  chat_id: number | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function enqueue(
  kind: OutboxKind,
  payload: Record<string, unknown>,
  chatId?: number | null,
): Promise<void> {
  try {
    const db = await admin();
    await db.from("dj_tg_outbox").insert({ kind, payload, chat_id: chatId ?? null });
  } catch (e) {
    // Уведомление не должно ронять основную операцию.
    console.error("[dj-tg] enqueue failed", e instanceof Error ? e.message : e);
  }
}

export async function takePending(limit = 20): Promise<OutboxRow[]> {
  const db = await admin();
  const { data } = await db
    .from("dj_tg_outbox")
    .select("*")
    .eq("status", "pending")
    .lte("send_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as OutboxRow[];
}

export async function markSent(id: string): Promise<void> {
  const db = await admin();
  await db.from("dj_tg_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
}

export async function markFailed(id: string, attempts: number, error: string): Promise<void> {
  const db = await admin();
  const giveUp = attempts + 1 >= 5;
  await db
    .from("dj_tg_outbox")
    .update({
      status: giveUp ? "failed" : "pending",
      attempts: attempts + 1,
      last_error: error.slice(0, 500),
      send_after: new Date(Date.now() + Math.min(30, 2 ** attempts) * 60_000).toISOString(),
    })
    .eq("id", id);
}

export async function recentOutbox(limit = 50): Promise<OutboxRow[]> {
  const db = await admin();
  const { data } = await db
    .from("dj_tg_outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as OutboxRow[];
}

/** Чаты админов: все привязки, чьи пользователи управляют DJ-разделом. */
export async function adminChats(): Promise<number[]> {
  const db = await admin();
  const { data: links } = await db.from("dj_tg_links").select("chat_id, user_id, muted_until");
  const rows = (links ?? []) as { chat_id: number; user_id: string; muted_until: string | null }[];
  if (!rows.length) {
    const s = await getSettings();
    return s.admin_chat_id ? [s.admin_chat_id] : [];
  }
  const now = Date.now();
  const out: number[] = [];
  for (const r of rows) {
    if (r.muted_until && new Date(r.muted_until).getTime() > now) continue;
    const { data: can } = await db.rpc("dj_can_manage", { _uid: r.user_id });
    if (can) out.push(r.chat_id);
  }
  if (!out.length) {
    const s = await getSettings();
    if (s.admin_chat_id) out.push(s.admin_chat_id);
  }
  return out;
}
