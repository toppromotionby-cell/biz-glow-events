// Работа с датами планера в локальной таймзоне. Чистый модуль: без сети и БД,
// используется и Telegram-агентом, и голосовым навыком Алисы.

/** Смещение таймзоны в минутах для конкретного момента (с учётом перехода на летнее время). */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const asTz = new Date(at.toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((asTz.getTime() - asUtc.getTime()) / 60000);
}

/** Границы суток (UTC-моменты) для дня, в который попадает `base` в таймзоне `tz`. */
export function dayRange(base: Date, tz: string, offsetDays = 0): { from: Date; to: Date } {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(base);
  const midnightUtc = new Date(`${ymd}T00:00:00Z`);
  const off = tzOffsetMinutes(base, tz);
  const from = new Date(midnightUtc.getTime() - off * 60000 + offsetDays * 86_400_000);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

const WEEKDAYS = ["воскресень", "понедельник", "вторник", "сред", "четверг", "пятниц", "суббот"];

/**
 * Разбор словесной даты: «сегодня», «завтра», «послезавтра», «в пятницу», «5.09».
 * Возвращает начало соответствующих суток или null.
 */
export function parseDayToken(token: string, tz: string, now = new Date()): Date | null {
  const t = token.trim().toLowerCase().replace(/^на\s+/, "").replace(/^в\s+/, "");
  if (!t) return null;
  if (t.startsWith("сегодня")) return dayRange(now, tz, 0).from;
  if (t.startsWith("завтра")) return dayRange(now, tz, 1).from;
  if (t.startsWith("послезавтра")) return dayRange(now, tz, 2).from;

  const wd = WEEKDAYS.findIndex((w) => t.startsWith(w));
  if (wd >= 0) {
    const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(now);
    const todayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
    const diff = (wd - todayIdx + 7) % 7 || 7;
    return dayRange(now, tz, diff).from;
  }

  const m = t.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/);
  if (!m) return null;
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).slice(0, 4));
  const noonUtc = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), 12, 0, 0));
  return dayRange(noonUtc, tz, 0).from;
}

/** Человеческое название дня: «сегодня», «завтра» или «понедельник, 05 сентября». */
export function dayLabel(day: Date, tz: string, now = new Date()): string {
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  if (key(day) === key(now)) return "сегодня";
  if (key(day) === key(new Date(now.getTime() + 86_400_000))) return "завтра";
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "2-digit", month: "long", timeZone: tz }).format(day);
}
