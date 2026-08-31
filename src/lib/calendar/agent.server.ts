// Мозг ассистента: разбор входящих из Telegram, дайджесты, напоминания, контроль.
import type { CalDirection, CalItem } from "@/lib/calendar/model";
import { fmtWhen, freeSlots, isOverdue, localHm, priorityScore, STATUS_LABEL } from "@/lib/calendar/model";
import { adviseDay, AiBlockedError, parseIntent, transcribeVoice } from "@/lib/calendar/parse.server";
import { tgAnswerCallback, tgDownloadFile, tgEdit, tgEsc, tgSend, tgSendPhoto } from "@/lib/calendar/telegram.server";
import { dayTimelineUrl, directionPieUrl, itemsTable, weekLoadUrl } from "@/lib/calendar/visuals";
import {
  admin,
  computeAnalytics,
  deleteItem,
  getDirections,
  getItem,
  getPrefs,
  listItemsBetween,
  listOpenTail,
  pullFromGoogle,
  rescheduleItem,
  saveItem,
  searchItems,
  setStatus,
} from "@/lib/calendar/store.server";
import { dayRange, parseDayToken } from "@/lib/calendar/when";
import { pushOutbox } from "@/lib/calendar/outbox.server";
import type { AssistantResult } from "@/lib/calendar/assistant.server";
import { sendAlicePush } from "@/lib/calendar/alice.server";
import type { AssistantPrefs } from "@/lib/calendar/model";

type Db = Awaited<ReturnType<typeof admin>>;

function dirOf(item: CalItem, dirs: CalDirection[]): CalDirection | null {
  return dirs.find((d) => d.id === item.direction_id) ?? null;
}

function line(item: CalItem, dirs: CalDirection[], tz: string): string {
  const d = dirOf(item, dirs);
  const mark = item.importance === "hard" ? "🔒 " : "";
  const tag = d ? `${d.emoji ?? "•"} ${tgEsc(d.title)}` : "•";
  const done = item.status === "done" ? "✅ " : isOverdue(item) ? "⚠️ " : "";
  return `${done}${mark}<b>${tgEsc(item.title)}</b>\n   ${tag} · ${tgEsc(fmtWhen(item, tz))}`;
}

function itemButtons(item: CalItem) {
  return [
    [
      { text: "✅ Сделано", data: `done:${item.id}` },
      { text: "🕒 Перенести", data: `move:${item.id}` },
    ],
    [{ text: "🗑 Удалить", data: `del:${item.id}` }],
  ];
}

// ——— Чтение календаря из Telegram (команды и вопросы) ———

/**
 * Визуальная «шапка» списка: картинка (таймлайн/загрузка) либо таблица.
 * Никогда не роняет ответ — при любой ошибке просто отдаём текст дальше.
 */
async function sendVisual(
  chatId: number,
  title: string,
  items: CalItem[],
  dirs: CalDirection[],
  prefs: AssistantPrefs,
  shape: "day" | "week",
): Promise<void> {
  if (!prefs.visuals_enabled || !items.length) return;
  try {
    if (prefs.visual_mode === "image") {
      const url =
        shape === "day"
          ? dayTimelineUrl(title.replace(/<[^>]+>/g, ""), items, dirs, prefs.tz)
          : weekLoadUrl(title.replace(/<[^>]+>/g, ""), items, dirs, prefs.tz);
      if (url) {
        const sent = await tgSendPhoto(chatId, url, title);
        if (sent) return;
      }
    }
    await tgSend(chatId, itemsTable(items, dirs, prefs.tz));
  } catch (e) {
    console.error("[planner] visual failed", e);
  }
}

/** Отправка списка записей с кнопками действий (двусторонняя работа прямо из чата). */
async function sendList(
  chatId: number,
  title: string,
  items: CalItem[],
  dirs: CalDirection[],
  tz: string,
  empty = "Ничего не нашёл.",
  visual?: { prefs: AssistantPrefs; shape: "day" | "week" },
): Promise<void> {
  if (!items.length) {
    await tgSend(chatId, `${title}\n${empty}`);
    return;
  }
  await tgSend(chatId, title);
  if (visual) await sendVisual(chatId, title, items, dirs, visual.prefs, visual.shape);
  for (const item of items.slice(0, 12)) {
    await tgSend(chatId, line(item, dirs, tz), itemButtons(item));
  }
}

