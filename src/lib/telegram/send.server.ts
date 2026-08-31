// Транспорт к «боту сайта» в Telegram через connector-gateway (только сервер).
// Используется для служебных уведомлений и отправки файлов администратору.
const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

/** Ключ подключения Telegram-коннектора для бота сайта. */
export function siteTgKey(): string | null {
  return process.env.TELEGRAM_API_KEY || null;
}

/** Чат администратора по умолчанию. */
export function adminChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || null;
}

function keys(): { lovable: string; tg: string } | null {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = siteTgKey();
  if (!lovable || !tg) return null;
  return { lovable, tg };
}

export function tgEscape(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Максимальный размер файла для Bot API (50 МБ); держим запас. */
export const TG_MAX_FILE_BYTES = 45 * 1024 * 1024;

export async function tgSendMessage(chatId: string | number, text: string): Promise<boolean> {
  const k = keys();
  if (!k) return false;
  try {
    const res = await fetch(`${GATEWAY}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k.lovable}`,
        "X-Connection-Api-Key": k.tg,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error(`[tg-site] sendMessage failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[tg-site] sendMessage error", e instanceof Error ? e.message : e);
    return false;
  }
}

export interface TgDocumentResult {
  ok: boolean;
  error?: string;
}

/** Отправка файла в чат (multipart/form-data). Возвращает понятную ошибку. */
export async function tgSendDocument(
  chatId: string | number,
  filename: string,
  bytes: Uint8Array,
  caption?: string,
  mime = "application/pdf",
): Promise<TgDocumentResult> {
  const k = keys();
  if (!k) return { ok: false, error: "Telegram не подключён: нет ключа бота" };
  if (!bytes?.byteLength) return { ok: false, error: "Пустой файл" };
  if (bytes.byteLength > TG_MAX_FILE_BYTES) {
    return { ok: false, error: "Файл больше 45 МБ — Telegram такой не примет" };
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption.slice(0, 1000));
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([bytes.slice()], { type: mime }), filename);

  const timeout = AbortSignal.timeout(60_000);
  try {
    const res = await fetch(`${GATEWAY}/sendDocument`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k.lovable}`, "X-Connection-Api-Key": k.tg },
      body: form,
      signal: timeout,
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !body?.ok) {
      const description = body?.description ?? `HTTP ${res.status}`;
      console.error(`[tg-site] sendDocument failed [${res.status}]: ${description}`);
      return { ok: false, error: description };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[tg-site] sendDocument error", msg);
    return { ok: false, error: msg.includes("timed out") ? "Telegram не ответил вовремя" : msg };
  }
}
