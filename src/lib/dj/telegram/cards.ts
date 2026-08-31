// Карточки и клавиатуры DJ-бота. Чистый модуль без обращений к сети и базе.
import { formatDuration, trackVersionLabel, MEMBER_STATUS_LABEL, type DjMemberStatus } from "@/lib/dj/types";

export interface TgButton {
  text: string;
  data: string;
}

export const SITE = "https://event-hub.by";

export function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------------------------- callback ---------------------------------- */

export type DjCallback =
  | { action: "mem"; status: DjMemberStatus; id: string }
  | { action: "trk"; op: "pub" | "rej" | "del" | "info"; id: string }
  | { action: "confirm"; op: string; id: string }
  | { action: "queue"; id: string }
  | { action: "noop"; id: string };

/** Кодирование действия в callback_data (лимит Telegram — 64 байта). */
export function encodeCb(cb: DjCallback): string {
  switch (cb.action) {
    case "mem":
      return `d:m:${cb.status.slice(0, 2)}:${cb.id}`;
    case "trk":
      return `d:t:${cb.op}:${cb.id}`;
    case "confirm":
      return `d:c:${cb.op}:${cb.id}`;
    case "queue":
      return `d:q:${cb.id}`;
    default:
      return "d:x:";
  }
}

const MEM_STATUS: Record<string, DjMemberStatus> = {
  ap: "approved",
  tr: "trusted",
  re: "rejected",
  bl: "blocked",
  pe: "pending",
};

export function decodeCb(raw: string | null | undefined): DjCallback | null {
  if (!raw || !raw.startsWith("d:")) return null;
  const parts = raw.split(":");
  const kind = parts[1];
  if (kind === "m") {
    const status = MEM_STATUS[parts[2] ?? ""];
    if (!status || !parts[3]) return null;
    return { action: "mem", status, id: parts[3] };
  }
  if (kind === "t") {
    const op = parts[2];
    if (!parts[3] || (op !== "pub" && op !== "rej" && op !== "del" && op !== "info")) return null;
    return { action: "trk", op, id: parts[3] };
  }
  if (kind === "c") {
    if (!parts[2] || !parts[3]) return null;
    return { action: "confirm", op: parts[2], id: parts[3] };
  }
  if (kind === "q") return { action: "queue", id: parts[2] ?? "" };
  if (kind === "x") return { action: "noop", id: "" };
  return null;
}

/* ---------------------------------- участники ---------------------------------- */

export interface MemberCard {
  id: string;
  nickname: string;
  city?: string | null;
  bio?: string | null;
  contact?: string | null;
  email?: string | null;
  status: DjMemberStatus;
  created_at?: string;
}

export function memberCard(m: MemberCard): string {
  const rows = [
    `🎧 <b>Заявка в диджей-пул</b>`,
    ``,
    `<b>${esc(m.nickname)}</b>`,
    m.city ? `📍 ${esc(m.city)}` : null,
    m.email ? `✉️ ${esc(m.email)}` : null,
    m.contact ? `🔗 ${esc(m.contact)}` : null,
    m.bio ? `\n${esc(m.bio).slice(0, 500)}` : null,
    ``,
    `Статус: <b>${MEMBER_STATUS_LABEL[m.status] ?? m.status}</b>`,
  ];
  return rows.filter((r) => r !== null).join("\n");
}

export function memberButtons(id: string): TgButton[][] {
  return [
    [
      { text: "✅ Одобрить", data: encodeCb({ action: "mem", status: "approved", id }) },
      { text: "⭐️ Доверенный", data: encodeCb({ action: "mem", status: "trusted", id }) },
    ],
    [
      { text: "🚫 Отклонить", data: encodeCb({ action: "mem", status: "rejected", id }) },
      { text: "⛔️ Заблокировать", data: encodeCb({ action: "mem", status: "blocked", id }) },
    ],
  ];
}

/* ------------------------------------ треки ------------------------------------ */

export interface TrackCard {
  id: string;
  artist: string;
  title: string;
  version?: string | null;
  is_remix?: boolean | null;
  remixer?: string | null;
  genre?: string | null;
  bpm?: number | null;
  key_camelot?: string | null;
  duration_sec?: number | null;
  language?: string | null;
  section?: string | null;
  status?: string | null;
  download_count?: number | null;
  rating_avg?: number | null;
  created_at?: string | null;
}

export function trackTitle(t: TrackCard): string {
  const version = trackVersionLabel({ is_remix: !!t.is_remix, remixer: t.remixer ?? null, version: t.version ?? null });
  return version ? `${t.artist} — ${t.title} (${version})` : `${t.artist} — ${t.title}`;
}