const QUESTION_RE =
  /^(что|какие|какой|когда|где|сколько|покажи|показать|список|есть ли|во сколько|напомни что)\b/i;

/**
 * Команды и вопросы «на чтение». Возвращает true, если сообщение обработано
 * как запрос (и не должно создавать новую запись).
 */
async function handleQuery(db: Db, chatId: number, raw: string, tz: string, dirs: CalDirection[]): Promise<boolean> {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = new Date();
  const isCommand = lower.startsWith("/");

  const withFreshGoogle = async () => {
    try {
      await pullFromGoogle(db);
    } catch (e) {
      console.error("[planner] pull before query failed", e);
    }
  };

  const listDay = async (from: Date, label: string) => {
    await withFreshGoogle();
    const prefs = await getPrefs(db);
    const items = (await listItemsBetween(db, from.toISOString(), new Date(from.getTime() + 86_400_000).toISOString())).sort(
      (a, b) => priorityScore(b, now) - priorityScore(a, now),
    );
    await sendList(chatId, `📅 <b>${label}</b>`, items, dirs, tz, "На этот день пусто.", { prefs, shape: "day" });
  };

  if (isCommand || /^(сегодня|завтра|неделя|просроч|ближайшие)/i.test(lower)) {
    if (lower === "/today" || lower === "сегодня") {
      await listDay(dayRange(now, tz, 0).from, "Сегодня");
      return true;
    }
    if (lower === "/tomorrow" || lower === "завтра") {
      await listDay(dayRange(now, tz, 1).from, "Завтра");
      return true;
    }
    if (lower === "/week" || lower === "неделя") {
      await withFreshGoogle();
      await sendWeek(db, chatId);
      return true;
    }
    if (lower === "/open") {
      await sendOpenTail(db, chatId);
      return true;
    }
    if (lower.startsWith("/overdue") || lower.startsWith("просроч")) {
      const tail = (await listOpenTail(db, now.toISOString())).filter((i) => isOverdue(i, now));
      await sendList(chatId, "⚠️ <b>Просрочено</b>", tail, dirs, tz, "Просрочек нет 👌");
      return true;
    }
    if (lower.startsWith("/next") || lower.startsWith("ближайшие")) {
      await withFreshGoogle();
      const items = (await listItemsBetween(db, now.toISOString(), new Date(now.getTime() + 14 * 86_400_000).toISOString())).slice(0, 5);
      await sendList(chatId, "⏭ <b>Ближайшее</b>", items, dirs, tz, "Ближайших дел нет.", {
        prefs: await getPrefs(db),
        shape: "week",
      });
      return true;
    }
    if (lower.startsWith("/day")) {
      const token = text.slice(4).trim();
      const from = parseDayToken(token, tz);
      if (!from) {
        await tgSend(chatId, "Формат: <code>/day 5.09</code> или <code>/day завтра</code>");
        return true;
      }
      await listDay(from, new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "2-digit", month: "long", timeZone: tz }).format(from));
      return true;
    }
    if (lower.startsWith("/find") || lower.startsWith("/search")) {
      const q = text.replace(/^\/\w+/, "").trim();
      if (!q) {
        await tgSend(chatId, "Формат: <code>/find подрядчик</code>");
        return true;
      }
      const found = await searchItems(db, q, 10);
      await sendList(chatId, `🔎 <b>Найдено по «${tgEsc(q)}»</b>`, found, dirs, tz, "Ничего не нашёл.");
      return true;
    }
    if (isCommand) return false;
  }

  // Вопрос обычным текстом — отвечаем выпиской, а не создаём задачу.
  if (QUESTION_RE.test(lower) || (lower.endsWith("?") && lower.length < 120)) {
    if (/завтра/.test(lower)) {
      await listDay(dayRange(now, tz, 1).from, "Завтра");
      return true;
    }
    if (/сегодня/.test(lower)) {
      await listDay(dayRange(now, tz, 0).from, "Сегодня");
      return true;
    }
    if (/недел/.test(lower)) {
      await withFreshGoogle();
      await sendWeek(db, chatId);
      return true;
    }
    if (/просроч|горит|хвост/.test(lower)) {
      const tail = (await listOpenTail(db, now.toISOString())).sort((a, b) => priorityScore(b, now) - priorityScore(a, now));
      await sendList(chatId, "📌 <b>Незакрытое</b>", tail.slice(0, 10), dirs, tz, "Хвостов нет 👌");
      return true;
    }
    // «когда встреча с подрядчиком?» — ищем по ключевым словам вопроса.
    const q = lower
      .replace(/[?!.,]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !/^(когда|какие|какой|сколько|покажи|показать|список|встреч[аи]?|задач[аи]?)$/.test(w))
      .slice(0, 3)
      .join(" ");
    if (q) {
      const found = await searchItems(db, q, 10);
      if (found.length) {
        await sendList(chatId, `🔎 <b>Нашёл по «${tgEsc(q)}»</b>`, found, dirs, tz);
        return true;
      }
    }
  }
  return false;
}

