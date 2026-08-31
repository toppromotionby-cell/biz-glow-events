// Транспорт бота-помощника к Telegram Bot API через connector-gateway (только сервер).
// У помощника собственный бот: ключ подключения отдельный от бота сайта, планера и DJ-бота.
const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export interface TgButton {
  text: string;
  data: string;
}

/** Ключ подключения Telegram-коннектора для бота-помощника. */
export function assistantTgKey(): string | null {
  return (
    process.env.ASSISTANT_TELEGRAM_API_KEY ||
    process.env.TELEGRAM_ASSISTANT_API_KEY ||
    process.env.TELEGRAM_API_KEY_3 ||
    null
  );
}

/** Подключён ли помощнику собственный бот. */
export function assistantBotConfigured(): boolean {
  return Boolean(assistantTgKey() && process.env.LOVABLE_API_KEY);
}

function keys(): { lovable: string; tg: string } | null {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = assistantTgKey();
  if (!lovable || !tg) return null;
  return { lovable, tg };
}

export function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function keyboard(rows: TgButton[][] | undefined) {
  if (!rows?.length) return undefined;
  return {
    inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data.slice(0, 60) }))),
  };
}

async function call<T = unknown>(method: string, body: unknown): Promise<T | null> {
  const k = keys();
  if (!k) {
    console.error(`[assistant-tg] ${method}: бот не настроен (нет ключа подключения)`);
    return null;
  }
  try {
    const res = await fetch(`${GATEWAY}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k.lovable}`,
        "X-Connection-Api-Key": k.tg,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: T; description?: string }
      | null;
    if (!res.ok || !json?.ok) {
      console.error(`[assistant-tg] ${method} failed [${res.status}]: ${json?.description ?? "нет тела ответа"}`);
      return null;
    }
    return (json.result ?? null) as T | null;
  } catch (e) {
    console.error(`[assistant-tg] ${method} error`, e instanceof Error ? e.message : e);
    return null;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Режем длинный текст по лимиту Telegram (4096), стараясь по переводам строк. */
export function splitText(text: string, limit = 3800): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const cut = rest.lastIndexOf("\n", limit);
    const at = cut > limit * 0.5 ? cut : limit;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

export async function tgSend(
  chatId: number | string,
  text: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number } | null> {
  const chunks = splitText(text);
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
      // Второй заход без разметки: модель могла собрать невалидный HTML.
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

export async function tgEdit(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: TgButton[][],
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
}

export async function tgAnswerCallback(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, text: text?.slice(0, 190) });
}

export async function tgGetMe(): Promise<{ id: number; username?: string; first_name?: string } | null> {
  return call<{ id: number; username?: string; first_name?: string }>("getMe", {});
}

export async function tgWebhookInfo(): Promise<{
  url?: string;
  last_error_message?: string;
  pending_update_count?: number;
} | null> {
  return call("getWebhookInfo", {});
}

export async function tgSetWebhook(url: string, secret: string): Promise<boolean> {
  const res = await call<boolean>("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
  return res === true;
}

export async function tgSetMyCommands(): Promise<boolean> {
  const res = await call<boolean>("setMyCommands", {
    commands: [
      { command: "help", description: "Что я умею" },
      { command: "files", description: "Список документов и файлов" },
      { command: "doc", description: "Найти документ: /doc Белтелеком" },
      { command: "ask", description: "Вопрос помощнику" },
      { command: "find", description: "Поиск в интернете" },
      { command: "kb", description: "База знаний: /kb поиск | /kb add факт" },
      { command: "hygiene", description: "Гигиена данных: отчёт и проверка" },
      { command: "plan", description: "Собрать план на утверждение" },
      { command: "stats", description: "Сводка по работе" },
      { command: "sources", description: "Источники последнего ответа" },
      { command: "mute", description: "Приглушить уведомления" },
      { command: "unmute", description: "Вернуть уведомления" },
    ],
  });
  return res === true;
}

/** Максимальный размер файла для Bot API; держим запас. */
export const TG_MAX_FILE_BYTES = 45 * 1024 * 1024;

/** Отправка файла (multipart/form-data). */
export async function tgSendDocument(
  chatId: number | string,
  filename: string,
  bytes: Uint8Array,
  caption?: string,
  mime = "application/pdf",
): Promise<{ ok: boolean; error?: string }> {
  const k = keys();
  if (!k) return { ok: false, error: "Telegram не подключён: нет ключа бота" };
  if (!bytes?.byteLength) return { ok: false, error: "Пустой файл" };
  if (bytes.byteLength > TG_MAX_FILE_BYTES) return { ok: false, error: "Файл больше 45 МБ — Telegram такой не примет" };

  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption.slice(0, 1000));
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([bytes.slice()], { type: mime }), filename);

  try {
    const res = await fetch(`${GATEWAY}/sendDocument`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k.lovable}`, "X-Connection-Api-Key": k.tg },
      body: form,
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !json?.ok) return { ok: false, error: json?.description ?? `Telegram вернул ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сети при отправке файла" };
  }
}

/** Скачивание файла из Telegram (голосовые сообщения). */
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
    console.error(`[assistant-tg] file download failed [${res.status}]`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = path.endsWith(".mp3") ? "audio/mpeg" : path.endsWith(".m4a") ? "audio/mp4" : "audio/ogg";
  return { base64: buf.toString("base64"), mime };
}
