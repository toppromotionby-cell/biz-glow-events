// Синхронизация состава промо-КП с Google Таблицами.
// Схема позиций промо: множитель, «в итог», исключение из комиссии.
import {
  createSheetDocument,
  rangePath,
  sheetBool,
  sheetNum,
  sheetStr,
  sheetsGateway,
} from "@/lib/sheets-gateway.server";

export { SheetSyncError } from "@/lib/sheets-gateway.server";

export const PROMO_SHEET_TAB = "Состав";
export const PROMO_SHEET_HEADER = [
  "ID позиции",
  "Раздел",
  "Наименование",
  "Ед.",
  "Кол-во",
  "Кол-во 2 (множитель)",
  "Цена",
  "Себестоимость",
  "В итог (1/0)",
  "Без комиссии (1/0)",
  "Справочно (1/0)",
  "Примечание",
  "Ед. 2",
];
const LAST_COL = "M";

export type PromoSheetRow = {
  id: string;
  section: string;
  title: string;
  unit: string;
  qty: number;
  multiplier: number;
  price: number;
  cost: number;
  included: boolean;
  exclude_from_commission: boolean;
  is_info: boolean;
  note: string;
  rate_unit: string;
};

const flag = (v: boolean) => (v ? 1 : 0);

export function promoItemsToRows(items: PromoSheetRow[]): (string | number)[][] {
  return items.map((it) => [
    it.id,
    it.section,
    it.title,
    it.unit,
    it.qty,
    it.multiplier,
    it.price,
    it.cost,
    flag(it.included),
    flag(it.exclude_from_commission),
    flag(it.is_info),
    it.note,
    it.rate_unit,
  ]);
}

export function promoRowsToItems(values: unknown[][]): PromoSheetRow[] {
  return values
    .slice(1)
    .map((r) => ({
      id: sheetStr(r?.[0]),
      section: sheetStr(r?.[1]),
      title: sheetStr(r?.[2]),
      unit: sheetStr(r?.[3]) || "услуга",
      qty: sheetNum(r?.[4]),
      multiplier: sheetNum(r?.[5]) || 1,
      price: sheetNum(r?.[6]),
      cost: sheetNum(r?.[7]),
      included: sheetBool(r?.[8], true),
      exclude_from_commission: sheetBool(r?.[9], false),
      is_info: sheetBool(r?.[10], false),
      note: sheetStr(r?.[11]),
      rate_unit: sheetStr(r?.[12]),
    }))
    .filter((r) => r.title.length > 0);
}

export async function createPromoSpreadsheet(title: string) {
  return createSheetDocument(title, PROMO_SHEET_TAB);
}

/** Полностью перезаписывает лист «Состав». */
export async function writePromoRows(spreadsheetId: string, items: PromoSheetRow[]): Promise<void> {
  await sheetsGateway(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(`${PROMO_SHEET_TAB}!A1:${LAST_COL}1000`)}:clear`,
    { method: "POST", body: {} },
  );
  const range = `${PROMO_SHEET_TAB}!A1:${LAST_COL}${items.length + 1}`;
  await sheetsGateway(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: {
        range,
        majorDimension: "ROWS",
        values: [PROMO_SHEET_HEADER, ...promoItemsToRows(items)],
      },
    },
  );
}

export async function readPromoRows(spreadsheetId: string): Promise<PromoSheetRow[]> {
  const res = await sheetsGateway<{ values?: unknown[][] }>(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(
      `${PROMO_SHEET_TAB}!A1:${LAST_COL}1000`,
    )}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return promoRowsToItems(res.values ?? []);
}

export type PromoSheetDiffRow = {
  kind: "added" | "changed" | "removed";
  id: string;
  before: PromoSheetRow | null;
  after: PromoSheetRow | null;
  fields: string[];
};

const FIELD_LABELS: Record<keyof PromoSheetRow, string> = {
  id: "ID",
  section: "Раздел",
  title: "Наименование",
  unit: "Ед.",
  qty: "Кол-во",
  multiplier: "Кол-во 2",
  price: "Цена",
  cost: "Себестоимость",
  included: "В итог",
  exclude_from_commission: "Без комиссии",
  is_info: "Справочно",
  note: "Примечание",
  rate_unit: "Ед. 2",
};

export function diffPromoRows(dbItems: PromoSheetRow[], sheetItems: PromoSheetRow[]): PromoSheetDiffRow[] {
  const byId = new Map(dbItems.map((i) => [i.id, i]));
  const out: PromoSheetDiffRow[] = [];
  const seen = new Set<string>();

  sheetItems.forEach((s, index) => {
    const before = s.id ? byId.get(s.id) : undefined;
    if (!before) {
      out.push({ kind: "added", id: s.id || `new-${index}`, before: null, after: s, fields: [] });
      return;
    }
    seen.add(s.id);
    const fields = (Object.keys(FIELD_LABELS) as (keyof PromoSheetRow)[])
      .filter((k) => k !== "id")
      .filter((k) => {
        const a = before[k];
        const b = s[k];
        if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) !== Boolean(b);
        if (typeof a === "number" || typeof b === "number") return Number(a) !== Number(b);
        return String(a ?? "") !== String(b ?? "");
      })
      .map((k) => FIELD_LABELS[k]);
    if (fields.length) out.push({ kind: "changed", id: s.id, before, after: s, fields });
  });

  dbItems.forEach((d) => {
    if (!seen.has(d.id)) out.push({ kind: "removed", id: d.id, before: d, after: null, fields: [] });
  });

  return out;
}
