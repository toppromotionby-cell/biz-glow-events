// Постановка событий диджей-раздела в очередь Telegram и их доставка.
import { announceCard, digestCard, memberButtons, memberCard, rejectDigestCard, trackButtons, trackCard } from "./cards";
import { getTrackCard, memberById, trackArtworkUrl } from "./actions.server";
import {
  adminChats,
  admin,
  enqueue,
  getSettings,
  markFailed,
  markSent,
  patchSettings,
  takePending,
  type OutboxRow,
} from "./store.server";
import { djBotConfigured, tgSend, tgSendPhoto } from "./transport.server";

/* ------------------------------- постановка ---------------------------------- */

export async function notifyApplication(memberId: string): Promise<void> {
  await enqueue("member_application", { memberId });
}

export async function notifyTrackPending(trackId: string): Promise<void> {
  await enqueue("track_pending", { trackId });
}

export async function notifyTrackPublished(trackId: string): Promise<void> {
  await enqueue("track_published", { trackId });
}

/** Тихо отклонённая загрузка — копится и уходит часовой сводкой. */
export async function notifyIngestReject(reason: string, fileName?: string): Promise<void> {
  await enqueue("reject_digest", { reason, fileName: fileName ?? null });
}

/* -------------------------------- доставка ----------------------------------- */

async function targets(): Promise<number[]> {
  return adminChats();
}

async function deliver(row: OutboxRow): Promise<void> {
  const s = await getSettings();
  const payload = row.payload ?? {};

  if (row.kind === "member_application") {
    if (!s.notify_applications) return;
    const m = await memberById(String(payload["memberId"] ?? ""));
    if (!m) return;
    for (const chat of await targets()) await tgSend(chat, memberCard(m), memberButtons(m.id));
    return;
  }

  if (row.kind === "track_pending") {
    if (!s.notify_tracks) return;
    const t = await getTrackCard(String(payload["trackId"] ?? ""));
    if (!t) return;
    const card = trackCard(t, { header: "Новый трек на модерации" });
    const buttons = trackButtons(t.id, t.status ?? null);
    const art = await trackArtworkUrl(t.id);
    for (const chat of await targets()) {
      if (art) await tgSendPhoto(chat, art, card, buttons);
      else await tgSend(chat, card, buttons);
    }
    return;
  }

  if (row.kind === "track_published") {
    if (!s.announce_publications || !s.group_chat_id) return;
    const t = await getTrackCard(String(payload["trackId"] ?? ""));
    if (!t) return;
    const art = await trackArtworkUrl(t.id);
    if (art) await tgSendPhoto(s.group_chat_id, art, announceCard(t));
    else await tgSend(s.group_chat_id, announceCard(t));
    return;
  }

  if (row.kind === "text") {
    const chat = row.chat_id ?? (await targets())[0];
    if (chat) await tgSend(chat, String(payload["text"] ?? ""));
    return;
  }
}

/** Разбор очереди: обычные события. Сводки отклонений собираются отдельно. */
export async function drainOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!djBotConfigured()) return { sent: 0, failed: 0 };
  const rows = (await takePending(limit)).filter((r) => r.kind !== "reject_digest");
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await deliver(row);
      await markSent(row.id);
      sent += 1;
    } catch (e) {
      await markFailed(row.id, row.attempts, e instanceof Error ? e.message : String(e));
      failed += 1;
    }
  }
  return { sent, failed };
}

/** Часовая сводка тихих отклонений при загрузке. */
export async function flushRejectDigest(): Promise<boolean> {
  const s = await getSettings();
  if (!s.notify_rejects) return false;
  const last = s.last_reject_digest_at ? new Date(s.last_reject_digest_at).getTime() : 0;
  if (Date.now() - last < 55 * 60_000) return false;

  const db = await admin();
  const { data } = await db
    .from("dj_tg_outbox")
    .select("id, payload")
    .eq("kind", "reject_digest")
    .eq("status", "pending")
    .limit(200);
  const rows = (data ?? []) as unknown as { id: string; payload: Record<string, unknown> }[];
  if (!rows.length) return false;

  const reasons: Record<string, number> = {};
  for (const r of rows) {
    const reason = String(r.payload?.["reason"] ?? "неизвестная причина");
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  const text = rejectDigestCard(reasons, rows.length);
  for (const chat of await targets()) await tgSend(chat, text);
  await db
    .from("dj_tg_outbox")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .in("id", rows.map((r) => r.id));
  await patchSettings({ last_reject_digest_at: new Date().toISOString() });
  return true;
}

/* --------------------------------- сводки ------------------------------------ */

function minskNow(): { hour: number; dow: number; dayKey: string } {
  const now = new Date();
  const minsk = new Date(now.getTime() + 3 * 3600_000); // UTC+3 круглый год
  return {
    hour: minsk.getUTCHours(),
    dow: minsk.getUTCDay(),
    dayKey: minsk.toISOString().slice(0, 10),
  };
}

async function collect(days: number, period: string) {
  const db = await admin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [pendingTracks, pendingMembers, uploads, downloads, newMembers, top] = await Promise.all([
    db.from("dj_tracks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("dj_members").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("dj_tracks").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("dj_downloads").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("dj_members").select("id", { count: "exact", head: true }).gte("created_at", since),
    db
      .from("dj_tracks")
      .select("id, artist, title, download_count")
      .eq("status", "published")
      .order("download_count", { ascending: false })
      .limit(10),
  ]);
  return {
    card: digestCard({
      pendingTracks: pendingTracks.count ?? 0,
      pendingMembers: pendingMembers.count ?? 0,
      uploads: uploads.count ?? 0,
      downloads: downloads.count ?? 0,
      newMembers: newMembers.count ?? 0,
      period,
    }),
    top: (top.data ?? []) as { artist: string; title: string; download_count: number | null }[],
  };
}

/** Ежедневный дайджест админам и недельный — в чат диджеев. */
export async function runDigests(): Promise<{ daily: boolean; weekly: boolean }> {
  const s = await getSettings();
  if (!s.notify_digest) return { daily: false, weekly: false };
  const { hour, dow, dayKey } = minskNow();
  let daily = false;
  let weekly = false;

  if (hour >= s.daily_digest_hour && (s.last_daily_at ?? "").slice(0, 10) !== dayKey) {
    const { card } = await collect(1, "сутки");
    for (const chat of await targets()) await tgSend(chat, card);
    await patchSettings({ last_daily_at: new Date().toISOString() });
    daily = true;
  }

  const weeklyDue =
    dow === s.weekly_digest_dow &&
    hour >= s.daily_digest_hour &&
    (s.last_weekly_at ?? "").slice(0, 10) !== dayKey;
  if (weeklyDue) {
    const { card, top } = await collect(7, "неделя");
    const { chartUrl } = await import("./agent.server");
    const chart = chartUrl(top);
    const chats = s.group_chat_id ? [s.group_chat_id] : await targets();
    for (const chat of chats) {
      if (chart) await tgSendPhoto(chat, chart, card);
      else await tgSend(chat, card);
    }
    await patchSettings({ last_weekly_at: new Date().toISOString() });
    weekly = true;
  }
  return { daily, weekly };
}
