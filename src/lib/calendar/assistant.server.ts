// Общий «мозг» ассистента, не зависящий от канала: Telegram и Алиса
// вызывают один и тот же разбор намерения и получают готовый ответ.
import type { CalDirection, CalItem } from "@/lib/calendar/model";
import { fmtWhen, isOverdue, priorityScore } from "@/lib/calendar/model";
import { AiBlockedError, parseIntent } from "@/lib/calendar/parse.server";
import { dayLabel, dayRange, parseDayToken } from "@/lib/calendar/when";
import { listUnspoken, markSpoken, speechText } from "@/lib/calendar/outbox.server";
import {
  getDirections,
  getPrefs,
  listItemsBetween,
  listOpenTail,
  pullFromGoogle,
  saveItem,
  searchItems,
  setStatus,
} from "@/lib/calendar/store.server";

type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export type AssistantIntent =
  | { type: "help" }
  | { type: "news" }
  | { type: "list"; scope: "today" | "tomorrow" | "week" | "overdue" | "next"; day?: Date }
  | { type: "day"; day: Date }
  | { type: "find"; query: string }
  | { type: "done"; query: string }
  | { type: "create"; text: string };

export interface AssistantResult {
  /** Текст для канала (без HTML). */
  text: string;
  /** Реплика для озвучки. */
  speech: string;
  /** Записи, к которым относится ответ (канал может дорисовать кнопки). */
  items: CalItem[];
  intent: AssistantIntent["type"];
  /** Стоит ли закрывать сессию голосового навыка. */
  endSession: boolean;
  createdId?: string;
}

const HELP_RE = /^(помощь|что ты умеешь|справка|help|привет|начать|старт)\b/i;
const NEWS_RE = /(что нового|новые сообщения|прочитай сообщения|что я пропустил|пропустил)/i;
const DONE_RE = /^(отметь|отметить|выполнено|сделал|сделано|закрой|закрыть)\s+(.+)/i;
const FIND_RE = /^(найди|найти|поиск|когда)\s+(.+)/i;

/** Определение намерения по реплике (голос или текст). */
export function detectIntent(raw: string, tz: string, now = new Date()): AssistantIntent {
  const text = raw.trim();
  const t = text.toLowerCase().replace(/[?!]+$/, "").trim();
  if (!t || HELP_RE.test(t)) return { type: "help" };
  if (NEWS_RE.test(t)) return { type: "news" };

  if (/^(что|какие|какой|покажи|показать|список|план|расписание|дела|задачи)(?![а-яё])/.test(t) || /^(сегодня|завтра|послезавтра|неделя|на неделе|просроч\w*|ближайшее)\s*$/.test(t)) {
    if (/просроч|горит|хвост/.test(t)) return { type: "list", scope: "overdue" };
    if (/недел/.test(t)) return { type: "list", scope: "week" };
    if (/послезавтра/.test(t)) return { type: "day", day: dayRange(now, tz, 2).from };
    if (/завтра/.test(t)) return { type: "list", scope: "tomorrow" };
    if (/сегодня|сейчас|день/.test(t)) return { type: "list", scope: "today" };
    if (/ближайш|дальше|потом/.test(t)) return { type: "list", scope: "next" };
    const dayToken = t.replace(/^(что|какие|какой|покажи|показать|список|план|расписание|дела|задачи)(?![а-яё])/, "").replace(/(^|\s)(у меня|на|в|запланировано|дел[оа]?)(\s|$)/g, " ").trim();
    const day = parseDayToken(dayToken, tz, now);
    if (day) return { type: "day", day };
    return { type: "list", scope: "today" };
  }

  const done = t.match(DONE_RE);
  if (done?.[2]) return { type: "done", query: done[2] };

  const find = t.match(FIND_RE);
  if (find?.[2]) {
    const day = parseDayToken(find[2], tz, now);
    if (day) return { type: "day", day };
    return { type: "find", query: find[2] };
  }

  return { type: "create", text };
}

