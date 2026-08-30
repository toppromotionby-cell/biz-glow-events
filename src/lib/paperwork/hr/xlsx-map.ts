// Разбор строк XLSX (штатное расписание / ведомость) в записи реестра сотрудников.
// Чистая логика без ExcelJS — на вход подаётся матрица ячеек.
import { shortName } from "./model";

export type HrImportRow = {
  tab_number: string;
  full_name: string;
  short_name: string;
  position: string;
  position_code: string;
  unit: string;
  tariff: number;
  raise_pct: number;
  rate: number;
  notes: string;
  is_active: boolean;
  sort_order: number;
  hired_on: null;
  fired_on: null;
  company_profile_id: null;
};

type Matrix = (string | number | null | undefined)[][];

const text = (v: unknown): string => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const numOf = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const norm = (v: unknown): string => text(v).toLowerCase().replace(/ё/g, "е");

/** Словарь синонимов заголовков — покрывает форматы обоих референсов. */
const FIELDS: { key: keyof HrImportRow; match: (h: string) => boolean }[] = [
  { key: "tab_number", match: (h) => h.includes("таб") && h.includes("номер") },
  { key: "full_name", match: (h) => h === "фио" || h.includes("ф.и.о") || h.includes("фамилия") },
  { key: "position", match: (h) => h.includes("должност") && !h.includes("код") },
  { key: "position_code", match: (h) => h.includes("код") },
  { key: "unit", match: (h) => h.includes("подразделен") },
  { key: "tariff", match: (h) => h.includes("оклад") || h.includes("тариф") },
  { key: "raise_pct", match: (h) => h.includes("повышен") && h.includes("%") },
  { key: "rate", match: (h) => h.includes("ставк") || (h.includes("штатн") && h.includes("единиц")) },
];

export type HeaderMap = Partial<Record<keyof HrImportRow, number>>;

/** Найти строку заголовков и сопоставить колонки. */
export function detectHeader(matrix: Matrix): { rowIndex: number; map: HeaderMap } | null {
  const limit = Math.min(matrix.length, 30);
  for (let r = 0; r < limit; r += 1) {
    const cells = matrix[r] ?? [];
    const map: HeaderMap = {};
    cells.forEach((cell, c) => {
      const h = norm(cell);
      if (!h) return;
      for (const f of FIELDS) {
        if (map[f.key] === undefined && f.match(h)) map[f.key] = c;
      }
    });
    if (map.full_name !== undefined || (map.position !== undefined && map.tariff !== undefined)) {
      return { rowIndex: r, map };
    }
  }
  return null;
}

/** Преобразовать матрицу листа в записи сотрудников. */
export function rowsToEmployees(matrix: Matrix): HrImportRow[] {
  const head = detectHeader(matrix);
  if (!head) return [];
  const { map } = head;
  const out: HrImportRow[] = [];
  let unit = "Основное";

  for (let r = head.rowIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r] ?? [];
    const at = (key: keyof HrImportRow) => (map[key] === undefined ? "" : row[map[key]!]);

    const name = text(at("full_name"));
    const position = text(at("position"));
    const tariff = numOf(at("tariff"));
    const joined = norm(row.map(text).join(" "));
    if (!joined) continue;
    if (joined.startsWith("итого") || joined.startsWith("всего")) continue;

    // Строка-подразделение: заполнена только одна ячейка с текстом.
    if (!name && position && !tariff && row.filter((c) => text(c)).length <= 2) {
      unit = position;
      continue;
    }
    if (map.unit !== undefined && text(at("unit"))) unit = text(at("unit"));
    if (!name && !position) continue;

    const full = name || position;
    out.push({
      tab_number: text(at("tab_number")),
      full_name: full,
      short_name: shortName(full),
      position: position || "",
      position_code: text(at("position_code")),
      unit,
      tariff,
      raise_pct: numOf(at("raise_pct")),
      rate: numOf(at("rate")) || 1,
      notes: "",
      is_active: true,
      sort_order: out.length,
      hired_on: null,
      fired_on: null,
      company_profile_id: null,
    });
  }
  return out;
}
