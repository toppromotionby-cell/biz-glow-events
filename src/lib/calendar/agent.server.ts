// Мозг ассистента: разбор входящих из Telegram, дайджесты, напоминания, контроль.
import type { CalDirection, CalItem } from "@/lib/calendar/model";
import { fmtWhen, freeSlots, isOverdue, localHm, priorityScore, STATUS_LABEL } from "@/lib/calendar/model";
import { adviseDay, AiBlockedError, parseIntent, transcribeVoice } from "@/lib/calendar/parse.server";
import { tgAnswerCallback, tgDownloadFile, tgEdit, tgEsc, tgSend } from "@/lib/calendar/telegram.server";
import {
  admin,
  deleteItem,
  getDirections,
  getItem,
  getPrefs,
  listItemsBetween,
  listOpenTail,
  pullFromGoogle,
  rescheduleItem,
  saveItem,
  setStatus,
} from "@/lib/calendar/store.server";

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
        "/week — план на неделю",
        "/open — незакрытые хвосты",
      ].join("\n"),
    );
    return;
  }
  if (cmd === "/today" || cmd === "сегодня") return void (await sendDailyDigest(db, "morning"));
  if (cmd === "/week" || cmd === "неделя") return void (await sendWeek(db));
  if (cmd === "/open") return void (await sendOpenTail(db));

  const { data: inbox } = await db
    .from("calendar_inbox")
    .insert({ chat_id: chatId, source: opts.source, raw_text: text, status: "parsing", payload: (opts.raw ?? {}) as never })
    .select("id")
    .maybeSingle();
  const inboxId = (inbox as { id?: string } | null)?.id ?? null;

  let parsed;
  try {
    parsed = await parseIntent(text, { tz: prefs.tz, directions: dirs, style: prefs.style_profile });
  } catch (e) {
    const msg = e instanceof AiBlockedError ? "ИИ временно недоступен, попробуйте позже." : "Не смог разобрать сообщение.";
    if (inboxId) await db.from("calendar_inbox").update({ status: "error", error: String(e) }).eq("id", inboxId);
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
    await tgSend(cid, [head, body, tail, advice ? `\n💡 ${tgEsc(advice)}` : ""].filter(Boolean).join("\n"));
    return;
  }

  const done = items.filter((i) => i.status === "done");
  const left = items.filter((i) => i.status !== "done" && i.status !== "canceled");
  await tgSend(
    cid,
    [
      `🌙 <b>Итоги дня</b>`,
      `Сделано: ${done.length} · Осталось: ${left.length}`,
      done.length ? `\n<b>Закрыто</b>\n${done.map((i) => `✅ ${tgEsc(i.title)}`).join("\n")}` : "",
      left.length ? `\n<b>Не закрыто</b>\n${left.map((i) => line(i, dirs, prefs.tz)).join("\n")}` : "",
      left.length ? "\nЧто из этого переносим? Нажмите «Перенести» у нужной записи в /open." : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function sendWeek(db: Db): Promise<void> {
  const cid = await chatId(db);
  if (!cid) return;
  const prefs = await getPrefs(db);
  const dirs = await getDirections(db);
  const items = await listItemsBetween(db, new Date().toISOString(), new Date(Date.now() + 7 * 86_400_000).toISOString());
  await tgSend(
    cid,
    items.length ? `📅 <b>Ближайшие 7 дней</b>\n${groupByDirection(items, dirs, prefs.tz)}` : "На неделе пусто.",
  );
}

export async function sendOpenTail(db: Db): Promise<void> {
  const cid = await chatId(db);
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
    if (cid) {
      if (r.kind === "before") {
        const mins = r.payload?.minutes ?? 60;
        await tgSend(cid, `⏰ Через ${mins} мин:\n${line(item, dirs, prefs.tz)}`, itemButtons(item));
      } else if (r.kind === "followup" && item.status !== "done") {
        await tgSend(cid, `Как прошло: <b>${tgEsc(item.title)}</b>?`, [
          [
            { text: "✅ Сделано", data: `done:${item.id}` },
            { text: "🕒 Перенести", data: `move:${item.id}` },
          ],
          [{ text: "Оставить как есть", data: `keep:${item.id}` }],
        ]);
      }
    }
    await db.from("calendar_reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
    sent += 1;
  }

  // 3. Утренний и вечерний дайджест — по одному разу в день.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: prefs.tz }).format(now);
  const { data: st } = await db.from("calendar_sync_state").select("*").eq("id", 1).maybeSingle();
  const state = (st ?? {}) as { last_morning_on?: string | null; last_evening_on?: string | null };
  if (nowHm >= prefs.morning_time && state.last_morning_on !== today) {
    await sendDailyDigest(db, "morning");
    await db.from("calendar_sync_state").update({ last_morning_on: today }).eq("id", 1);
    digests.push("morning");
  }
  if (nowHm >= prefs.evening_time && state.last_evening_on !== today) {
    await sendDailyDigest(db, "evening");
    await db.from("calendar_sync_state").update({ last_evening_on: today }).eq("id", 1);
    digests.push("evening");
  }

  return { reminders: sent, digests, pulled };
}