export function trackCard(t: TrackCard, opts: { header?: string } = {}): string {
  const facts = [
    t.genre ? `🎼 ${esc(t.genre)}` : null,
    t.bpm ? `⏱ ${t.bpm} BPM` : null,
    t.key_camelot ? `🎹 ${esc(t.key_camelot)}` : null,
    t.duration_sec ? `⌛️ ${formatDuration(t.duration_sec)}` : null,
    t.language ? `🗣 ${esc(t.language)}` : null,
  ].filter(Boolean);
  const stats = [
    typeof t.download_count === "number" ? `⬇️ ${t.download_count}` : null,
    t.rating_avg ? `⭐️ ${t.rating_avg}` : null,
  ].filter(Boolean);
  return [
    opts.header ? `<b>${esc(opts.header)}</b>\n` : "",
    `🎵 <b>${esc(trackTitle(t))}</b>`,
    facts.length ? facts.join(" · ") : null,
    t.section ? `Раздел: ${esc(t.section)}` : null,
    stats.length ? stats.join(" · ") : null,
  ]
    .filter((r) => r !== null && r !== "")
    .join("\n");
}

export function trackButtons(id: string, status?: string | null): TgButton[][] {
  const rows: TgButton[][] = [];
  if (status !== "published") {
    rows.push([
      { text: "✅ Опубликовать", data: encodeCb({ action: "trk", op: "pub", id }) },
      { text: "🚫 Отклонить", data: encodeCb({ action: "trk", op: "rej", id }) },
    ]);
  }
  rows.push([
    { text: "🗑 Удалить", data: encodeCb({ action: "confirm", op: "tdel", id }) },
    { text: "🔗 В админке", data: encodeCb({ action: "trk", op: "info", id }) },
  ]);
  return rows;
}

export function confirmButtons(op: string, id: string): TgButton[][] {
  return [
    [
      { text: "❗️ Да, удалить", data: encodeCb({ action: "trk", op: "del", id }) },
      { text: "Отмена", data: encodeCb({ action: "trk", op: "info", id }) },
    ],
  ];
  void op;
}

/* ----------------------------------- сводки ------------------------------------ */

export interface DigestData {
  pendingTracks: number;
  pendingMembers: number;
  uploads: number;
  downloads: number;
  newMembers: number;
  period: string;
}

export function digestCard(d: DigestData): string {
  return [
    `📊 <b>Диджей-раздел · ${esc(d.period)}</b>`,
    ``,
    `🕓 На модерации: <b>${d.pendingTracks}</b> треков, <b>${d.pendingMembers}</b> заявок`,
    `⬆️ Загружено: <b>${d.uploads}</b>`,
    `⬇️ Скачано: <b>${d.downloads}</b>`,
    `👥 Новых участников: <b>${d.newMembers}</b>`,
    ``,
    `<a href="${SITE}/admin/dj">Открыть админку</a>`,
  ].join("\n");
}

export function rejectDigestCard(reasons: Record<string, number>, total: number): string {
  const lines = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `• ${esc(reason)} — <b>${n}</b>`);
  return [`⚠️ <b>Отклонено при загрузке: ${total}</b>`, ``, ...lines].join("\n");
}

export function announceCard(t: TrackCard): string {
  return [
    `🔥 <b>Новинка в библиотеке</b>`,
    ``,
    trackCard(t),
    ``,
    `<a href="${SITE}/dj/pool">Слушать и скачать</a>`,
  ].join("\n");
}

/** Простая моноширинная таблица для длинных ответов. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => (c ?? "").padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return `<pre>${esc([line(headers), ...rows.map(line)].join("\n"))}</pre>`;
}

export function helpText(role: "admin" | "trusted" | "member" | "guest"): string {
  if (role === "guest") {
    return [
      `👋 Это бот диджей-раздела <b>event-hub.by</b>.`,
      ``,
      `Чтобы пользоваться ботом, привяжите аккаунт: откройте <a href="${SITE}/dj">event-hub.by/dj</a> → «Привязать Telegram» и пришлите сюда полученный код.`,
    ].join("\n");
  }
  const common = [
    `/track &lt;поиск&gt; — найти трек`,
    `/stats [день|неделя|месяц] — статистика`,
    `/mute, /unmute — уведомления`,
  ];
  const admin = [
    `/queue [n] — очередь модерации`,
    `/members [pending|approved|trusted] — участники`,
    `/hygiene — спящий контент и чистка`,
    `/pack &lt;название&gt; — состав пака`,
  ];
  return [
    `🎧 <b>Команды</b>`,
    ``,
    ...(role === "admin" ? admin : []),
    ...common,
    ``,
    `Можно писать и голосом обычными словами: «что на модерации», «одобри трек Kalush», «сколько скачали за месяц».`,
  ].join("\n");
}
