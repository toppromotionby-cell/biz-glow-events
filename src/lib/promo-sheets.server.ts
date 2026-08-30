// Промо-КП в Google Таблице: лист выглядит как документ (шапка, мета, таблица
// позиций с живыми формулами, итоги), а служебные поля живут в скрытых
// колонках справа — по ним лист читается обратно и приводится к единому виду.
import {
  colLetter,
  createSheetDocument,
  getSheetMeta,
  rangePath,
  sheetBool,
  sheetColor,
  sheetNum,
  sheetStr,
  sheetsBatchUpdate,
  sheetsGateway,
} from "@/lib/sheets-gateway.server";
import { buildDocLayout, type DocColumnKey } from "@/lib/documents/doc-layout";
import { DOC_FONT_DOCX_NAME, resolveDocFont } from "@/lib/documents/doc-font";
import type { PromoItem, PromoQuote } from "@/lib/promo-quote-model";

export { SheetSyncError } from "@/lib/sheets-gateway.server";

export const PROMO_SHEET_TAB = "КП";

/** Служебные (скрытые) колонки — по ним таблица читается обратно. */
const SERVICE_KEYS = [
  "__kind",
  "__id",
  "__section",
  "__qty",
  "__mul",
  "__rate_unit",
  "__cost",
  "__included",
  "__excl",
  "__info",
  "__net",
  "__comm",
] as const;

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

const MONEY_FMT = { numberFormat: { type: "NUMBER", pattern: "#,##0.00" } };
const BORDER = { style: "SOLID", color: sheetColor("#d8d8dd") };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

type Cell = Record<string, unknown>;

const txt = (v: string, fmt: Cell = {}): Cell => ({
  userEnteredValue: { stringValue: v },
  userEnteredFormat: fmt,
});
const numCell = (v: number, fmt: Cell = {}): Cell => ({
  userEnteredValue: { numberValue: Number.isFinite(v) ? v : 0 },
  userEnteredFormat: fmt,
});
const fx = (f: string, fmt: Cell = {}): Cell => ({
  userEnteredValue: { formulaValue: f },
  userEnteredFormat: fmt,
});
const empty = (fmt: Cell = {}): Cell => ({ userEnteredFormat: fmt });

const ALIGN: Record<string, string> = { left: "LEFT", center: "CENTER", right: "RIGHT" };

