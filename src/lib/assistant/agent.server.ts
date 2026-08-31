// Мозг бота-помощника: команды, свободный диалог, план-режим, знания, файлы, гигиена.
import { toTgHtml } from "@/lib/calendar/tg-format";
import { helpText, refusal, systemPrompt } from "@/lib/assistant/persona";
import {
  getSettings,
  identify,
  logMessage,
  recentDialog,
  redeemLinkCode,
  resetDialog,
  setMuted,
  withinDailyLimit,
  type Identity,
} from "@/lib/assistant/store.server";
import { docButtons, renderDocList, searchDocs, sendDoc } from "@/lib/assistant/files.server";
import { contextBlock, research, sourcesBlock } from "@/lib/assistant/research.server";
import { knowledgeContext, searchFacts, setFactStatus, upsertFact } from "@/lib/knowledge/facts.server";
import { decideFinding, openFindings, renderReport, runHygiene } from "@/lib/hygiene/engine.server";
import { tgAnswerCallback, tgEdit, tgFetchFile, tgSend, type TgButton } from "@/lib/assistant/transport.server";
import { TG_DOC_KINDS, type TgDocKind } from "@/lib/telegram/doc-kinds";
import { cardButtons, renderCard, renderDecided, stripFakeButtons, type AssistantPlanStep } from "@/lib/assistant/cards";
import {
  attachMessage,
  checkPlan,
  createPlan,
  executePlan,
  getPlan,
  planAwaitingEdit,
  setPlanStatus,
} from "@/lib/assistant/plans.server";
import { acceptsAttachment, analyzeAttachments, type Attachment } from "@/lib/assistant/vision.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export interface TgPhotoSize {
  file_id: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface TgMessage {
  message_id: number;
  chat: { id: number; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  voice?: { file_id: string };
  photo?: TgPhotoSize[];
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
  from?: { username?: string; first_name?: string };
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
}

/** Крупнейшее из превью фото (Telegram присылает лестницу размеров). */
export function largestPhoto(photos: TgPhotoSize[] | undefined): TgPhotoSize | null {
  if (!photos?.length) return null;
  return [...photos].sort((a, b) => (a.file_size ?? 0) - (b.file_size ?? 0)).at(-1) ?? null;
}

/* --------------------------------- модель --------------------------------- */

async function ask(system: string, history: { role: string; content: string }[], user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return "⚠️ ИИ не подключён: нет ключа шлюза. Скажите администратору.";
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...history.slice(-10), { role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[assistant-ai] ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 429) return "⏳ Слишком много запросов подряд. Попробуйте через минуту.";
      if (res.status === 402) return "💳 Закончились кредиты ИИ. Нужно пополнить баланс в Lovable.";
      if (res.status === 403) return "🚫 Доступ к ИИ заблокирован настройками рабочего пространства.";
      return "⚠️ ИИ временно недоступен. Данные портала по командам /files, /kb, /hygiene работают.";
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "Не смог сформулировать ответ. Переформулируйте, пожалуйста.";
  } catch (e) {
    console.error("[assistant-ai] failed", e instanceof Error ? e.message : e);
    return "⚠️ Не получилось обратиться к ИИ. Попробуйте ещё раз.";
  }
}

/* --------------------------------- утилиты --------------------------------- */

function isCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?\s*([\s\S]*)$/i.exec(text.trim());
  if (!m) return null;
  return { cmd: (m[1] ?? "").toLowerCase(), arg: (m[2] ?? "").trim() };
}

function wantsWeb(text: string): boolean {
  return /(поищи|погугли|найди в интернете|в интернете|источник|как у других|что пишут)/i.test(text);
}

function planWorthy(text: string): boolean {
  return /(перенеси все|массово|удали все|разошли|обнови все|переделай|пересчитай все|мигрируй|автоматизируй)/i.test(text);
}