function itemLine(item: CalItem, dirs: CalDirection[], tz: string): string {
  const dir = dirs.find((d) => d.id === item.direction_id);
  const marks = [item.status === "done" ? "выполнено" : isOverdue(item) ? "просрочено" : null, item.importance === "hard" ? "жёсткая" : null].filter(Boolean);
  return [
    `${item.title} — ${fmtWhen(item, tz)}`,
    dir ? `(${dir.title})` : "",
    marks.length ? `[${marks.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderList(title: string, items: CalItem[], dirs: CalDirection[], tz: string, empty: string): string {
  if (!items.length) return `${title}: ${empty}`;
  const head = `${title} — ${items.length} ${plural(items.length, "запись", "записи", "записей")}.`;
  return [head, ...items.slice(0, 10).map((i, idx) => `${idx + 1}. ${itemLine(i, dirs, tz)}`)].join("\n");
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const HELP_TEXT = [
  "Я планер-ассистент. Скажите, что записать: «завтра в 15 встреча с подрядчиком по EventHub».",
  "Спросить можно так: «что сегодня», «что на завтра», «что на неделе», «что просрочено», «найди подрядчика».",
  "«Что нового» — зачитаю сообщения бота, которые вы пропустили.",
  "«Отметь встречу с подрядчиком» — закрою задачу.",
].join(" ");

/**
 * Единая обработка реплики. Не отправляет ничего в каналы — возвращает результат,
 * а канал (Telegram/Алиса) решает, как его показать.
 */
export async function runAssistant(
  db: Db,
  input: { text: string; source: string; now?: Date },
): Promise<AssistantResult> {
  const now = input.now ?? new Date();
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const tz = prefs.tz;
  const intent = detectIntent(input.text, tz, now);

  const reply = (text: string, items: CalItem[] = [], endSession = false, createdId?: string): AssistantResult => ({
    text,
    speech: speechText(text),
    items,
    intent: intent.type,
    endSession,
    ...(createdId ? { createdId } : {}),
  });

  if (intent.type === "help") return reply(HELP_TEXT);

  if (intent.type === "news") {
    const rows = await listUnspoken(db, 5);
    if (!rows.length) return reply("Новых сообщений нет.");
    await markSpoken(db, rows.map((r) => r.id));
    return reply(["Пока вас не было:", ...rows.map((r, i) => `${i + 1}. ${speechText(r.text)}`)].join("\n"));
  }

  if (intent.type === "done") {
    const found = await searchItems(db, intent.query, 3);
    const target = found.find((i) => i.status !== "done") ?? found[0];
    if (!target) return reply(`Не нашёл запись «${intent.query}».`);
    const updated = await setStatus(db, target.id, "done");
    return reply(`Отметил как выполненное: ${updated?.title ?? target.title}.`, updated ? [updated] : [target]);
  }

  if (intent.type === "find") {
    const found = await searchItems(db, intent.query, 10);
    return reply(renderList(`По запросу «${intent.query}»`, found, dirs, tz, "ничего не нашёл"), found);
  }

  // Чтение календаря — предварительно подтягиваем правки из Google.
  try {
    await pullFromGoogle(db);
  } catch (e) {
    console.error("[assistant] google pull failed", e);
  }

  if (intent.type === "day" || (intent.type === "list" && (intent.scope === "today" || intent.scope === "tomorrow"))) {
    const day =
      intent.type === "day" ? intent.day : dayRange(now, tz, intent.scope === "tomorrow" ? 1 : 0).from;
    const items = (await listItemsBetween(db, day.toISOString(), new Date(day.getTime() + 86_400_000).toISOString())).sort(
      (a, b) => priorityScore(b, now) - priorityScore(a, now),
    );
    const label = dayLabel(day, tz, now);
    return reply(renderList(`План на ${label}`, items, dirs, tz, "пусто"), items);
  }

  if (intent.type === "list" && intent.scope === "week") {
    const items = await listItemsBetween(db, now.toISOString(), new Date(now.getTime() + 7 * 86_400_000).toISOString());
    return reply(renderList("Ближайшие 7 дней", items, dirs, tz, "пусто"), items);
  }

  if (intent.type === "list" && intent.scope === "overdue") {
    const tail = (await listOpenTail(db, now.toISOString())).filter((i) => isOverdue(i, now));
    return reply(renderList("Просрочено", tail, dirs, tz, "ничего, всё под контролем"), tail);
  }

  if (intent.type === "list" && intent.scope === "next") {
    const items = (await listItemsBetween(db, now.toISOString(), new Date(now.getTime() + 14 * 86_400_000).toISOString())).slice(0, 5);
    return reply(renderList("Ближайшее", items, dirs, tz, "ничего не запланировано"), items);
  }

  // Создание записи.
  let parsed;
  try {
    parsed = await parseIntent(input.text, { tz, directions: dirs, style: prefs.style_profile });
  } catch (e) {
    const msg = e instanceof AiBlockedError ? "Ассистент временно недоступен, попробуйте позже." : "Не смог разобрать, повторите иначе.";
    return reply(msg);
  }

  const noTime = !parsed.starts_at && !parsed.due_at;
  if (parsed.confidence < 0.45 || (parsed.kind === "meeting" && noTime) || parsed.question) {
    return reply(
      `Понял так: ${parsed.title}. ${parsed.question ?? "Уточните, пожалуйста, дату и время."}`,
    );
  }

  const direction = dirs.find((d) => d.key === parsed.direction_key) ?? null;
  const item = await saveItem(db, {
    kind: parsed.kind,
    title: parsed.title,
    notes: parsed.notes,
    direction_id: direction?.id ?? null,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    due_at: parsed.due_at,
    all_day: parsed.all_day,
    tz,
    importance: parsed.importance,
    location: parsed.location,
    participants: parsed.participants,
    source: input.source,
  });

  return reply(`Записал: ${itemLine(item, dirs, tz)}.`, [item], false, item.id);
}