/** Полное описание листа: значения, формулы и оформление. */
function buildSheetGrid(quote: PromoQuote, items: PromoItem[], opts: { companyLine?: string } = {}) {
  const layout = buildDocLayout(quote, items, opts);
  const font = DOC_FONT_DOCX_NAME[resolveDocFont(quote.font_family)];
  const visible = layout.columns.map((c) => c.key);
  const keys: string[] = [...visible, ...SERVICE_KEYS];
  const colOf = (key: string) => keys.indexOf(key);
  const width = keys.length;
  const visibleWidth = visible.length;

  /** Ссылка на колонку значения: видимая, иначе служебная. */
  const refCol = (key: DocColumnKey, fallback: string) =>
    colLetter(visible.includes(key) ? colOf(key) : colOf(fallback));

  const base = { textFormat: { fontFamily: font, fontSize: 9 }, verticalAlignment: "MIDDLE" };
  const rows: Cell[][] = [];
  const merges: Array<{ row: number; from: number; to: number }> = [];
  const pad = (cells: Cell[]) => {
    while (cells.length < width) cells.push(empty());
    return cells;
  };
  const push = (cells: Cell[]) => rows.push(pad(cells));

  // 0) Скрытая строка ключей — карта колонок для обратного чтения.
  push(keys.map((k) => txt(k === visible[0] ? `__keys:${k}` : k)));

  // 1) Шапка документа: слева номер КП и мета, справа логотипы и реквизиты.
  const rects: Array<{ row: number; rowEnd: number; from: number; to: number }> = [];
  const logoCol = Math.max(1, visibleWidth - Math.max(1, Math.round(visibleWidth / 3)));

  const headStart = rows.length;
  const headLine = (text: string, fmt: Cell) => {
    merges.push({ row: rows.length, from: 0, to: logoCol });
    push([txt(text, { ...base, ...fmt })]);
  };
  headLine(layout.docTitle, { textFormat: { fontFamily: font, fontSize: 13, bold: true } });
  for (const line of layout.meta)
    headLine(line, {
      backgroundColor: sheetColor("#f6f6f7"),
      borders: BORDERS,
      textFormat: { fontFamily: font, fontSize: 9 },
    });
  const headEnd = rows.length;

  // Логотипы — правый блок, объединённый по высоте всей шапки (как в превью).
  if (layout.logos.length) {
    const span = visibleWidth - logoCol;
    const half = layout.logos.length > 1 ? Math.max(1, Math.floor(span / 2)) : span;
    const put = (col: number, url: string, align: string) => {
      rows[headStart]![col] = fx(`=IMAGE("${url}";1)`, {
        ...base,
        horizontalAlignment: align,
        verticalAlignment: "MIDDLE",
      });
    };
    put(logoCol, layout.logos[0]!, "LEFT");
    rects.push({ row: headStart, rowEnd: headEnd, from: logoCol, to: logoCol + half });
    if (layout.logos[1]) {
      put(logoCol + half, layout.logos[1]!, "RIGHT");
      rects.push({ row: headStart, rowEnd: headEnd, from: logoCol + half, to: visibleWidth });
    }
  }

  // Реквизиты — под логотипом, справа.
  const companyLine =
    layout.companyLine || (quote.company_overrides as { line?: string } | null)?.line || "";
  if (companyLine) {
    const cells: Cell[] = Array.from({ length: visibleWidth }, () => empty());
    cells[logoCol] = txt(String(companyLine), {
      ...base,
      wrapStrategy: "WRAP",
      textFormat: { fontFamily: font, fontSize: 8, foregroundColor: sheetColor("#5a5a63") },
    });
    merges.push({ row: rows.length, from: logoCol, to: visibleWidth });
    push(cells);
  }
  push([]);

  // 2) Заголовок таблицы.
  const headerRow = rows.length;
  push([
    ...layout.columns.map((c) =>
      txt(c.label, {
        backgroundColor: sheetColor(layout.accent),
        borders: BORDERS,
        horizontalAlignment: "CENTER",
        wrapStrategy: "WRAP",
        textFormat: { fontFamily: font, fontSize: 9, bold: true },
      }),
    ),
    ...SERVICE_KEYS.map((k) => txt(k)),
  ]);

  // 3) Позиции.
  const itemRowIdx: number[] = [];
  const firstDataRow = rows.length;
  for (const r of layout.rows) {
    const rowNum = rows.length + 1; // A1-нотация
    const bg =
      r.kind === "section"
        ? sheetColor("#e7e7ea")
        : r.kind === "subtotal"
          ? sheetColor("#f4f4f6")
          : r.kind === "extra"
            ? sheetColor("#fbfbfc")
            : undefined;
    const bold = r.kind === "section" || r.kind === "subtotal";
    const cellFmt = (align: string, money: boolean): Cell => ({
      ...base,
      ...(bg ? { backgroundColor: bg } : {}),
      borders: BORDERS,
      horizontalAlignment: ALIGN[align],
      wrapStrategy: "WRAP",
      textFormat: { fontFamily: font, fontSize: 9, bold, italic: r.kind === "extra" },
      ...(money ? MONEY_FMT : {}),
    });

    const cells: Cell[] = layout.columns.map((c) => {
      const fmt = cellFmt(c.align, c.money);
      if (r.kind !== "item") {
        const n = r.numbers[c.key];
        if (n != null && c.money) return numCell(n, fmt);
        return txt(r.cells[c.key] ?? "", fmt);
      }
      const qtyRef = `${refCol("qty", "__qty")}${rowNum}`;
      const mulRef = `${refCol("multiplier", "__mul")}${rowNum}`;
      const priceRef = `${colLetter(colOf("price"))}${rowNum}`;
      if (c.key === "total_qty") return fx(`=${qtyRef}*${mulRef}`, fmt);
      if (c.key === "amount") return fx(`=${qtyRef}*${mulRef}*${priceRef}`, fmt);
      if (c.key === "qty") return numCell(r.numbers.qty ?? 0, fmt);
      if (c.key === "multiplier") return numCell(r.numbers.multiplier ?? 1, fmt);
      if (c.key === "price") return numCell(r.numbers.price ?? 0, fmt);
      if (c.key === "title" && r.includes.length)
        return txt(`${r.cells.title ?? ""}\n${r.includes.join("\n")}`, fmt);
      return txt(r.cells[c.key] ?? "", fmt);
    });

    const it = r.item;
    const amountRef = `${colLetter(colOf("amount"))}${rowNum}`;
    const service: Cell[] = [
      txt(r.kind),
      txt(it?.id ?? ""),
      txt(r.section ?? ""),
      numCell(it ? it.qty : 0),
      numCell(it ? it.multiplier || 1 : 1),
      txt(it?.rate_unit ?? ""),
      numCell(it?.cost ?? 0),
      txt(it ? (it.included ? "1" : "0") : ""),
      txt(it ? (it.exclude_from_commission ? "1" : "0") : ""),
      txt(it ? (it.is_info ? "1" : "0") : ""),
      r.kind === "item" && r.counted ? fx(`=${amountRef}`) : numCell(0),
      r.kind === "item" && r.commissionable ? fx(`=${amountRef}`) : numCell(0),
    ];
    if (r.kind === "item") itemRowIdx.push(rows.length);
    push([...cells, ...service]);
  }
  if (!itemRowIdx.length) {
    merges.push({ row: rows.length, from: 0, to: visibleWidth });
    push([
      txt(layout.emptyLabel, {
        ...base,
        borders: BORDERS,
        horizontalAlignment: "CENTER",
        textFormat: { fontFamily: font, fontSize: 9, italic: true },
      }),
    ]);
  }
  const lastDataRow = rows.length;
  push([]);

  // 4) Итоги — формулы поверх скрытых колонок «в итог» и «в базу комиссии».
  const netCol = colLetter(colOf("__net"));
  const commCol = colLetter(colOf("__comm"));
  const range = (col: string) => `${col}${firstDataRow + 1}:${col}${lastDataRow}`;
  const itemsSum = itemRowIdx.length ? `SUM(${range(netCol)})` : "0";
  const commBase = itemRowIdx.length ? `SUM(${range(commCol)})` : "0";
  const management = quote.management_enabled ? String(layout.computed.management) : "0";
  const commission = quote.commission_enabled ? `(${commBase})*${quote.commission_rate}/100` : "0";
  const gross = `(${itemsSum})+${management}+${commission}`;
  const discount =
    quote.discount_type === "percent"
      ? `(${gross})*${Math.min(quote.discount_value, 100)}/100`
      : quote.discount_type === "fixed"
        ? String(layout.computed.discount)
        : "0";
  const subtotal = `(${gross})-(${discount})`;
  const rate = layout.computed.vatRate;
  const netExpr =
    layout.computed.vatMode === "included" ? `(${subtotal})/(1+${rate}/100)` : `${subtotal}`;
  const vatExpr =
    !layout.computed.vatEnabled
      ? "0"
      : layout.computed.vatMode === "included"
        ? `(${subtotal})-(${netExpr})`
        : `(${subtotal})*${rate}/100`;
  const grandExpr =
    layout.computed.vatMode === "included" ? `${subtotal}` : `(${netExpr})+(${vatExpr})`;

  const totalsExpr: Array<{ label: string; expr: string; grand?: boolean }> = [];
  if (layout.computed.discount > 0)
    totalsExpr.push({ label: layout.totals[0]!.label, expr: `-(${discount})` });
  totalsExpr.push({
    label: layout.computed.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего",
    expr: netExpr,
  });
  if (layout.computed.vatEnabled)
    totalsExpr.push({ label: `НДС ${rate}%`, expr: vatExpr });
  totalsExpr.push({
    label: `Итого${layout.computed.vatEnabled ? ", с НДС" : ""}, ${quote.currency}`,
    expr: grandExpr,
    grand: true,
  });

  const labelCol = Math.max(0, visibleWidth - 2);
  for (const t of totalsExpr) {
    const cells: Cell[] = Array.from({ length: visibleWidth }, () => empty());
    if (labelCol < visibleWidth - 1) merges.push({ row: rows.length, from: 0, to: visibleWidth - 1 });
    cells[0] = txt(`${t.label}:`, {
      ...base,
      backgroundColor: sheetColor(layout.accent),
      borders: BORDERS,
      horizontalAlignment: "RIGHT",
      textFormat: { fontFamily: font, fontSize: t.grand ? 11 : 9, bold: true },
    });
    cells[visibleWidth - 1] = fx(t.expr.startsWith("-") ? `=${t.expr}` : `=${t.expr}`, {
      ...base,
      backgroundColor: sheetColor("#fff8ea"),
      borders: BORDERS,
      horizontalAlignment: "RIGHT",
      textFormat: { fontFamily: font, fontSize: t.grand ? 11 : 9, bold: t.grand === true },
      ...MONEY_FMT,
    });
    push(cells);
  }

  if (layout.footerNote) {
    push([]);
    merges.push({ row: rows.length, from: 0, to: visibleWidth });
    push([
      txt(layout.footerNote, {
        ...base,
        wrapStrategy: "WRAP",
        textFormat: { fontFamily: font, fontSize: 9, italic: true },
      }),
    ]);
  }

  // 5) Автообъединение: пустые ячейки прилипают к соседней слева заполненной.
  const covered = (row: number, col: number) =>
    merges.some((m) => m.row === row && col >= m.from && col < m.to) ||
    rects.some((r) => row >= r.row && row < r.rowEnd && col >= r.from && col < r.to);
  const hasValue = (cell: Cell | undefined) => cell?.userEnteredValue != null;

  rows.forEach((cells, rowIdx) => {
    let start = 0;
    while (start < visibleWidth) {
      if (covered(rowIdx, start)) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < visibleWidth && !covered(rowIdx, end) && !hasValue(cells[end])) end += 1;
      if (end - start > 1) merges.push({ row: rowIdx, from: start, to: end });
      start = end;
    }
  });

  return { layout, rows, merges, rects, keys, width, visibleWidth, headerRow, headStart, headEnd };
}