/* ------------------------------ обработка апдейта ------------------------------ */

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) return;

  const chatId = msg.chat.id;
  const who = await identify(chatId);
  const settings = await getSettings();

  let text = (msg.text ?? msg.caption ?? "").trim();
  const photo = largestPhoto(msg.photo);
  const hasAttachment = Boolean(photo || msg.document);

  // Голос → текст (транскрипция уже реализована для планера, переиспользуем модель).
  if (!text && msg.voice) {
    text = (await transcribe(msg.voice.file_id)) ?? "";
    if (!text) {
      await tgSend(chatId, "🎙 Не разобрал голосовое. Продиктуйте ещё раз или напишите текстом.");
      return;
    }
  }
  if (!text && !hasAttachment) return;

  await logMessage({ chatId, userId: who.userId, direction: "in", text: text || "[вложение]" });

  // Привязка чата к сотруднику по коду.
  if (!who.userId) {
    if (/^[0-9A-F]{8}$/i.test(text)) {
      const userId = await redeemLinkCode(text, {
        id: chatId,
        username: msg.from?.username ?? null,
        first_name: msg.from?.first_name ?? null,
      });
      if (userId) {
        await reply(chatId, who, "✅ Чат привязан. Наберите /help — покажу, что умею.");
        return;
      }
      await reply(chatId, who, "Код неверный или просрочен. Сгенерируйте новый в админке.");
      return;
    }
    await reply(chatId, who, helpText("guest"));
    return;
  }

  if (!who.isStaff) {
    await reply(chatId, who, refusal("У вашей учётной записи нет рабочих ролей."));
    return;
  }

  if (!(await withinDailyLimit(chatId, settings.daily_limit))) {
    await reply(chatId, who, "⏳ Достигнут суточный лимит запросов. Лимит меняется в админке → «Помощник».");
    return;
  }

  // Скриншот / PDF → разбор и карточка решения.
  if (hasAttachment) {
    await handleAttachment(who, msg, text, settings);
    return;
  }

  const c = isCommand(text);
  if (c) {
    await handleCommand(who, c.cmd, c.arg, settings);
    return;
  }

  // Ждём правки к ранее отправленной карточке.
  const editing = await planAwaitingEdit(chatId);
  if (editing) {
    await setPlanStatus(editing.id, "rejected", "Заменён уточнённым планом.");
    await reply(chatId, who, "✏️ Принял правки, пересобираю карточку…");
    await sendPlanCard(who, {
      title: editing.title,
      request: `${editing.request ?? ""}\n\nПравки: ${text}`.trim(),
      settings,
    });
    return;
  }

  await freeform(who, text, settings);
}

/* ------------------------------ вложения (скриншоты) ------------------------------ */

async function handleAttachment(
  who: Identity,
  msg: TgMessage,
  caption: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  const chatId = who.chatId;
  const photo = largestPhoto(msg.photo);
  const source = photo
    ? { fileId: photo.file_id, mime: "image/jpeg", size: photo.file_size ?? 0, name: "screenshot.jpg" }
    : {
        fileId: msg.document?.file_id ?? "",
        mime: msg.document?.mime_type ?? "application/octet-stream",
        size: msg.document?.file_size ?? 0,
        name: msg.document?.file_name ?? "file",
      };
  if (!source.fileId) return;

  const pre = acceptsAttachment(source.mime, source.size || 1);
  if (!pre.ok) {
    await reply(chatId, who, `📎 ${pre.reason}`);
    return;
  }

  await tgSend(chatId, "👀 Смотрю, что на скриншоте…");
  const file = await tgFetchFile(source.fileId, source.mime);
  if (!file) {
    await reply(chatId, who, "⚠️ Не удалось скачать файл из Telegram. Пришлите ещё раз.");
    return;
  }
  const check = acceptsAttachment(file.mime, file.bytes);
  if (!check.ok) {
    await reply(chatId, who, `📎 ${check.reason}`);
    return;
  }

  const attachment: Attachment = {
    fileId: source.fileId,
    mime: file.mime,
    base64: file.base64,
    bytes: file.bytes,
    filename: source.name,
  };

  const out = await analyzeAttachments({
    system: systemPrompt({
      isAdmin: who.isAdmin,
      roles: who.roles,
      webSearch: settings.allow_web_search,
      planOnly: true,
    }),
    attachments: [attachment],
    question: caption || "Разбери скриншот: что не так и что предлагаешь сделать.",
    context: await knowledgeContext(caption || "ошибка админки"),
  });

  if (!out.ok) {
    await reply(chatId, who, out.message);
    return;
  }

  const plan = await createPlan({
    chatId,
    title: out.result.title,
    summary: out.result.summary,
    request: caption || "Разбор скриншота",
    steps: out.result.steps,
    questions: out.result.questions,
    attachments: [{ file_id: source.fileId, mime: file.mime, kind: photo ? "photo" : "document" }],
  });

  if (!plan) {
    await reply(chatId, who, toTgHtml(stripFakeButtons(out.result.summary)));
    return;
  }

  const body = renderCard({
    id: plan.id,
    title: out.result.title,
    summary: out.result.summary,
    steps: out.result.steps,
    risk: out.result.risk,
    questions: out.result.questions,
  });
  const sent = await tgSend(chatId, body, cardButtons(plan.id));
  if (sent) await attachMessage(plan.id, sent.message_id);
  await logMessage({ chatId, userId: who.userId, direction: "out", text: body });
}