// ——— Обработка входящего сообщения ———

export async function handleTelegramText(
  db: Db,
  chatId: number,
  text: string,
  opts: { source: "telegram" | "voice"; raw?: unknown },
): Promise<void> {
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);

  const cmd = text.trim().toLowerCase();
  if (cmd === "/start" || cmd === "/help" || cmd === "помощь") {
    await db.from("assistant_prefs").update({ tg_chat_id: chatId }).eq("id", 1);
    await tgSend(
      chatId,
      [
        "Я планер-ассистент. Пишите или наговаривайте голосом:",
        "«завтра в 15 встреча с подрядчиком по EventHub, жёсткая»",
        "",
        "Команды:",
        "/today — план на сегодня",
        "/tomorrow — план на завтра",
        "/week — ближайшие 7 дней",
        "/day 5.09 — план на конкретный день",
        "/overdue — просроченное",
        "/next — ближайшие 5 дел",
        "/find текст — поиск по записям",
        "/open — незакрытые хвосты",
        "",
        "Можно и просто спросить: «что у меня завтра?», «когда встреча с подрядчиком?»",
      ].join("\n"),
    );
    return;
  }
  // Быстрые слэш-команды идут мимо модели — они дешевле и мгновеннее.
  const isCommand = text.trim().startsWith("/");
  if (isCommand && (await handleQuery(db, chatId, text, prefs.tz, dirs))) return;

  // Основной путь: AI-мозг с инструментами (понимает свободную речь и контекст диалога).
  if (prefs.brain_enabled) {
    try {
      const { runBrain } = await import("@/lib/calendar/brain.server");
      const result = await runBrain(db, {
        text,
        chatKey: `tg:${chatId}`,
        channel: "telegram",
        prefs,
        dirs,
      });
      if (result.blocks.length) {
        for (const block of result.blocks) {
          if (!block.text.trim()) continue;
          await tgSend(chatId, block.text, block.item ? itemButtons(block.item) : undefined);
        }
        if (opts.source === "voice" || result.usedTools.length) {
          await db.from("calendar_inbox").insert({
            tg_chat_id: chatId,
            source: opts.source,
            raw_text: text,
            status: result.usedTools.length ? "done" : "clarify",
            parsed: { tools: result.usedTools } as never,
            item_id: result.items[0]?.id ?? null,
          });
        }
        return;
      }
    } catch (e) {
      if (e instanceof AiBlockedError) {
        await tgSend(chatId, "ИИ временно недоступен, попробуйте чуть позже.");
        return;
      }
      console.error("[planner] brain failed, fallback to simple parser", e);
    }
  }

  if (!isCommand && (await handleQuery(db, chatId, text, prefs.tz, dirs))) return;

  const { data: inbox } = await db
    .from("calendar_inbox")
    .insert({ tg_chat_id: chatId, source: opts.source, raw_text: text, status: "parsing" })
    .select("id")
    .maybeSingle();
  const inboxId = (inbox as { id?: string } | null)?.id ?? null;

  let parsed;
  try {
    parsed = await parseIntent(text, { tz: prefs.tz, directions: dirs, style: prefs.style_profile });
  } catch (e) {
    const msg = e instanceof AiBlockedError ? "ИИ временно недоступен, попробуйте позже." : "Не смог разобрать сообщение.";
    if (inboxId) await db.from("calendar_inbox").update({ status: "error", question: String(e).slice(0, 300) }).eq("id", inboxId);
    await tgSend(chatId, msg);
    return;
  }

  // Мало уверенности или нет времени — уточняем, ничего не создаём молча.
  const noTime = !parsed.starts_at && !parsed.due_at;
  if (parsed.confidence < 0.45 || (parsed.kind === "meeting" && noTime) || parsed.question) {
    if (inboxId) {
      await db
        .from("calendar_inbox")
        .update({ status: "clarify", parsed: parsed as never, question: parsed.question })
        .eq("id", inboxId);
    }
    await tgSend(
      chatId,
      [
        `Понял так: <b>${tgEsc(parsed.title)}</b> (${parsed.kind === "meeting" ? "встреча" : "задача"}).`,
        parsed.question ? tgEsc(parsed.question) : "Уточните, пожалуйста, дату и время.",
      ].join("\n"),
    );
    return;
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
    tz: prefs.tz,
    importance: parsed.importance,
    location: parsed.location,
    participants: parsed.participants,
    source: opts.source,
  });
  if (inboxId) {
    await db.from("calendar_inbox").update({ status: "done", parsed: parsed as never, item_id: item.id }).eq("id", inboxId);
  }

  // Предупреждаем о накладке, но ничего не двигаем сами.
  const dayItems = await listItemsBetween(
    db,
    new Date(new Date(item.starts_at ?? Date.now()).getTime() - 86_400_000).toISOString(),
    new Date(new Date(item.starts_at ?? Date.now()).getTime() + 86_400_000).toISOString(),
  );
  const clash = dayItems.find(
    (o) =>
      o.id !== item.id &&
      o.starts_at &&
      item.starts_at &&
      Math.abs(new Date(o.starts_at).getTime() - new Date(item.starts_at).getTime()) < 30 * 60_000,
  );

  await tgSend(
    chatId,
    [
      `Записал: ${line(item, dirs, prefs.tz)}`,
      clash ? `\n⚠️ Рядом уже стоит: <b>${tgEsc(clash.title)}</b> (${tgEsc(fmtWhen(clash, prefs.tz))})` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    itemButtons(item),
  );
}