/** Полностью перерисовывает лист «КП» в фирменном стиле. */
export async function writePromoSheet(
  spreadsheetId: string,
  quote: PromoQuote,
  items: PromoItem[],
  opts: { companyLine?: string } = {},
): Promise<void> {
  const grid = buildSheetGrid(quote, items, opts);
  const meta = await getSheetMeta(spreadsheetId);
  const sheet = meta.sheets?.[0]?.properties;
  if (!sheet) throw new Error("В таблице нет листов");
  const sheetId = sheet.sheetId;

  const requests: unknown[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          title: PROMO_SHEET_TAB,
          gridProperties: {
            rowCount: Math.max(grid.rows.length + 20, 60),
            columnCount: grid.width + 2,
            frozenRowCount: grid.headerRow + 1,
          },
        },
        fields: "title,gridProperties(rowCount,columnCount,frozenRowCount)",
      },
    },
    { unmergeCells: { range: { sheetId } } },
    { updateCells: { range: { sheetId }, fields: "*" } },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: grid.rows.map((cells) => ({ values: cells })),
        fields: "userEnteredValue,userEnteredFormat",
      },
    },
    // Строка ключей — служебная, прячем её.
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: grid.visibleWidth, endIndex: grid.width },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    },
  ];

  grid.layout.columns.forEach((c, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: Math.max(64, Math.round(c.width * 1000)) },
        fields: "pixelSize",
      },
    });
  });

  // Высота строк шапки — чтобы логотип (64px) поместился целиком.
  const headCount = Math.max(1, grid.headEnd - grid.headStart);
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: grid.headStart, endIndex: grid.headEnd },
      properties: { pixelSize: Math.max(22, Math.ceil(64 / headCount)) },
      fields: "pixelSize",
    },
  });

  for (const m of grid.merges) {
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: m.row, endRowIndex: m.row + 1, startColumnIndex: m.from, endColumnIndex: m.to },
        mergeType: "MERGE_ROWS",
      },
    });
  }
  for (const r of grid.rects) {
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: r.row, endRowIndex: r.rowEnd, startColumnIndex: r.from, endColumnIndex: r.to },
        mergeType: "MERGE_ALL",
      },
    });
  }

  await sheetsBatchUpdate(spreadsheetId, requests);
}

