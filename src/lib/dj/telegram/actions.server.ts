// Действия DJ-бота поверх существующих серверных модулей.
// Каждое действие сначала проверяет роль пользователя, привязанного к чату.
import { loadDjAccess, type DjAccess } from "@/lib/dj/guard.server";
import { deleteTrack, moderateTrack } from "@/lib/dj/moderation.server";
import { listMembers, setMemberStatus, djStats } from "@/lib/dj/members.server";
import type { DjMemberStatus } from "@/lib/dj/types";
import { admin, linkByChat } from "./store.server";
import type { TrackCard } from "./cards";

export type BotRole = "admin" | "trusted" | "member" | "guest";

export interface BotIdentity {
  chatId: number;
  userId: string | null;
  access: DjAccess | null;
  role: BotRole;
}

export async function identify(chatId: number): Promise<BotIdentity> {
  const link = await linkByChat(chatId);
  if (!link) return { chatId, userId: null, access: null, role: "guest" };
  const access = await loadDjAccess(link.user_id);
  const role: BotRole = access.isManager
    ? "admin"
    : access.isTrusted
      ? "trusted"
      : access.isMember
        ? "member"
        : "guest";
  return { chatId, userId: link.user_id, access, role };
}

export class BotForbidden extends Error {
  constructor(message = "Действие доступно только администратору диджей-раздела") {
    super(message);
  }
}

function requireAdmin(who: BotIdentity): DjAccess {
  if (who.role !== "admin" || !who.access) throw new BotForbidden();
  return who.access;
}

const TRACK_COLS =
  "id, artist, title, version, is_remix, remixer, genre, bpm, key_camelot, duration_sec, language, section, status, download_count, rating_avg, created_at, uploaded_by, artwork_path";

export async function pendingTracks(who: BotIdentity, limit = 5): Promise<TrackCard[]> {
  requireAdmin(who);
  const db = await admin();
  const { data } = await db
    .from("dj_tracks")
    .select(TRACK_COLS)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as TrackCard[];
}

export async function findTracks(who: BotIdentity, query: string, limit = 5): Promise<TrackCard[]> {
  if (who.role === "guest") throw new BotForbidden("Сначала привяжите аккаунт: /start");
  const db = await admin();
  const q = query.trim().replace(/[%,]/g, " ");
  let req = db.from("dj_tracks").select(TRACK_COLS).limit(limit).order("created_at", { ascending: false });
  if (q) req = req.or(`artist.ilike.%${q}%,title.ilike.%${q}%,remixer.ilike.%${q}%`);
  if (who.role !== "admin") req = req.eq("status", "published");
  const { data } = await req;
  return (data ?? []) as unknown as TrackCard[];
}

export async function getTrackCard(id: string): Promise<TrackCard | null> {
  const db = await admin();
  const { data } = await db.from("dj_tracks").select(TRACK_COLS).eq("id", id).maybeSingle();
  return (data as unknown as TrackCard) ?? null;
}

/** Подписанная ссылка на обложку — Telegram скачает её сам. */
export async function trackArtworkUrl(id: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("dj_tracks").select("artwork_path").eq("id", id).maybeSingle();
  const path = (data as { artwork_path?: string | null } | null)?.artwork_path;
  if (!path) return null;
  const { data: signed } = await db.storage.from("dj-artwork").createSignedUrl(path, 3600);
  return signed?.signedUrl ?? null;
}

export async function trackAudioPreviewUrl(id: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("dj_tracks").select("audio_path").eq("id", id).maybeSingle();
  const path = (data as { audio_path?: string | null } | null)?.audio_path;
  if (!path) return null;
  const { data: signed } = await db.storage.from("dj-audio").createSignedUrl(path, 3600);
  return signed?.signedUrl ?? null;
}

export async function moderate(
  who: BotIdentity,
  id: string,
  status: "published" | "rejected",
  reason?: string,
): Promise<TrackCard | null> {
  requireAdmin(who);
  await moderateTrack(id, status, reason);
  return getTrackCard(id);
}

export async function removeTrack(who: BotIdentity, id: string): Promise<void> {
  requireAdmin(who);
  await deleteTrack(id);
}

export async function members(who: BotIdentity, status?: DjMemberStatus | "all") {
  requireAdmin(who);
  return listMembers(status ?? "pending");
}

export async function memberById(id: string) {
  const db = await admin();
  const { data } = await db.from("dj_members").select("*").eq("id", id).maybeSingle();
  return data as
    | { id: string; user_id: string; nickname: string; city: string | null; bio: string | null; contact: string | null; status: DjMemberStatus }
    | null;
}

export async function setMember(who: BotIdentity, id: string, status: DjMemberStatus) {
  const access = requireAdmin(who);
  await setMemberStatus(access, id, status);
  return memberById(id);
}

export async function stats(who: BotIdentity, days = 7) {
  requireAdmin(who);
  const db = await admin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [base, uploads, downloads, newMembers, pendingMembers] = await Promise.all([
    djStats(),
    db.from("dj_tracks").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("dj_downloads").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("dj_members").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("dj_members").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    tracks: base.tracks,
    members: base.members,
    topTracks: base.topTracks,
    uploads: uploads.count ?? 0,
    downloads: downloads.count ?? 0,
    newMembers: newMembers.count ?? 0,
    pendingMembers: pendingMembers.count ?? 0,
    pendingTracks: base.tracks?.["pending"] ?? 0,
  };
}

/** «Спящие» треки: опубликованы давно и ни разу не скачивались. */
export async function dormant(who: BotIdentity, days = 180, limit = 20): Promise<TrackCard[]> {
  requireAdmin(who);
  const db = await admin();
  const before = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("dj_tracks")
    .select(TRACK_COLS)
    .eq("status", "published")
    .lte("created_at", before)
    .lte("download_count", 0)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as TrackCard[];
}

export async function packByName(who: BotIdentity, name: string) {
  if (who.role === "guest") throw new BotForbidden("Сначала привяжите аккаунт: /start");
  const db = await admin();
  const { data: pack } = await db
    .from("dj_packs")
    .select("id, title, description")
    .ilike("title", `%${name.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!pack) return null;
  const { data: items } = await db
    .from("dj_pack_items")
    .select("track_id, position, dj_tracks(artist, title)")
    .eq("pack_id", pack.id)
    .order("position");
  return { pack, items: (items ?? []) as unknown as { dj_tracks?: { artist: string; title: string } }[] };
}