export async function handleTelegramVoice(db: Db, chatId: number, fileId: string): Promise<void> {
  const file = await tgDownloadFile(fileId);
  if (!file) {
    await tgSend(chatId, "Не смог скачать голосовое, продиктуйте ещё раз или напишите текстом.");
    return;
  }
  let text = "";
  try {
    text = await transcribeVoice(file.base64, file.mime);
  } catch (e) {
    console.error("[planner] transcribe failed", e);
  }
  if (!text || text.length < 3) {
    await tgSend(chatId, "Не разобрал голос 🙈 Повторите чуть медленнее или напишите текстом.");
    return;
  }
  await tgSend(chatId, `🎙 Расслышал: «${tgEsc(text)}»`);
  await handleTelegramText(db, chatId, text, { source: "voice" });
}

// ——— Кнопки ———

export async function handleCallback(
  db: Db,
  chatId: number,
  messageId: number,
  callbackId: string,
  data: string,
): Promise<void> {
  const [action, id, extra] = data.split(":");
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const item = id ? await getItem(db, id) : null;
  if (!item) {
    await tgAnswerCallback(callbackId, "Запись не найдена");
    return;
  }

  if (action === "done") {
    const updated = await setStatus(db, item.id, "done");
    await tgAnswerCallback(callbackId, "Отметил как сделано");
    if (updated) await tgEdit(chatId, messageId, `✅ ${tgEsc(updated.title)} — ${STATUS_LABEL.done}`);
    return;
  }
  if (action === "del") {
    await deleteItem(db, item.id);
    await tgAnswerCallback(callbackId, "Удалил");
    await tgEdit(chatId, messageId, `🗑 ${tgEsc(item.title)} — удалено`);
    return;
  }
  if (action === "keep") {
    await tgAnswerCallback(callbackId, "Оставил как есть");
    await tgEdit(chatId, messageId, `Оставил без изменений: ${tgEsc(item.title)}`);
    return;
  }
  if (action === "move") {
    // Предлагаем свободные слоты — решение всегда за пользователем.
    const busy = await listItemsBetween(db, new Date().toISOString(), new Date(Date.now() + 7 * 86_400_000).toISOString());
    const dir = dirOf(item, dirs);
    const slots = freeSlots(busy, {
      from: new Date(Date.now() + 60 * 60_000),
      days: 5,
      durationMin: 60,
      tz: prefs.tz,
      workStart: dir?.work_start,
      workEnd: dir?.work_end,
      limit: 3,
    });
    if (!slots.length) {
      await tgAnswerCallback(callbackId, "Свободных слотов не нашёл");
      return;
    }
    const buttons = slots.map((s) => [
      {
        text: new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: prefs.tz }).format(s) +
          ` ${localHm(s, prefs.tz)}`,
        data: `mv2:${item.id}:${s.toISOString()}`,
      },
    ]);
    buttons.push([{ text: "Оставить как есть", data: `keep:${item.id}` }]);
    await tgAnswerCallback(callbackId);
    await tgSend(chatId, `Куда перенести «${tgEsc(item.title)}»?`, buttons);
    return;
  }
  if (action === "mv2" && extra) {
    const updated = await rescheduleItem(db, item.id, extra);
    await tgAnswerCallback(callbackId, "Перенёс");
    if (updated) await tgEdit(chatId, messageId, `🕒 Перенёс: ${line(updated, dirs, prefs.tz)}`);
    return;
  }
  await tgAnswerCallback(callbackId);
}