export async function createPromoSpreadsheet(title: string) {
  return createSheetDocument(title, PROMO_SHEET_TAB);
}

const LEGACY_HEADER_KEYS = [
  "__id",
  "__section",
  "title",
  "unit",
  "qty",
  "multiplier",
  "price",
  "__cost",
  "__included",
  "__excl",
  "__info",
  "note",
  "__rate_unit",
];

/** Читает лист обратно: и новый оформленный вид, и старый «сырой». */
export async function readPromoRows(spreadsheetId: string): Promise<PromoSheetRow[]> {
  const meta = await getSheetMeta(spreadsheetId);
  const tab = meta.sheets?.[0]?.properties.title ?? PROMO_SHEET_TAB;
  const res = await sheetsGateway<{ values?: unknown[][] }>(
    `/spreadsheets/${spreadsheetId}/values/${rangePath(`'${tab}'!A1:AZ2000`)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return parsePromoSheetValues(res.values ?? []);
}

/** Парсер значений листа → строки состава (чистая функция, покрыта тестами). */
export function parsePromoSheetValues(values: unknown[][]): PromoSheetRow[] {
  if (!values.length) return [];
  const first = values[0] ?? [];
  const isNew = sheetStr(first[0]).startsWith("__keys:");
  const keys = isNew
    ? first.map((v, i) => (i === 0 ? sheetStr(v).replace(/^__keys:/, "") : sheetStr(v)))
    : LEGACY_HEADER_KEYS;
  const at = (row: unknown[], key: string) => {
    const i = keys.indexOf(key);
    return i >= 0 ? row[i] : undefined;
  };

  const out: PromoSheetRow[] = [];
  for (let r = 1; r < values.length; r += 1) {
    const row = values[r] ?? [];
    if (isNew && sheetStr(at(row, "__kind")) !== "item") continue;
    // Состав позиции хранится в той же ячейке после переноса строки — отбрасываем.
    const title = sheetStr(at(row, "title")).split("\n")[0]!.trim();
    if (!title) continue;
    const qty = sheetNum(at(row, "qty") ?? at(row, "__qty"));
    const multiplier = sheetNum(at(row, "multiplier") ?? at(row, "__mul")) || 1;
    out.push({
      id: sheetStr(at(row, "__id")),
      section: sheetStr(at(row, "__section")),
      title,
      unit: sheetStr(at(row, "unit")) || "услуга",
      qty,
      multiplier,
      price: sheetNum(at(row, "price")),
      cost: sheetNum(at(row, "__cost")),
      included: sheetBool(at(row, "__included"), true),
      exclude_from_commission: sheetBool(at(row, "__excl"), false),
      is_info: sheetBool(at(row, "__info"), false),
      note: sheetStr(at(row, "note")),
      rate_unit: sheetStr(at(row, "rate_unit") ?? at(row, "__rate_unit")),
    });
  }
  return out;
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
  multiplier: "Кол-во",
  price: "Цена",
  cost: "Себестоимость",
  included: "В итог",
  exclude_from_commission: "Без комиссии",
  is_info: "Справочно",
  note: "Примечание",
  rate_unit: "Ед. изм.",
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
        if (typeof a === "number" || typeof b === "number") return Math.abs(Number(a) - Number(b)) > 0.004;
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
