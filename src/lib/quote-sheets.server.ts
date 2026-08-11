// Синхронизация состава КП с Google Таблицами через Lovable connector gateway.
// Только серверный код: читает LOVABLE_API_KEY и GOOGLE_SHEETS_API_KEY.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SHEET_TAB = "Состав";
export const SHEET_HEADER = [
  "ID позиции",
  "Раздел",
  "Наименование",
  "Описание",
  "Кол-во",
  "Ед.",
  "Цена",
  "Себестоимость",
];

/** Строка состава в том виде, в каком она живёт в таблице. */
export type SheetItemRow = {
  id: string;
  section: string;
  title: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  cost: number;
};

export class SheetSyncError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovable || !conn) {
    throw new SheetSyncError("Подключение к Google Таблицам не настроено", 400);
  }
  return { lovable, conn };
}

/** Диапазон в пути: колонки нельзя перекодировать (двоеточие должно остаться живым). */
function rangePath(range: string) {
  return encodeURIComponent(range).replace(/%3A/g, ":");
}

async function gateway<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
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
    console.error(`[quote-sheets] gateway ${res.status}: ${text}`);
    if (res.status === 404) throw new SheetSyncError("Таблица не найдена — возможно, она удалена. Создайте её заново.", 404);
    if (res.status === 403) throw new SheetSyncError("Нет доступа к таблице. Проверьте подключение Google-аккаунта.", 403);
    if (res.status === 429) throw new SheetSyncError("Google временно ограничил запросы. Повторите через минуту.", 429);
    throw new SheetSyncError(`Google Таблицы вернули ошибку (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => String(v ?? "").trim();

export function itemsToRows(items: SheetItemRow[]): (string | number)[][] {
  return items.map((it) => [it.id, it.section, it.title, it.description, it.qty, it.unit, it.price, it.cost]);
}

export function rowsToItems(values: unknown[][]): SheetItemRow[] {
  return values
    .slice(1) // заголовок
    .map((r) => ({
      id: str(r?.[0]),
      section: str(r?.[1]),
      title: str(r?.[2]),
      description: str(r?.[3]),
      qty: num(r?.[4]),
      unit: str(r?.[5]) || "шт.",
      price: num(r?.[6]),
      cost: num(r?.[7]),
    }))
    .filter((r) => r.title.length > 0);
}

/** Создаёт таблицу для КП и возвращает её id/url. */
export async function createSpreadsheet(title: string): Promise<{ id: string; url: string }> {
  const res = await gateway<{ spreadsheetId: string; spreadsheetUrl: string }>("/spreadsheets", {
    method: "POST",
    body: {
      properties: { title },
      sheets: [{ properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  return { id: res.spreadsheetId, url: res.spreadsheetUrl };
}

/** Полностью перезаписывает лист «Состав». */
export async function writeRows(spreadsheetId: string, items: SheetItemRow[]): Promise<void> {
  await gateway(`/spreadsheets/${spreadsheetId}/values/${rangePath(`${SHEET_TAB}!A1:H1000`)}:clear`, { method: "POST", body: {} });
  await gateway(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(`${SHEET_TAB}!A1:H${items.length + 1}`)}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { range: `${SHEET_TAB}!A1:H${items.length + 1}`, majorDimension: "ROWS", values: [SHEET_HEADER, ...itemsToRows(items)] } },
  );
}

export async function readRows(spreadsheetId: string): Promise<SheetItemRow[]> {
  const res = await gateway<{ values?: unknown[][] }>(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(`${SHEET_TAB}!A1:H1000`)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return rowsToItems(res.values ?? []);
}

export type SheetDiffRow = {
  kind: "added" | "changed" | "removed";
  id: string;
  before: SheetItemRow | null;
  after: SheetItemRow | null;
  fields: string[];
};

const FIELD_LABELS: Record<keyof SheetItemRow, string> = {
  id: "ID",
  section: "Раздел",
  title: "Наименование",
  description: "Описание",
  qty: "Кол-во",
  unit: "Ед.",
  price: "Цена",
  cost: "Себестоимость",
};

/** Сравнивает состав из БД и из таблицы. */
export function diffRows(dbItems: SheetItemRow[], sheetItems: SheetItemRow[]): SheetDiffRow[] {
  const byId = new Map(dbItems.map((i) => [i.id, i]));
  const out: SheetDiffRow[] = [];
  const seen = new Set<string>();

  sheetItems.forEach((s, index) => {
    const before = s.id ? byId.get(s.id) : undefined;
    if (!before) {
      out.push({ kind: "added", id: s.id || `new-${index}`, before: null, after: s, fields: [] });
      return;
    }
    seen.add(s.id);
    const fields = (Object.keys(FIELD_LABELS) as (keyof SheetItemRow)[])
      .filter((k) => k !== "id")
      .filter((k) => {
        const a = before[k];
        const b = s[k];
        return typeof a === "number" || typeof b === "number" ? Number(a) !== Number(b) : String(a ?? "") !== String(b ?? "");
      })
      .map((k) => FIELD_LABELS[k]);
    if (fields.length) out.push({ kind: "changed", id: s.id, before, after: s, fields });
  });

  dbItems.forEach((d) => {
    if (!seen.has(d.id)) out.push({ kind: "removed", id: d.id, before: d, after: null, fields: [] });
  });

  return out;
}