/** Собирает план по задаче и отправляет карточкой с живыми кнопками. */
async function sendPlanCard(
  who: Identity,
  opts: { title: string; request: string; settings: Awaited<ReturnType<typeof getSettings>> },
): Promise<void> {
  const raw = await ask(
    systemPrompt({
      isAdmin: who.isAdmin,
      roles: who.roles,
      webSearch: opts.settings.allow_web_search,
      planOnly: true,
    }),
    await recentDialog(who.chatId),
    `Задача: ${opts.request}\n\nСобери план: цель, шаги 3–7, что изменится, риски. Ничего не выполняй. Подписи кнопок не пиши.`,
  );
  const summary = toTgHtml(stripFakeButtons(raw));
  const steps: AssistantPlanStep[] = [];
  const plan = await createPlan({
    chatId: who.chatId,
    title: opts.title.slice(0, 120),
    summary,
    request: opts.request,
    steps,
  });
  if (!plan) {
    await reply(who.chatId, who, summary);
    return;
  }
  const body = renderCard({ id: plan.id, title: "План на утверждение", summary, steps });
  const sent = await tgSend(who.chatId, body, cardButtons(plan.id));
  if (sent) await attachMessage(plan.id, sent.message_id);
  await logMessage({ chatId: who.chatId, userId: who.userId, direction: "out", text: body });
}

async function reply(chatId: number, who: Identity, text: string, buttons?: TgButton[][]): Promise<void> {
  await tgSend(chatId, text, buttons);
  await logMessage({ chatId, userId: who.userId, direction: "out", text });
}

/* --------------------------------- команды --------------------------------- */

async function handleCommand(
  who: Identity,
  cmd: string,
  arg: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  switch (cmd) {
    case "start":
    case "help":
      return reply(who.chatId, who, helpText(who.isAdmin ? "admin" : "staff"));

    case "reset":
      await resetDialog(who.chatId);
      return reply(who.chatId, who, "🧽 Контекст диалога сброшен.");

    case "mute":
      await setMuted(who.chatId, new Date(Date.now() + 8 * 3600_000));
      return reply(who.chatId, who, "🔕 Уведомления приглушены на 8 часов.");

    case "unmute":
      await setMuted(who.chatId, null);
      return reply(who.chatId, who, "🔔 Уведомления снова включены.");

    case "files":
    case "doc": {
      const hits = await searchDocs(arg, 8);
      if (!hits.length) return reply(who.chatId, who, "Ничего не нашёл. Уточните номер, клиента или название.");
      return reply(
        who.chatId,
        who,
        `📁 <b>Документы</b>\n${renderDocList(hits)}\n\nНажмите кнопку — пришлю PDF.`,
        docButtons(hits, who.isAdmin),
      );
    }

    case "kb": {
      if (/^add\s+/i.test(arg)) {
        const body = arg.replace(/^add\s+/i, "").trim();
        const [subject, ...rest] = body.split(/\s*[:—-]\s*/);
        const fact = rest.join(" — ") || body;
        if (!body) return reply(who.chatId, who, "Формат: /kb add Тема — факт");
        await upsertFact({
          subject: subject || "Общее",
          fact,
          sourceKind: "dialog",
          authorId: who.userId,
          confidence: 0.8,
        });
        return reply(who.chatId, who, "🧠 Записал в базу знаний.");
      }
      const rows = await searchFacts(arg, 8);
      if (!rows.length) return reply(who.chatId, who, "В базе знаний пусто по этому запросу. Добавить: /kb add Тема — факт");
      return reply(
        who.chatId,
        who,
        "🧠 <b>База знаний</b>\n" +
          rows.map((r, i) => `${i + 1}. <b>${r.subject}</b> — ${r.fact.slice(0, 220)}`).join("\n"),
      );
    }

    case "hygiene": {
      if (!who.isAdmin) return reply(who.chatId, who, refusal("Гигиена данных доступна только администратору."));
      await reply(who.chatId, who, "🧹 Запускаю проверку данных…");
      const rep = await runHygiene();
      const items = await openFindings(5);
      const buttons: TgButton[][] = items.map((f) => [
        { text: `✅ ${f.title.slice(0, 20)}`, data: `hyg:fix:${f.id}` },
        { text: "🚫", data: `hyg:skip:${f.id}` },
      ]);
      return reply(who.chatId, who, renderReport(rep), buttons.length ? buttons : undefined);
    }

    case "find": {
      if (!arg) return reply(who.chatId, who, "Что искать? Например: /find тренды event-оформления 2026");
      if (!settings.allow_web_search) return reply(who.chatId, who, "Интернет-поиск отключён администратором.");
      const hits = await research(arg, 5);
      if (!hits.length) return reply(who.chatId, who, "Поиск ничего не дал. Попробуйте другую формулировку.");
      const answer = await ask(
        systemPrompt({ isAdmin: who.isAdmin, roles: who.roles, webSearch: true, planOnly: settings.plan_only }),
        [],
        `Вопрос: ${arg}\n\n${contextBlock(hits)}\n\nСделай выжимку по существу и обязательно сошлись на источники.`,
      );
      return reply(who.chatId, who, answer + sourcesBlock(hits));
    }

    case "plan": {
      if (!arg) return reply(who.chatId, who, "Опишите задачу: /plan перенести все КП сентября в архив");
      const answer = await ask(
        systemPrompt({ isAdmin: who.isAdmin, roles: who.roles, webSearch: settings.allow_web_search, planOnly: true }),
        [],
        `Задача: ${arg}\n\nСобери план: цель, шаги 3–7, что изменится, риски. Ничего не выполняй.`,
      );
      return reply(who.chatId, who, `🗂 <b>План на утверждение</b>\n\n${answer}`, PLAN_BUTTONS);
    }

    case "stats":
      return reply(who.chatId, who, await stats(arg));

    case "sources":
      return reply(who.chatId, who, "Источники приходят вместе с ответом /find. Отдельного хранилища не веду.");

    case "ask":
      return freeform(who, arg || "Расскажи, что умеешь", settings);

    default:
      return reply(who.chatId, who, `Не знаю команду /${cmd}. Наберите /help.`);
  }
}

