// Общий транспорт к Google Таблицам через Lovable connector gateway.
// Только серверный код: читает LOVABLE_API_KEY и GOOGLE_SHEETS_API_KEY.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export class SheetSyncError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  // Может быть несколько подключений: свежее получает суффикс _1, _2 и т.д.
  const conn =
    process.env["GOOGLE_SHEETS_API_KEY_1"] ??
    process.env["GOOGLE_SHEETS_API_KEY_2"] ??
    process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovable || !conn) {
    throw new SheetSyncError("Подключение к Google Таблицам не настроено", 400);
  }
  return { lovable, conn };
}

/** Диапазон в пути: двоеточие в A1-нотации должно остаться незакодированным. */
export function rangePath(range: string) {
  return encodeURIComponent(range).replace(/%3A/g, ":");
}

export async function sheetsGateway<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const { lovable, conn } = keys();
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[sheets] gateway ${res.status}: ${text}`);
    if (res.status === 404)
      throw new SheetSyncError("Таблица не найдена — возможно, она удалена. Создайте её заново.", 404);
    if (res.status === 403)
      throw new SheetSyncError("Нет доступа к таблице. Проверьте подключение Google-аккаунта.", 403);
    if (res.status === 429)
      throw new SheetSyncError("Google временно ограничил запросы. Повторите через минуту.", 429);
    throw new SheetSyncError(`Google Таблицы вернули ошибку (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export type SheetMeta = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheets: Array<{ properties: { sheetId: number; title: string; index: number } }>;
};

/** Метаданные таблицы (нужен числовой sheetId для форматирования). */
export async function getSheetMeta(spreadsheetId: string): Promise<SheetMeta> {
  return sheetsGateway<SheetMeta>(`/spreadsheets/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,sheets.properties`);
}

/** Пакет запросов форматирования/данных (spreadsheets.batchUpdate). */
export async function sheetsBatchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
  if (!requests.length) return;
  await sheetsGateway(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: { requests },
  });
}

/** #RRGGBB → {red,green,blue} 0..1 для Sheets API. */
export function sheetColor(hex: string): { red: number; green: number; blue: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const int = m ? parseInt(m[1]!, 16) : 0;
  return { red: ((int >> 16) & 255) / 255, green: ((int >> 8) & 255) / 255, blue: (int & 255) / 255 };
}

/** Номер колонки (0-based) → буква A1-нотации. */
export function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Создаёт таблицу с одним листом и возвращает её id/url. */
export async function createSheetDocument(title: string, tab: string): Promise<{ id: string; url: string }> {
  const res = await sheetsGateway<{ spreadsheetId: string; spreadsheetUrl: string }>("/spreadsheets", {
    method: "POST",
    body: {
      properties: { title },
      sheets: [{ properties: { title: tab, gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  return { id: res.spreadsheetId, url: res.spreadsheetUrl };
}

export const sheetNum = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const sheetStr = (v: unknown) => String(v ?? "").trim();
/** «1», «да», «true», «x» → true; пусто трактуем как значение по умолчанию. */
export const sheetBool = (v: unknown, fallback = true) => {
  const s = sheetStr(v).toLowerCase();
  if (!s) return fallback;
  return ["1", "да", "true", "yes", "x", "+", "истина"].includes(s);
};
