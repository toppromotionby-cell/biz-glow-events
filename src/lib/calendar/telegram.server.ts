// Транспорт к Telegram Bot API через connector-gateway (только сервер).
const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export interface TgButton {
  text: string;
  data: string;
}

function keys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = process.env.TELEGRAM_API_KEY;
  if (!lovable || !tg) return null;
  return { lovable, tg };
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

export async function tgSend(
  chatId: number | string,
  text: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number } | null> {
  return call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
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

/** Скачивание голосового сообщения: getFile → /file/<path>. */
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
  const mime = path.endsWith(".mp3") ? "audio/mpeg" : path.endsWith(".m4a") ? "audio/mp4" : "audio/ogg";
  return { base64: buf.toString("base64"), mime };
}