/* ------------------------------ свободный диалог ------------------------------ */

async function freeform(
  who: Identity,
  text: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  if (settings.plan_only || planWorthy(text)) {
    const plan = await ask(
      systemPrompt({ isAdmin: who.isAdmin, roles: who.roles, webSearch: settings.allow_web_search, planOnly: true }),
      await recentDialog(who.chatId),
      `Задача: ${text}\n\nЭто нестандартная или массовая операция. Собери план на утверждение, ничего не выполняй.`,
    );
    await reply(who.chatId, who, `🗂 <b>План на утверждение</b>\n\n${toTgHtml(plan)}`, PLAN_BUTTONS);
    return;
  }

  const kb = await knowledgeContext(text);
  const docs = /(кп|документ|презентац|счет|счёт|акт|договор|заявк)/i.test(text) ? await searchDocs(text, 5) : [];
  const web = settings.allow_web_search && wantsWeb(text) ? await research(text, 4) : [];

  const parts = [
    kb,
    docs.length ? `Документы портала по запросу:\n${renderDocList(docs)}` : "",
    web.length ? contextBlock(web) : "",
  ].filter(Boolean);

  const answer = await ask(
    systemPrompt({
      isAdmin: who.isAdmin,
      roles: who.roles,
      webSearch: settings.allow_web_search,
      planOnly: settings.plan_only,
    }),
    await recentDialog(who.chatId),
    parts.length ? `${text}\n\n---\n${parts.join("\n\n")}` : text,
  );

  const buttons: TgButton[][] = [];
  if (docs.length) buttons.push(...docButtons(docs, who.isAdmin));
  const memorable = /(реквизит|всегда|правило|договорились|запомни|по умолчанию|тариф|скидка)/i.test(text);
  if (memorable) buttons.push([{ text: "🧠 Записать в базу знаний", data: "kb:save" }]);

  await reply(who.chatId, who, toTgHtml(answer) + sourcesBlock(web), buttons.length ? buttons : undefined);
}