// ——— Дайджесты ———

function groupByDirection(items: CalItem[], dirs: CalDirection[], tz: string): string {
  const buckets = new Map<string, CalItem[]>();
  for (const it of items) {
    const key = dirOf(it, dirs)?.title ?? "Без направления";
    buckets.set(key, [...(buckets.get(key) ?? []), it]);
  }
  return [...buckets.entries()]
    .map(([title, list]) => `\n<b>${tgEsc(title)}</b>\n` + list.map((i) => line(i, dirs, tz)).join("\n"))
    .join("\n");
}

/** Push-напоминание в Алису (работает только для опубликованного навыка). */
async function pushAliceReminder(_db: Db, prefs: AssistantPrefs, text: string): Promise<void> {
  if (!prefs.alice_push_enabled || !prefs.alice_skill_id) return;
  for (const uid of prefs.alice_user_ids) {
    try {
      await sendAlicePush(prefs.alice_skill_id, uid, text);
    } catch (e) {
      console.error("[planner] alice push failed", e);
    }
  }
}

async function chatId(db: Db): Promise<number | null> {
  const prefs = await getPrefs(db);
  return prefs.tg_chat_id ?? (process.env.TELEGRAM_CHAT_ID ? Number(process.env.TELEGRAM_CHAT_ID) : null);
}

export async function sendDailyDigest(db: Db, mode: "morning" | "evening"): Promise<void> {
  const cid = await chatId(db);
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const items = (await listItemsBetween(db, dayStart.toISOString(), dayEnd.toISOString())).sort(
    (a, b) => priorityScore(b, now) - priorityScore(a, now),
  );

  if (mode === "morning") {
    const overdue = (await listOpenTail(db, now.toISOString())).filter((i) => isOverdue(i, now)).slice(0, 8);
    const head = `☀️ <b>План на сегодня</b> — ${items.length} ${items.length === 1 ? "запись" : "записей"}`;
    const body = items.length ? groupByDirection(items, dirs, prefs.tz) : "\nСегодня чисто — можно взять хвосты.";
    const tail = overdue.length ? `\n\n⚠️ <b>Просрочено</b>\n${overdue.map((i) => line(i, dirs, prefs.tz)).join("\n")}` : "";
    const advice = await adviseDay(
      `Сегодня: ${items.map((i) => `${i.title} (${fmtWhen(i, prefs.tz)}, ${i.importance})`).join("; ") || "пусто"}. Просрочено: ${overdue.map((i) => i.title).join("; ") || "нет"}.`,
      prefs.style_profile,
    );
    const morning = [head, body, tail, advice ? `\n💡 ${tgEsc(advice)}` : ""].filter(Boolean).join("\n");
    if (prefs.digest_visual) await sendVisual(cid, "План на сегодня", items, dirs, prefs, "day");
    await tgSend(cid, morning);
    await pushOutbox(db, { text: morning, kind: "digest" });
    return;
  }

  const done = items.filter((i) => i.status === "done");
  const left = items.filter((i) => i.status !== "done" && i.status !== "canceled");
  const evening = [
      `🌙 <b>Итоги дня</b>`,
      `Сделано: ${done.length} · Осталось: ${left.length}`,
      done.length ? `\n<b>Закрыто</b>\n${done.map((i) => `✅ ${tgEsc(i.title)}`).join("\n")}` : "",
      left.length ? `\n<b>Не закрыто</b>\n${left.map((i) => line(i, dirs, prefs.tz)).join("\n")}` : "",
      left.length ? "\nЧто из этого переносим? Нажмите «Перенести» у нужной записи в /open." : "",
  ]
    .filter(Boolean)
    .join("\n");
  await tgSend(cid, evening);
  await pushOutbox(db, { text: evening, kind: "digest" });
}

