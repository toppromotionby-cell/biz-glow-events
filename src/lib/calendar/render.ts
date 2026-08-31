// Единый форматтер ответов ассистента: Telegram-HTML и плоский текст для голоса.
// Чистый модуль (без БД и сети) — легко тестировать.
import type { CalDirection, CalItem } from "@/lib/calendar/model";
import { fmtWhen, isOverdue, localHm, priorityScore } from "@/lib/calendar/model";
import { syncFooter, type SyncStatus } from "@/lib/calendar/tg-format";


export function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function dirOf(item: CalItem, dirs: CalDirection[]): CalDirection | null {
  return dirs.find((d) => d.id === item.direction_id) ?? null;
}

/** Одна строка записи: статус, важность, направление, время. */
export function itemLine(item: CalItem, dirs: CalDirection[], tz: string, now = new Date()): string {
  const d = dirOf(item, dirs);
  const mark = item.status === "done" ? "✅ " : isOverdue(item, now) ? "⚠️ " : item.importance === "hard" ? "🔒 " : "";
  const tag = d ? `${d.emoji ?? "•"} ${esc(d.title)}` : "•";
  const place = item.location ? ` · ${esc(item.location)}` : "";
  return `${mark}<b>${esc(item.title)}</b>\n   ${tag} · ${esc(fmtWhen(item, tz))}${place}`;
}

type Part = "morning" | "day" | "evening" | "noTime";

const PART_TITLE: Record<Part, string> = {
  morning: "🌅 Утро",
  day: "🌞 День",
  evening: "🌙 Вечер",
  noTime: "🗒 Без времени",
};

function partOf(item: CalItem, tz: string): Part {
  const at = item.starts_at ?? item.due_at;
  if (!at || item.all_day) return "noTime";
  const h = Number(localHm(new Date(at), tz).slice(0, 2));
  if (h < 12) return "morning";
  if (h < 17) return "day";
  return "evening";
}

/** План на день: просроченное сверху, затем по частям дня, в конце — итог. */
export function renderDay(
  title: string,
  items: CalItem[],
  dirs: CalDirection[],
  tz: string,
  now = new Date(),
): string {
  if (!items.length) return `📅 <b>${esc(title)}</b>\nПусто — день свободен.`;

  const overdue = items.filter((i) => isOverdue(i, now) && i.status !== "done");
  const rest = items.filter((i) => !overdue.includes(i));
  const blocks: string[] = [`📅 <b>${esc(title)}</b> — ${items.length} ${plural(items.length, "дело", "дела", "дел")}`];

  if (overdue.length) {
    blocks.push(`\n⚠️ <b>Горит</b>\n${overdue.map((i) => itemLine(i, dirs, tz, now)).join("\n")}`);
  }
  for (const part of ["morning", "day", "evening", "noTime"] as Part[]) {
    const list = rest.filter((i) => partOf(i, tz) === part);
    if (!list.length) continue;
    blocks.push(`\n<b>${PART_TITLE[part]}</b>\n${list.map((i) => itemLine(i, dirs, tz, now)).join("\n")}`);
  }

  const hard = items.filter((i) => i.importance === "hard").length;
  const done = items.filter((i) => i.status === "done").length;
  const first = [...items]
    .filter((i) => i.status !== "done" && i.status !== "canceled")
    .sort((a, b) => priorityScore(b, now) - priorityScore(a, now))[0];
  const summary = [
    `Итого: ${items.length}`,
    hard ? `жёстких ${hard}` : "",
    overdue.length ? `просрочено ${overdue.length}` : "",
    done ? `сделано ${done}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  blocks.push(`\n<i>${esc(summary)}</i>${first ? `\n👉 Начните с: <b>${esc(first.title)}</b>` : ""}`);
  return blocks.join("\n");
}

/** Список на период — группировка по датам. */
export function renderRange(title: string, items: CalItem[], dirs: CalDirection[], tz: string, now = new Date()): string {
  if (!items.length) return `📅 <b>${esc(title)}</b>\nПусто.`;
  const dayKey = (i: CalItem) => {
    const at = i.starts_at ?? i.due_at;
    if (!at) return "Без даты";
    return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "2-digit", month: "long", timeZone: tz }).format(new Date(at));
  };
  const buckets = new Map<string, CalItem[]>();
  for (const i of items) buckets.set(dayKey(i), [...(buckets.get(dayKey(i)) ?? []), i]);
  const body = [...buckets.entries()]
    .map(([day, list]) => `\n<b>${esc(day)}</b>\n${list.map((i) => itemLine(i, dirs, tz, now)).join("\n")}`)
    .join("\n");
  return `📅 <b>${esc(title)}</b> — ${items.length} ${plural(items.length, "запись", "записи", "записей")}${body}`;
}

/** Компактная карточка записи (для подтверждений) со строкой синхронизации. */
export function renderItemCard(
  item: CalItem & { sync?: SyncStatus[] },
  dirs: CalDirection[],
  tz: string,
  prefix = "",
): string {
  const notes = item.notes ? `\n   📝 ${esc(item.notes)}` : "";
  const people = item.participants?.length ? `\n   👥 ${esc(item.participants.join(", "))}` : "";
  const footer = item.sync ? `\n   ${syncFooter(item.sync).replace(/\n/g, "\n   ")}` : "";
  return `${prefix}${itemLine(item, dirs, tz)}${notes}${people}${footer}`;
}


/** Кнопки под записью. */
export function itemButtons(item: CalItem): Array<Array<{ text: string; data: string }>> {
  const done = item.status === "done";
  return [
    [
      done ? { text: "↩️ Вернуть в работу", data: `undone:${item.id}` } : { text: "✅ Сделано", data: `done:${item.id}` },
      { text: "🕒 Перенести", data: `move:${item.id}` },
    ],
    [
      { text: "+1 час", data: `plus60:${item.id}` },
      { text: "🔒 Жёсткая", data: `hard:${item.id}` },
      { text: "🗑 Удалить", data: `del:${item.id}` },
    ],
  ];
}
