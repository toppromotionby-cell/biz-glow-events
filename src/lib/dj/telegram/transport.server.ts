import { sanitizeTgHtml } from "@/lib/calendar/tg-format";
// Транспорт DJ-бота к Telegram Bot API через connector-gateway (только сервер).
// У DJ-раздела собственный бот: ключ подключения отдельный от бота сайта и планера.
const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export interface TgButton {
  text: string;
  data: string;
}

/** Ключ подключения Telegram-коннектора для DJ-бота. */
export function djTgKey(): string | null {
  return (
    process.env.DJ_TELEGRAM_API_KEY ||
    process.env.TELEGRAM_DJ_API_KEY ||
    process.env.TELEGRAM_API_KEY_2 ||
    null
  );
}

/** Подключён ли DJ-разделу собственный бот. */
export function djBotConfigured(): boolean {
  return Boolean(djTgKey() && process.env.LOVABLE_API_KEY);
}

function keys(): { lovable: string; tg: string } | null {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = djTgKey();
  if (!lovable || !tg) return null;
  return { lovable, tg };
}

export function tgEsc(s: string | null | undefined): string {
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
    console.error(`[dj-tg] ${method}: бот не настроен (нет ключа подключения)`);
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
      console.error(`[dj-tg] ${method} failed [${res.status}]: ${json?.description ?? "нет тела ответа"}`);
      return null;
    }
    return (json.result ?? null) as T | null;
  } catch (e) {
    console.error(`[dj-tg] ${method} error`, e instanceof Error ? e.message : e);
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
  const chunks = splitText(sanitizeTgHtml(text));
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
    text: splitText(text)[0],
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
}

export async function tgEditCaption(
  chatId: number | string,
  messageId: number,
  caption: string,
  buttons?: TgButton[][],
): Promise<void> {
  await call("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption: caption.slice(0, 1000),
    parse_mode: "HTML",
    reply_markup: keyboard(buttons),
  });
}

export async function tgAnswerCallback(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, text: text?.slice(0, 190) });
}

export async function tgSendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number } | null> {
  const sent = await call<{ message_id: number }>("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption ? caption.slice(0, 1000) : undefined,
    parse_mode: "HTML",
    reply_markup: keyboard(buttons),
  });
  // Если Telegram не смог скачать картинку — отправляем текстом, чтобы событие не потерялось.
  if (!sent && caption) return tgSend(chatId, caption, buttons);
  return sent;
}

/** Аудио-превью трека: Telegram сам скачивает файл по подписанной ссылке. */
export async function tgSendAudio(
  chatId: number | string,
  audioUrl: string,
  opts: { title?: string; performer?: string; caption?: string; duration?: number; buttons?: TgButton[][] } = {},
): Promise<{ message_id: number } | null> {
  return call<{ message_id: number }>("sendAudio", {
    chat_id: chatId,
    audio: audioUrl,
    title: opts.title?.slice(0, 64),
    performer: opts.performer?.slice(0, 64),
    duration: opts.duration,
    caption: opts.caption ? opts.caption.slice(0, 1000) : undefined,
    parse_mode: "HTML",
    reply_markup: keyboard(opts.buttons),
  });
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
    allowed_updates: ["message", "edited_message", "callback_query", "my_chat_member"],
    drop_pending_updates: true,
  });
  return res === true;
}

export async function tgSetMyCommands(): Promise<boolean> {
  const res = await call<boolean>("setMyCommands", {
    commands: [
      { command: "start", description: "Привязка аккаунта и справка" },
      { command: "queue", description: "Очередь модерации треков" },
      { command: "track", description: "Поиск трека: /track kalush" },
      { command: "members", description: "Участники диджей-пула" },
      { command: "stats", description: "Статистика: /stats неделя" },
      { command: "hygiene", description: "Спящий контент и чистка" },
      { command: "pack", description: "Состав пака: /pack свадьба" },
      { command: "mute", description: "Приглушить уведомления" },
      { command: "unmute", description: "Включить уведомления" },
      { command: "help", description: "Что я умею" },
    ],
  });
  return res === true;
}

/** Скачивание файла (голосовое сообщение): getFile → /file/<path>. */
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
    console.error(`[dj-tg] file download failed [${res.status}]`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = path.endsWith(".mp3") ? "audio/mpeg" : path.endsWith(".m4a") ? "audio/mp4" : "audio/ogg";
  return { base64: buf.toString("base64"), mime };
}
