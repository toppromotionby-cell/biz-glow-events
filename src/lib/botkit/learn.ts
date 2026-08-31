// Распознавание «обучающих» реплик: когда владелец учит бота правилу или факту.
// Клиентобезопасный модуль — покрывается тестами без сети и БД.

export type MemoryKind = "alias" | "habit" | "rule" | "fact";

export interface LearnCandidate {
  kind: MemoryKind;
  key: string;
  value: string;
}

const TEACH_PREFIX = /^\s*(?:бот[,:\s]+)?(?:запомни|запиши|учти|заруби на носу)\b[\s:,—-]*/i;
const ALWAYS = /\b(всегда|никогда|по умолчанию|каждый раз|обязательно)\b/i;
const ALIAS = /^\s*(.{2,60}?)\s+(?:это|—|-|означает)\s+(.{2,200})\s*$/i;
const FORGET = /^\s*(?:забудь|удали из памяти|не помни)\b(?:\s+(?:про|о|об))?\s*[:,—-]?\s*(.{2,120})\s*$/i;

/** «Забудь про …» → что именно забыть. */
export function detectForget(text: string): string | null {
  const m = FORGET.exec(text.trim());
  return m?.[1]?.trim() || null;
}

function shorten(s: string, max = 90): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Разбирает реплику: если владелец учит боту правилу — возвращает запись для общей памяти.
 * Разовые просьбы («сделай», «покажи», «напомни завтра») обучением не считаются.
 */
export function detectTeaching(text: string): LearnCandidate | null {
  const raw = text.trim();
  if (!raw || raw.startsWith("/")) return null;
  if (raw.length > 600) return null;

  const explicit = TEACH_PREFIX.test(raw);
  const body = explicit ? raw.replace(TEACH_PREFIX, "").trim() : raw;
  if (body.length < 4) return null;

  // Разовые действия — не память.
  if (!explicit && /^(сделай|покажи|найди|создай|перенеси|удали|напомни|отправь|скинь|что|когда|где|кто|сколько|как)\b/i.test(body)) {
    return null;
  }

  const alias = ALIAS.exec(body);
  if (explicit && alias?.[1] && alias[2]) {
    return { kind: "alias", key: shorten(alias[1], 60), value: shorten(alias[2], 300) };
  }

  if (explicit || ALWAYS.test(body)) {
    const kind: MemoryKind = ALWAYS.test(body) ? "rule" : "fact";
    return { kind, key: shorten(body.split(/[.:—\n]/)[0] || body, 80), value: shorten(body, 380) };
  }

  return null;
}
