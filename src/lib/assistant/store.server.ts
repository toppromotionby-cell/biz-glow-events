// Хранилище бота-помощника: привязки чатов, коды, настройки, журнал, лимиты. Только сервер.
import { randomBytes } from "crypto";
import { isStaffRoles, permissionsForRoles, type Permission } from "@/lib/permissions";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* --------------------------------- настройки --------------------------------- */

export interface AssistantSettings {
  admin_chat_id: number | null;
  allow_web_search: boolean;
  plan_only: boolean;
  daily_limit: number;
  hygiene_enabled: boolean;
  hygiene_hour: number;
  hygiene_notify: boolean;
  last_hygiene_at: string | null;
}

const DEFAULTS: AssistantSettings = {
  admin_chat_id: null,
  allow_web_search: true,
  plan_only: false,
  daily_limit: 200,
  hygiene_enabled: true,
  hygiene_hour: 9,
  hygiene_notify: true,
  last_hygiene_at: null,
};

export async function getSettings(): Promise<AssistantSettings> {
  const db = await admin();
  const { data } = await db.from("assistant_bot_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULTS, ...((data ?? {}) as Partial<AssistantSettings>) };
}

export async function patchSettings(patch: Partial<AssistantSettings>): Promise<AssistantSettings> {
  const db = await admin();
  const { data, error } = await db
    .from("assistant_bot_settings")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() } as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { ...DEFAULTS, ...((data ?? {}) as Partial<AssistantSettings>) };
}

/* ------------------------------- привязка чатов ------------------------------- */

export interface AssistantLink {
  id: string;
  user_id: string;
  chat_id: number;
  tg_username: string | null;
  tg_first_name: string | null;
  muted_until: string | null;
  created_at: string;
}

export async function linkByChat(chatId: number): Promise<AssistantLink | null> {
  const db = await admin();
  const { data } = await db.from("assistant_bot_links").select("*").eq("chat_id", chatId).maybeSingle();
  return (data as AssistantLink | null) ?? null;
}

export async function allLinks(): Promise<AssistantLink[]> {
  const db = await admin();
  const { data } = await db.from("assistant_bot_links").select("*").order("created_at", { ascending: false });
  return (data ?? []) as AssistantLink[];
}

export async function unlinkChat(chatId: number): Promise<void> {
  const db = await admin();
  await db.from("assistant_bot_links").delete().eq("chat_id", chatId);
}

export async function setMuted(chatId: number, until: Date | null): Promise<void> {
  const db = await admin();
  await db
    .from("assistant_bot_links")
    .update({ muted_until: until ? until.toISOString() : null })
    .eq("chat_id", chatId);
}

/** Код привязки, действует 15 минут. */
export async function issueLinkCode(userId: string): Promise<string> {
  const db = await admin();
  const code = randomBytes(4).toString("hex").toUpperCase();
  const { error } = await db.from("assistant_bot_codes").insert({
    code,
    user_id: userId,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export async function redeemLinkCode(
  code: string,
  chat: { id: number; username?: string | null; first_name?: string | null },
): Promise<string | null> {
  const db = await admin();
  const normalized = code.trim().toUpperCase();
  const { data } = await db
    .from("assistant_bot_codes")
    .select("*")
    .eq("code", normalized)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await db.from("assistant_bot_codes").update({ used_at: new Date().toISOString() }).eq("code", normalized);
  const userId = (data as { user_id: string }).user_id;
  const { error } = await db.from("assistant_bot_links").upsert(
    {
      user_id: userId,
      chat_id: chat.id,
      tg_username: chat.username ?? null,
      tg_first_name: chat.first_name ?? null,
    } as never,
    { onConflict: "chat_id" },
  );
  if (error) throw new Error(error.message);
  return userId;
}

/* -------------------------------- личность/права -------------------------------- */

export interface Identity {
  chatId: number;
  userId: string | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  muted: boolean;
  perms: Set<Permission>;
}

export async function identify(chatId: number): Promise<Identity> {
  const link = await linkByChat(chatId);
  if (!link) {
    return { chatId, userId: null, roles: [], isStaff: false, isAdmin: false, muted: false, perms: new Set() };
  }
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", link.user_id);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  return {
    chatId,
    userId: link.user_id,
    roles,
    isStaff: isStaffRoles(roles),
    isAdmin: roles.includes("admin"),
    muted: Boolean(link.muted_until && new Date(link.muted_until) > new Date()),
    perms: permissionsForRoles(roles),
  };
}

export function can(who: Identity, perm: Permission): boolean {
  return who.perms.has(perm);
}

/* -------------------------------- дедупликация -------------------------------- */

/** true — обновление новое и его нужно обработать. */
export async function claimUpdate(updateId: number): Promise<boolean> {
  const db = await admin();
  const { error } = await db.from("assistant_bot_updates").insert({ update_id: updateId });
  return !error;
}

/* ---------------------------------- журнал ----------------------------------- */

export async function logMessage(entry: {
  chatId: number;
  userId?: string | null;
  direction: "in" | "out";
  kind?: string;
  text?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("assistant_bot_messages").insert({
      chat_id: entry.chatId,
      user_id: entry.userId ?? null,
      direction: entry.direction,
      kind: entry.kind ?? "text",
      text: entry.text ?? null,
      meta: (entry.meta ?? {}) as never,
    });
  } catch (e) {
    console.error("[assistant] log failed", e instanceof Error ? e.message : e);
  }
}

/** Последние сообщения диалога для контекста модели (в хронологическом порядке). */
export async function recentDialog(chatId: number, limit = 12): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const db = await admin();
  const { data } = await db
    .from("assistant_bot_messages")
    .select("direction, text")
    .eq("chat_id", chatId)
    .eq("kind", "text")
    .not("text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { direction: string; text: string }[])
    .reverse()
    .map((r) => ({ role: r.direction === "in" ? ("user" as const) : ("assistant" as const), content: r.text }));
}

/** Сброс контекста: помечаем прошлые сообщения как несчитываемые. */
export async function resetDialog(chatId: number): Promise<void> {
  const db = await admin();
  await db.from("assistant_bot_messages").update({ kind: "archived" }).eq("chat_id", chatId).eq("kind", "text");
}

/** Простой суточный лимит запросов к модели на чат. */
export async function withinDailyLimit(chatId: number, limit: number): Promise<boolean> {
  const db = await admin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db
    .from("assistant_bot_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("direction", "in")
    .gte("created_at", since);
  return (count ?? 0) < limit;
}

/* ------------------------------- аудит выдачи файлов ------------------------------- */

export async function logFileGrant(entry: {
  userId: string | null;
  chatId: number;
  kind: string;
  docId: string;
  filename: string;
  internal: boolean;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("assistant_file_grants").insert({
      user_id: entry.userId,
      chat_id: entry.chatId,
      kind: entry.kind,
      doc_id: entry.docId,
      filename: entry.filename,
      internal: entry.internal,
    });
  } catch (e) {
    console.error("[assistant] file grant log failed", e instanceof Error ? e.message : e);
  }
}