/* --------------------------------- callbacks --------------------------------- */

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = cb.message?.chat.id;
  if (!chatId) return;
  const who = await identify(chatId);
  const data = cb.data ?? "";

  if (!who.isStaff) {
    await tgAnswerCallback(cb.id, "Недостаточно прав");
    return;
  }

  if (data.startsWith("doc:")) {
    const [, kind, id] = data.split(":");
    if (!kind || !id || !TG_DOC_KINDS.includes(kind as TgDocKind)) {
      await tgAnswerCallback(cb.id, "Неизвестный документ");
      return;
    }
    await tgAnswerCallback(cb.id, "Готовлю PDF…");
    const res = await sendDoc(who, kind as TgDocKind, id);
    if (!res.ok) await reply(chatId, who, res.message);
    return;
  }

  if (data.startsWith("hyg:")) {
    const [, action, id] = data.split(":");
    if (!id) return;
    if (!who.isAdmin) {
      await tgAnswerCallback(cb.id, "Только для администратора");
      return;
    }
    await decideFinding(id, action === "fix" ? "fixed" : "dismissed", who.userId);
    await tgAnswerCallback(cb.id, action === "fix" ? "Отмечено как исправленное" : "Пропущено");
    return;
  }

  if (data === "kb:save") {
    const hist = await recentDialog(chatId, 4);
    const last = [...hist].reverse().find((h) => h.role === "user");
    if (!last) {
      await tgAnswerCallback(cb.id, "Нечего сохранять");
      return;
    }
    await upsertFact({
      subject: last.content.split(/[.\n]/)[0]?.slice(0, 120) || "Из диалога",
      fact: last.content,
      sourceKind: "dialog",
      authorId: who.userId,
      confidence: 0.7,
    });
    await tgAnswerCallback(cb.id, "Записал в базу знаний");
    return;
  }

  if (data.startsWith("plan:")) {
    const action = data.split(":")[1];
    if (action === "ok") {
      await tgAnswerCallback(cb.id, "План утверждён");
      await reply(chatId, who, "✅ План утверждён. Напишите, с какого шага начинаем.");
    } else if (action === "edit") {
      await tgAnswerCallback(cb.id, "Жду правки");
      await reply(chatId, who, "✏️ Напишите, что поправить в плане.");
    } else {
      await tgAnswerCallback(cb.id, "Отменено");
      await reply(chatId, who, "🚫 План отменён.");
    }
    return;
  }

  await tgAnswerCallback(cb.id);
}

/* ---------------------------------- прочее ---------------------------------- */

async function stats(period: string): Promise<string> {
  const days = /месяц/i.test(period) ? 30 : /недел/i.test(period) ? 7 : 1;
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  const { admin } = await import("@/lib/assistant/store.server");
  const db = await admin();
  const [orders, quotes, findings] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("quotes").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("hygiene_findings").select("id", { count: "exact", head: true }).in("status", ["open", "needs_review"]),
  ]);
  return [
    `📊 <b>Сводка за ${days === 1 ? "сутки" : `${days} дн.`}</b>`,
    `Заявки: <b>${orders.count ?? 0}</b>`,
    `КП: <b>${quotes.count ?? 0}</b>`,
    `Открытых замечаний по данным: <b>${findings.count ?? 0}</b>`,
  ].join("\n");
}

/** Расшифровка голосового через мультимодальную модель. */
async function transcribe(fileId: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const { tgDownloadFile } = await import("@/lib/assistant/transport.server");
  const file = await tgDownloadFile(fileId);
  if (!file) return null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Расшифруй запись дословно на русском. Верни только текст." },
              { type: "input_audio", input_audio: { data: file.base64, format: file.mime.includes("mp") ? "mp3" : "ogg" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Рассылка администратору (отчёты гигиены, важные уведомления). */
export async function notifyAdmins(text: string, buttons?: TgButton[][]): Promise<number> {
  const { allLinks, getSettings: gs } = await import("@/lib/assistant/store.server");
  const settings = await gs();
  const links = await allLinks();
  const targets = new Set<number>();
  if (settings.admin_chat_id) targets.add(settings.admin_chat_id);
  for (const l of links) {
    if (l.muted_until && new Date(l.muted_until) > new Date()) continue;
    const who = await identify(l.chat_id);
    if (who.isAdmin) targets.add(l.chat_id);
  }
  let sent = 0;
  for (const chatId of targets) {
    const ok = await tgSend(chatId, text, buttons);
    if (ok) sent += 1;
  }
  return sent;
}

export { setFactStatus };