export async function sendWeek(db: Db, to?: number): Promise<void> {
  const cid = to ?? (await chatId(db));
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const items = await listItemsBetween(db, new Date().toISOString(), new Date(Date.now() + 7 * 86_400_000).toISOString());
  if (items.length) await sendVisual(cid, "Ближайшие 7 дней", items, dirs, prefs, "week");
  await tgSend(
    cid,
    items.length ? `📅 <b>Ближайшие 7 дней</b>\n${groupByDirection(items, dirs, prefs.tz)}` : "На неделе пусто.",
  );
}

/** Понедельничный обзор недели: загрузка по направлениям, просрочки, хронические переносы. */
export async function sendWeeklyReview(db: Db): Promise<void> {
  const cid = await chatId(db);
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const stats = await computeAnalytics(db, 7);
  const items = await listItemsBetween(db, new Date().toISOString(), new Date(Date.now() + 7 * 86_400_000).toISOString());
  const load = stats.perDirection
    .map((s) => {
      const d = dirs.find((x) => x.id === s.direction_id);
      const hours = Math.round(s.minutes / 60);
      return `${d?.emoji ?? "•"} ${tgEsc(d?.title ?? "Без направления")}: ${s.total} записей${hours ? `, ~${hours} ч` : ""}`;
    })
    .join("\n");
  const chronic = stats.topRescheduled.filter((t) => t.reschedule_count >= 2);
  const advice = await adviseDay(
    `Неделя: записей ${stats.total}, закрыто ${stats.done}, просрочено сейчас ${stats.overdueNow}. ` +
      `Часто откладывается: ${chronic.map((c) => `${c.title} (${c.reschedule_count} переносов)`).join("; ") || "нет"}.`,
    prefs.style_profile,
  );
  if (prefs.visuals_enabled && prefs.digest_visual && prefs.visual_mode === "image") {
    const pie = directionPieUrl(
      "Загрузка по направлениям за 7 дней",
      stats.perDirection.map((s) => {
        const d = dirs.find((x) => x.id === s.direction_id);
        return { label: d?.title ?? "Без направления", value: s.total, color: d?.color ?? "#cbd5e1" };
      }),
    );
    if (pie) await tgSendPhoto(cid, pie, "🗓 Обзор недели");
  }
  await tgSend(
    cid,
    [
      "🗓 <b>Обзор недели</b>",
      `За 7 дней: ${stats.total} записей, закрыто ${stats.done} (${stats.doneRate}%), просрочено сейчас: ${stats.overdueNow}.`,
      load ? `\n<b>Загрузка по направлениям</b>\n${load}` : "",
      chronic.length
        ? `\n⚠️ <b>Часто откладывается</b>\n${chronic.map((c) => `• ${tgEsc(c.title)} — переносов: ${c.reschedule_count}`).join("\n")}`
        : "",
      `\n<b>Ближайшие 7 дней</b>\n${items.length ? groupByDirection(items, dirs, prefs.tz) : "пусто"}`,
      advice ? `\n💡 ${tgEsc(advice)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function sendOpenTail(db: Db, to?: number): Promise<void> {
  const cid = to ?? (await chatId(db));
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const now = new Date();
  const tail = (await listOpenTail(db, now.toISOString()))
    .sort((a, b) => priorityScore(b, now) - priorityScore(a, now))
    .slice(0, 10);
  if (!tail.length) {
    await tgSend(cid, "Хвостов нет — всё закрыто 👌");
    return;
  }
  await tgSend(cid, `📌 <b>Незакрытое</b> (по приоритету)`);
  for (const item of tail) {
    await tgSend(cid, line(item, dirs, prefs.tz), itemButtons(item));
  }
}

// ——— Тик планировщика (вызывается cron'ом раз в 5–15 минут) ———

export async function runTick(db: Db): Promise<{ reminders: number; digests: string[]; pulled: number }> {
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const cid = await chatId(db);
  const now = new Date();
  const nowHm = localHm(now, prefs.tz);
  const digests: string[] = [];

  // 1. Импорт правок из Google.
  let pulled = 0;
  try {
    const res = await pullFromGoogle(db);
    pulled = res.applied;
    if (cid && res.conflicts.length) {
      const lines = res.conflicts.slice(0, 5).map((i) => line(i, dirs, prefs.tz)).join("\n");
      await tgSend(cid, `🔄 Изменения из Google Календаря:\n${lines}`);
    }
  } catch (e) {
    console.error("[planner] pull failed", e);
  }

  // 2. Напоминания и контрольные вопросы.
  const { data: due } = await db
    .from("calendar_reminders")
    .select("*")
    .is("sent_at", null)
    .lte("fire_at", now.toISOString())
    .limit(50);
  let sent = 0;
  for (const r of (due ?? []) as Array<{ id: string; item_id: string; kind: string; payload: { minutes?: number } }>) {
    const item = await getItem(db, r.item_id);
    if (!item || item.status === "canceled" || (item.status === "done" && r.kind !== "followup")) {
      await db.from("calendar_reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
      continue;
    }
    if (r.kind === "before") {
      const mins = r.payload?.minutes ?? 60;
      const text = `⏰ Через ${mins} мин:\n${line(item, dirs, prefs.tz)}`;
      if (cid) await tgSend(cid, text, itemButtons(item));
      await pushOutbox(db, { text, kind: "reminder", item_id: item.id });
      await pushAliceReminder(db, prefs, `Через ${mins} минут: ${item.title}`);
    } else if (r.kind === "followup" && item.status !== "done") {
      const text = `Как прошло: <b>${tgEsc(item.title)}</b>?`;
      if (cid) {
        await tgSend(cid, text, [
          [
            { text: "✅ Сделано", data: `done:${item.id}` },
            { text: "🕒 Перенести", data: `move:${item.id}` },
          ],
          [{ text: "Оставить как есть", data: `keep:${item.id}` }],
        ]);
      }
      await pushOutbox(db, { text, kind: "followup", item_id: item.id });
    }
    await db.from("calendar_reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
    sent += 1;
  }

  // 3. Утренний и вечерний дайджест — по одному разу в день.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: prefs.tz }).format(now);
  const { data: st } = await db.from("calendar_sync_state").select("*").eq("id", 1).maybeSingle();
  const state = (st ?? {}) as { last_morning_on?: string | null; last_evening_on?: string | null; last_weekly_on?: string | null };
  if (nowHm >= prefs.morning_time && state.last_morning_on !== today) {
    await sendDailyDigest(db, "morning");
    await db.from("calendar_sync_state").update({ last_morning_on: today }).eq("id", 1);
    digests.push("morning");
  }
  // Понедельник — обзор недели (один раз, после времени утреннего дайджеста).
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: prefs.tz }).format(now);
  if (weekday === "Mon" && nowHm >= prefs.morning_time && state.last_weekly_on !== today) {
    await sendWeeklyReview(db);
    await db.from("calendar_sync_state").update({ last_weekly_on: today }).eq("id", 1);
    digests.push("weekly");
  }
  if (nowHm >= prefs.evening_time && state.last_evening_on !== today) {
    await sendDailyDigest(db, "evening");
    await db.from("calendar_sync_state").update({ last_evening_on: today }).eq("id", 1);
    digests.push("evening");
  }

  return { reminders: sent, digests, pulled };
}

/**
 * Зеркалирование действий из других каналов (Алиса) в Telegram-чат владельца,
 * чтобы вся история ассистента оставалась в одном месте.
 */
export async function mirrorAssistantToTelegram(
  db: Db,
  result: AssistantResult,
  utterance: string,
): Promise<void> {
  const cid = await chatId(db);
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const head = `🗣 <b>Алиса</b>: «${tgEsc(utterance)}»`;
  if (result.items.length && (result.intent === "create" || result.intent === "done")) {
    await tgSend(cid, head);
    for (const item of result.items.slice(0, 5)) {
      await tgSend(cid, line(item, dirs, prefs.tz), itemButtons(item));
    }
  } else {
    await tgSend(cid, `${head}\n${tgEsc(result.text)}`);
  }
  await pushOutbox(db, { text: `Алиса: ${result.text}`, kind: "alice", channel: "alice" });
}
