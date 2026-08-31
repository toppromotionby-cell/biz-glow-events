// Транспорт к Telegram Bot API через connector-gateway (только сервер).
import { sanitizeTgHtml, splitTgText } from "@/lib/calendar/tg-format";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";


export interface TgButton {
  text: string;
  data: string;
}

/**
 * Ключ отдельного бота-планера. Порядок: явный planner-ключ → второе подключение
 * Telegram-коннектора → общий ключ сайта (фолбэк, пока отдельный бот не подключён).
 */
export function plannerTgKey(): string | null {
  return (
    process.env.TELEGRAM_PLANNER_API_KEY ||
    process.env.TELEGRAM_API_KEY_1 ||
    process.env.TELEGRAM_API_KEY_2 ||
    process.env.TELEGRAM_API_KEY ||
    null
  );
}

/** Подключён ли планеру собственный бот (а не общий бот сайта). */
export function plannerHasOwnBot(): boolean {
  return Boolean(
    process.env.TELEGRAM_PLANNER_API_KEY || process.env.TELEGRAM_API_KEY_1 || process.env.TELEGRAM_API_KEY_2,
  );
}

function keys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = plannerTgKey();
  if (!lovable || !tg) return null;
  return { lovable, tg };
}

export async function tgGetMe(): Promise<{ id: number; username?: string; first_name?: string } | null> {
  return call<{ id: number; username?: string; first_name?: string }>("getMe", {});
}

export async function tgWebhookInfo(): Promise<{ url?: string; last_error_message?: string; pending_update_count?: number } | null> {
  return call<{ url?: string; last_error_message?: string; pending_update_count?: number }>("getWebhookInfo", {});
}

export async function tgSetWebhook(url: string, secret: string): Promise<boolean> {
  const res = await call<boolean>("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
  return res === true;
}

export function tgEsc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function call<T = unknown>(method: string, body: unknown): Promise<T | null> {
  const k = keys();
  if (!k) return null;
  const res = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k.lovable}`,
      "X-Connection-Api-Key": k.tg,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!res.ok || !json?.ok) {
    console.error(`[tg] ${method} failed [${res.status}]: ${json?.description ?? "no body"}`);
    return null;
  }
  return (json.result ?? null) as T | null;
}

function keyboard(rows: TgButton[][] | undefined) {
  if (!rows?.length) return undefined;
  return { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data.slice(0, 60) }))) };
}

/**
 * Отправка сообщения: длинный текст режется на части, а если Telegram
 * отклонил HTML-разметку — повторяем без parse_mode, чтобы текст всё же дошёл.
 */
export async function tgSend(
  chatId: number | string,
  text: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number } | null> {
  const safe = sanitizeTgHtml(text);
  const chunks = splitTgText(safe);
  if (!chunks.length) return null;
  let last: { message_id: number } | null = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const isLast = i === chunks.length - 1;
    const payload = {
      chat_id: chatId,
      text: chunks[i],
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: isLast ? keyboard(buttons) : undefined,
    };
    let sent = await call<{ message_id: number }>("sendMessage", payload);
    if (!sent) {
      // Чаще всего причина — разметка: пробуем ещё раз чистым текстом.
      sent = await call<{ message_id: number }>("sendMessage", {
        ...payload,
        parse_mode: undefined,
        text: stripTags(chunks[i] as string),
      });
    }
    if (sent) last = sent;
  }
  return last;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Регистрация меню команд бота (видно по кнопке «/» в Telegram). */
export async function tgSetMyCommands(): Promise<boolean> {
  const res = await call<boolean>("setMyCommands", {
    commands: [
      { command: "today", description: "План на сегодня" },
      { command: "tomorrow", description: "План на завтра" },
      { command: "week", description: "Ближайшие 7 дней" },
      { command: "day", description: "План на дату: /day 5.09" },
      { command: "next", description: "Ближайшие дела" },
      { command: "overdue", description: "Просроченное" },
      { command: "open", description: "Незакрытые хвосты" },
      { command: "find", description: "Поиск: /find подрядчик" },
      { command: "plan", description: "Собрать план на утверждение" },
      { command: "ai", description: "Полезные нейросети и сервисы" },
      { command: "help", description: "Что я умею" },
    ],
  });
  return res === true;
}


export async function tgEdit(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: TgButton[][],
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: sanitizeTgHtml(text),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
}

export async function tgAnswerCallback(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, text: text?.slice(0, 190) });
}

/** Тип файла по расширению — нужен и для голоса, и для скриншотов с PDF. */
export function tgMimeOf(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".heic")) return "image/heic";
  if (p.endsWith(".pdf")) return "application/pdf";
  if (p.endsWith(".mp3")) return "audio/mpeg";
  if (p.endsWith(".m4a") || p.endsWith(".mp4")) return "audio/mp4";
  return "audio/ogg";
}

/** Скачивание файла из Telegram: getFile → /file/<path>. */
export async function tgDownloadFile(fileId: string): Promise<{ base64: string; mime: string } | null> {
  const k = keys();
  if (!k) return null;
  const info = await call<{ file_path?: string }>("getFile", { file_id: fileId });
  const path = info?.file_path;
  if (!path) return null;
  const res = await fetch(`${GATEWAY}/file/${path}`, {
    headers: { Authorization: `Bearer ${k.lovable}`, "X-Connection-Api-Key": k.tg },
  });
  if (!res.ok) {
    console.error(`[tg] file download failed [${res.status}]`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = tgMimeOf(path);
  return { base64: buf.toString("base64"), mime };
}

/** Отправка картинки по URL (Telegram скачивает файл сам) с подписью в HTML. */
export async function tgSendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number } | null> {
  return call<{ message_id: number }>("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption ? sanitizeTgHtml(caption).slice(0, 1000) : undefined,
    parse_mode: "HTML",
    reply_markup: keyboard(buttons),
  });
}
