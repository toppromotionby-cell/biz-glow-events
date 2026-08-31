// Модель умного календаря (планера): типы, приоритеты, форматирование.
// Клиент-безопасный модуль: используется и в UI, и на сервере.

export type CalKind = "task" | "meeting";
export type CalStatus = "planned" | "in_progress" | "done" | "canceled";
export type CalImportance = "normal" | "hard";

export interface CalDirection {
  id: string;
  key: string;
  title: string;
  color: string;
  google_color_id: string | null;
  emoji: string | null;
  keywords: string[];
  work_start: string;
  work_end: string;
  sort: number;
  active: boolean;
}

export interface CalItem {
  id: string;
  kind: CalKind;
  title: string;
  notes: string | null;
  direction_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  due_at: string | null;
  all_day: boolean;
  tz: string;
  status: CalStatus;
  importance: CalImportance;
  location: string | null;
  participants: string[];
  source: string;
  google_event_id: string | null;
  google_task_id: string | null;
  google_tasklist_id: string | null;
  /** 1 — самый высокий, 4 — самый низкий (как P1–P4 в Todoist). */
  priority: number;
  tags: string[];
  parent_id: string | null;
  /** Правило повтора: daily | weekly:1,3 | monthly:15 | RRULE. */
  recurrence: string | null;
  reschedule_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantPrefs {
  tz: string;
  tg_chat_id: number | null;
  morning_time: string;
  evening_time: string;
  quiet_start: string;
  quiet_end: string;
  reminder_minutes: number[];
  hard_reminder_minutes: number[];
  followup_minutes: number;
  style_profile: string | null;
  last_device_tz: string | null;
  /** Разрешённые Telegram-чаты бота-планера (пусто — привяжется первый, кто напишет /start). */
  tg_allowed_chat_ids: number[];
  tg_bot_username: string | null;
  /** Привязанные аккаунты Яндекса, которым разрешён голосовой навык. */
  alice_user_ids: string[];
  alice_skill_id: string | null;
  /** Одноразовый код привязки, который нужно продиктовать Алисе. */
  alice_link_code: string | null;
  alice_push_enabled: boolean;
  /** Дублировать действия из Алисы карточками в Telegram. */
  alice_mirror_tg: boolean;
  /** Как обращаться к владельцу. */
  owner_name: string | null;
  /** Тон общения ассистента. */
  tone: "dry" | "friendly" | "fun";
  /** Отвечать голосом там, где это возможно. */
  voice_reply: boolean;
  /** Использовать AI-мозг с инструментами вместо простых команд. */
  brain_enabled: boolean;
  /** Присылать в Telegram картинки (таймлайны, таблицы, графики). */
  visuals_enabled: boolean;
  /** Режим ответа: картинка с подписью или только текст. */
  visual_mode: "image" | "text";
  /** Показывать визуал в утреннем/вечернем дайджесте и обзоре недели. */
  digest_visual: boolean;
}

export const KIND_LABEL: Record<CalKind, string> = { task: "Задача", meeting: "Встреча" };
export const STATUS_LABEL: Record<CalStatus, string> = {
  planned: "Запланировано",
  in_progress: "В работе",
  done: "Сделано",
  canceled: "Отменено",
};

/** Ключевые слова «жёсткой» встречи — переносить нельзя без крайней нужды. */
const HARD_WORDS = ["жёстк", "жестк", "нельзя перенести", "не переносить", "обязательн", "критичн", "важн"];

export function detectImportance(text: string): CalImportance {
  const t = text.toLowerCase();
  return HARD_WORDS.some((w) => t.includes(w)) ? "hard" : "normal";
}

const MEETING_WORDS = ["встреч", "созвон", "звонок", "переговор", "интервью", "презентац", "митап", "визит", "приём", "прием"];
const TASK_WORDS = ["сделать", "подготовить", "отправить", "написать", "посчитать", "смет", "оплатить", "проверить", "задача"];

/** Эвристика типа записи — страховка, когда модель не уверена. */
export function guessKind(text: string): CalKind {
  const t = text.toLowerCase();
  const m = MEETING_WORDS.some((w) => t.includes(w));
  const k = TASK_WORDS.some((w) => t.includes(w));
  if (m && !k) return "meeting";
  if (k && !m) return "task";
  return m ? "meeting" : "task";
}

/** Подбор направления по ключевым словам справочника. */
export function guessDirection(text: string, directions: CalDirection[]): CalDirection | null {
  const t = text.toLowerCase();
  let best: { dir: CalDirection; score: number } | null = null;
  for (const dir of directions) {
    if (!dir.active) continue;
    let score = 0;
    for (const kw of dir.keywords) {
      const k = kw.trim().toLowerCase();
      if (k && t.includes(k)) score += k.length;
    }
    if (t.includes(dir.title.toLowerCase())) score += dir.title.length;
    if (score > 0 && (!best || score > best.score)) best = { dir, score };
  }
  return best?.dir ?? null;
}

/**
 * Приоритет записи: чем больше, тем раньше делать.
 * Учитываем срочность дедлайна, важность, тип и число переносов.
 */
export function priorityScore(item: CalItem, now: Date = new Date()): number {
  let score = 0;
  const deadline = item.due_at ?? item.starts_at;
  if (deadline) {
    const hours = (new Date(deadline).getTime() - now.getTime()) / 3_600_000;
    if (hours <= 0) score += 100; // просрочено
    else if (hours <= 4) score += 80;
    else if (hours <= 24) score += 60;
    else if (hours <= 72) score += 35;
    else score += 10;
  }
  if (item.importance === "hard") score += 40;
  if (item.kind === "meeting") score += 15;
  score += Math.min(item.reschedule_count, 5) * 6; // откладываемое поднимаем
  if (item.status === "in_progress") score += 8;
  return score;
}

export function isOverdue(item: CalItem, now: Date = new Date()): boolean {
  if (item.status === "done" || item.status === "canceled") return false;
  const deadline = item.due_at ?? item.ends_at ?? item.starts_at;
  return Boolean(deadline && new Date(deadline).getTime() < now.getTime());
}

/** Час:минуты в заданной таймзоне. */
export function localHm(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(date);
}

/** Дата YYYY-MM-DD в заданной таймзоне. */
export function localDay(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(date);
  return parts;
}

export function fmtWhen(item: Pick<CalItem, "starts_at" | "ends_at" | "due_at" | "all_day" | "tz">, tz?: string): string {
  const zone = tz ?? item.tz ?? "Europe/Minsk";
  const start = item.starts_at ? new Date(item.starts_at) : null;
  const end = item.ends_at ? new Date(item.ends_at) : null;
  const due = item.due_at ? new Date(item.due_at) : null;
  const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", timeZone: zone });
  if (start) {
    const base = `${dayFmt.format(start)}, ${localHm(start, zone)}`;
    return end ? `${base}–${localHm(end, zone)}` : base;
  }
  if (due) return `до ${dayFmt.format(due)}, ${localHm(due, zone)}`;
  return "без времени";
}

/** Пересечение по времени — для предупреждения о накладках. */
export function overlaps(a: CalItem, b: CalItem): boolean {
  if (!a.starts_at || !b.starts_at) return false;
  const as = new Date(a.starts_at).getTime();
  const ae = new Date(a.ends_at ?? a.starts_at).getTime() || as;
  const bs = new Date(b.starts_at).getTime();
  const be = new Date(b.ends_at ?? b.starts_at).getTime() || bs;
  return as < be && bs < ae;
}

/** Свободные слоты в рабочем окне на ближайшие дни (для предложений переноса). */
export function freeSlots(
  busy: CalItem[],
  opts: { from: Date; days: number; durationMin: number; tz: string; workStart?: string; workEnd?: string; limit?: number },
): Date[] {
  const { from, days, durationMin, tz } = opts;
  const startH = Number((opts.workStart ?? "09:00").slice(0, 2));
  const endH = Number((opts.workEnd ?? "19:00").slice(0, 2));
  const step = 30 * 60_000;
  const dur = durationMin * 60_000;
  const busyRanges = busy
    .filter((b) => b.starts_at && b.status !== "canceled")
    .map((b) => {
      const s = new Date(b.starts_at as string).getTime();
      const e = new Date(b.ends_at ?? b.starts_at as string).getTime() || s + 30 * 60_000;
      return [s, e] as const;
    });
  const out: Date[] = [];
  const limit = opts.limit ?? 3;
  for (let t = Math.ceil(from.getTime() / step) * step; t < from.getTime() + days * 86_400_000; t += step) {
    const d = new Date(t);
    const hm = localHm(d, tz);
    const h = Number(hm.slice(0, 2));
    if (h < startH || h >= endH) continue;
    const conflict = busyRanges.some(([s, e]) => t < e && s < t + dur);
    if (conflict) continue;
    out.push(d);
    if (out.length >= limit) break;
    t += 60 * 60_000; // разносим предложения
  }
  return out;
}
