// Импорт состава КП из Excel-файла (ExcelJS, только в браузере).
// Колонки распознаются по заголовку в любом порядке; регистр и пробелы не важны.
import type { QuoteItem } from "@/lib/quotes-model";

export type ImportedRow = {
  section: string;
  title: string;
  description: string;
  unit: string;
  qty: number;
  price: number;
  cost: number;
};

export type ImportResult = {
  rows: ImportedRow[];
  /** Номер строки с заголовком (1-based) — для подсказки пользователю. */
  headerRow: number;
  /** Колонки, которые удалось сопоставить: ключ → заголовок из файла. */
  mapped: Record<string, string>;
  skipped: number;
};

type Field = keyof ImportedRow;

const ALIASES: Record<Field, string[]> = {
  section: ["раздел", "секция", "категория", "группа", "section"],
  title: ["наименование", "название", "позиция", "услуга", "работа", "товар", "title", "name"],
  description: ["описание", "примечание", "комментарий", "note", "description"],
  unit: ["ед", "едизм", "единица", "единицаизмерения", "unit"],
  qty: ["колво", "количество", "кол", "qty", "quantity", "всего"],
  price: ["цена", "ценазаед", "стоимость", "тариф", "price", "rate"],
  cost: ["себестоимость", "закупка", "закупочная", "cost"],
};

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[\s.,_\-/()]/g, "")
    .trim();

export function matchField(header: unknown): Field | null {
  const h = norm(header);
  if (!h) return null;
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    if (aliases.some((a) => h === a)) return field;
  }
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    if (aliases.some((a) => h.startsWith(a))) return field;
  }
  return null;
}

export function parseNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v && typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown };
    if (o.result !== undefined) return parseNumber(o.result);
    if (o.text !== undefined) return parseNumber(o.text);
  }
  const s = String(v ?? "")
    .replace(/[^\d.,\-]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if (o.text !== undefined) return String(o.text).trim();
    if (o.result !== undefined) return String(o.result).trim();
  }
  return String(v).trim();
}

/** Преобразует матрицу ячеек в позиции. Ищет строку заголовка среди первых 20 строк. */
export function rowsFromMatrix(matrix: unknown[][]): ImportResult {
  let headerRow = -1;
  let map: Partial<Record<Field, number>> = {};
  const mapped: Record<string, string> = {};

  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const candidate: Partial<Record<Field, number>> = {};
    matrix[i]?.forEach((cell, idx) => {
      const field = matchField(cellText(cell));
      if (field && candidate[field] === undefined) candidate[field] = idx;
    });
    if (candidate.title !== undefined && (candidate.price !== undefined || candidate.qty !== undefined)) {
      headerRow = i;
      map = candidate;
      (Object.entries(candidate) as [Field, number][]).forEach(([f, idx]) => {
        mapped[f] = cellText(matrix[i]?.[idx]) || f;
      });
      break;
    }
  }

  if (headerRow < 0) {
    throw new Error(
      "Не удалось найти строку заголовка. Нужны колонки «Наименование» и «Цена» (или «Кол-во»).",
    );
  }

  const at = (row: unknown[], field: Field) => (map[field] === undefined ? undefined : row[map[field]!]);
  const rows: ImportedRow[] = [];
  let skipped = 0;
  let currentSection = "";

  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const title = cellText(at(row, "title"));
    const filled = row.filter((c) => cellText(c).length > 0).length;
    if (!title) {
      // Строка-заголовок раздела: единственная заполненная ячейка без чисел.
      const only = row.map(cellText).filter((c) => c.length > 0);
      if (only.length === 1 && parseNumber(only[0]) === 0) { currentSection = only[0]; continue; }
      if (filled) skipped++;
      continue;
    }
    // Строка-заголовок раздела: заполнено только наименование, цифр нет.
    const qty = parseNumber(at(row, "qty"));
    const price = parseNumber(at(row, "price"));
    if (filled === 1 && qty === 0 && price === 0) { currentSection = title; continue; }
    if (/^(итог|всего|сумма|итого)/i.test(title)) { skipped++; continue; }

    const sectionCell = cellText(at(row, "section"));
    if (sectionCell) currentSection = sectionCell;
    rows.push({
      section: sectionCell || currentSection,
      title,
      description: cellText(at(row, "description")),
      unit: cellText(at(row, "unit")) || "шт.",
      qty: qty || 1,
      price,
      cost: parseNumber(at(row, "cost")),
    });
  }

  return { rows, headerRow: headerRow + 1, mapped, skipped };
}

/** Читает .xlsx/.xlsm файл и возвращает распознанные позиции. */
export async function parseQuoteXlsx(file: File | ArrayBuffer): Promise<ImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("В файле нет листов");

  const matrix: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[]; // 1-based массив
    matrix.push(values.slice(1));
  });
  return rowsFromMatrix(matrix);
}

/** Превращает распознанные строки в позиции КП. */
export function toQuoteItems(rows: ImportedRow[], quoteId: string, startOrder = 0): QuoteItem[] {
  return rows.map((r, i) => ({
    id: `import-${Date.now()}-${i}`,
    quote_id: quoteId,
    section: r.section,
    title: r.title,
    description: r.description,
    includes: [],
    qty: r.qty,
    unit: r.unit,
    price: r.price,
    cost: r.cost,
    sort_order: startOrder + i,
    entity_type: null,
    entity_id: null,
  }));
}
