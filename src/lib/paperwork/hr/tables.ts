// Построение и пересчёт таблиц кадровых документов.
// Таблицы хранятся обычными блоками `table` — их умеют рисовать превью, PDF и DOCX.
import { normalizeBlock, type PwBlock } from "@/lib/paperwork/model";
import {
  dailyNormFor,
  defaultTimesheetCells,
  payrollRow,
  payrollTotals,
  round2,
  staffingRow,
  staffingTotals,
  timesheetTotals,
  type PayrollRow,
} from "./calc";
import {
  daysInMonth,
  normDays,
  shortName,
  type HrEmployee,
  type HrPeriod,
} from "./model";

export type HrTableKind = "staffing" | "timesheet" | "payroll";

const nf = (n: number): string => (n === 0 ? "" : String(round2(n)));
const nf0 = (n: number): string => String(round2(n));

/* ------------------------------- Заголовки ------------------------------- */

export const STAFFING_HEADER = [
  "№ п/п",
  "Наименование структурного подразделения и должности",
  "Код должности по ОКРБ 014-2017",
  "Кол-во штатных единиц",
  "Тарифный оклад на штатную единицу",
  "Тарифный оклад на кол-во единиц",
  "Повышение, %",
  "Сумма повышения на единицу",
  "Сумма повышения на кол-во единиц",
  "Оклад на штатную единицу",
  "Оклад на кол-во единиц",
  "Примечание",
];

export const PAYROLL_HEADER = [
  "Таб. номер",
  "ФИО",
  "Должность",
  "Оклад",
  "Ставка",
  "Дни",
  "Часы",
  "Оклад начислено, руб.",
  "Надбавка за сложность, руб.",
  "Всего начислено, руб.",
  "Подоходный налог",
  "1% пенс. фонд",
  "Аванс на руки",
  "Зарплата на руки",
  "Итого на руки",
];

export const TIMESHEET_TAIL = [
  "Отработано часов",
  "Дни явок",
  "Трудовой отпуск",
  "Отпуск без сохр. з/платы",
  "Временная нетрудоспособность",
  "Адм. отпуск инициатива нанимателя",
  "Выполнение гос. обязанностей",
  "Служебные командировки",
  "Выходные",
  "Всего явок и неявок",
];

export function timesheetHeader(period: HrPeriod): string[] {
  const days = Array.from({ length: daysInMonth(period) }, (_, i) => String(i + 1));
  return ["№ п/п", "Табельный номер", "Ф.И.О.", "Должность (профессия)", ...days, ...TIMESHEET_TAIL];
}

/** Определить, какая кадровая таблица перед нами (по заголовку). */
export function detectHrTable(block: PwBlock): HrTableKind | null {
  if (block.type !== "table") return null;
  const h = block.header.map((c) => c.trim());
  if (h[0] === STAFFING_HEADER[0] && h[1] === STAFFING_HEADER[1]) return "staffing";
  if (h[0] === PAYROLL_HEADER[0] && h[1] === PAYROLL_HEADER[1]) return "payroll";
  if (h[2] === "Ф.И.О." && h.includes("Отработано часов")) return "timesheet";
  return null;
}

export function findHrTable(blocks: PwBlock[], kind: HrTableKind): number {
  return blocks.findIndex((b) => detectHrTable(b) === kind);
}

/** Заменить (или добавить в конец) кадровую таблицу в списке блоков. */
export function replaceHrTable(blocks: PwBlock[], kind: HrTableKind, table: PwBlock): PwBlock[] {
  const idx = findHrTable(blocks, kind);
  if (idx < 0) return [...blocks, table];
  const next = [...blocks];
  next[idx] = { ...table, id: blocks[idx].id };
  return next;
}

/* --------------------------- Штатное расписание --------------------------- */

export function buildStaffingTable(employees: HrEmployee[]): PwBlock {
  const rows: string[][] = [];
  const calc = employees.map(staffingRow);
  const units = new Set(calc.map((r) => r.unit));
  let n = 0;
  for (const unitName of units) {
    if (units.size > 1 || unitName) {
      rows.push(["", unitName, "", "", "", "", "", "", "", "", "", ""]);
    }
    for (const r of calc.filter((c) => c.unit === unitName)) {
      n += 1;
      rows.push([
        String(n),
        r.position,
        r.code,
        nf0(r.units),
        nf0(r.tariff),
        nf0(r.tariffTotal),
        r.raisePct ? nf0(r.raisePct) : "",
        nf(r.raiseUnit),
        nf(r.raiseTotal),
        nf0(r.salaryUnit),
        nf0(r.salaryTotal),
        r.note,
      ]);
    }
  }
  const t = staffingTotals(calc);
  rows.push(["", "ИТОГО:", "", nf0(t.units), "", nf0(t.tariffTotal), "", "", nf(t.raiseTotal), "", nf0(t.salaryTotal), ""]);
  return normalizeBlock({ type: "table", header: STAFFING_HEADER, rows });
}

/** Пересчёт производных колонок штатного расписания по введённым данным. */
export function recalcStaffing(block: PwBlock): PwBlock {
  const rows = block.rows.map((r) => [...r]);
  const num = (v: string) => Number(String(v ?? "").replace(",", ".")) || 0;
  let units = 0;
  let tariffTotal = 0;
  let raiseTotal = 0;
  let salaryTotal = 0;
  for (const r of rows) {
    if (r[1]?.trim().toUpperCase().startsWith("ИТОГО")) continue;
    if (!r[0]?.trim()) continue; // строка-подразделение
    const u = num(r[3]);
    const tariff = num(r[4]);
    const pct = num(r[6]);
    const raiseUnit = round2((tariff * pct) / 100);
    const salaryUnit = round2(tariff + raiseUnit);
    r[5] = nf0(round2(tariff * u));
    r[7] = nf(raiseUnit);
    r[8] = nf(round2(raiseUnit * u));
    r[9] = nf0(salaryUnit);
    r[10] = nf0(round2(salaryUnit * u));
    units += u;
    tariffTotal += tariff * u;
    raiseTotal += raiseUnit * u;
    salaryTotal += salaryUnit * u;
  }
  const total = rows.find((r) => r[1]?.trim().toUpperCase().startsWith("ИТОГО"));
  if (total) {
    total[3] = nf0(units);
    total[5] = nf0(round2(tariffTotal));
    total[8] = nf(round2(raiseTotal));
    total[10] = nf0(round2(salaryTotal));
  }
  return { ...block, rows };
}

/** Фонд оплаты труда по штатному расписанию. */
export function staffingFund(block: PwBlock): { units: number; fund: number } {
  const recalced = recalcStaffing(block);
  const total = recalced.rows.find((r) => r[1]?.trim().toUpperCase().startsWith("ИТОГО"));
  const num = (v: string) => Number(String(v ?? "").replace(",", ".")) || 0;
  return { units: num(total?.[3] ?? ""), fund: num(total?.[10] ?? "") };
}

/* --------------------------------- Табель --------------------------------- */

export function buildTimesheetTable(employees: HrEmployee[], period: HrPeriod): PwBlock {
  const rows = employees.map((e, i) => {
    const norm = dailyNormFor(e);
    const cells = defaultTimesheetCells(period, norm);
    return timesheetRow(i + 1, e.tab_number, e.full_name, e.position, cells, norm);
  });
  return normalizeBlock({ type: "table", header: timesheetHeader(period), rows });
}

function timesheetRow(
  n: number,
  tab: string,
  name: string,
  position: string,
  cells: string[],
  dailyNorm: number,
): string[] {
  const t = timesheetTotals(cells, dailyNorm);
  return [
    String(n),
    tab,
    name,
    position,
    ...cells,
    nf0(t.hours),
    nf0(t.days),
    t.buckets.vacation ? String(t.buckets.vacation) : "",
    t.buckets.unpaid ? String(t.buckets.unpaid) : "",
    t.buckets.sick ? String(t.buckets.sick) : "",
    t.buckets.adminLeave ? String(t.buckets.adminLeave) : "",
    t.buckets.state ? String(t.buckets.state) : "",
    t.buckets.trip ? String(t.buckets.trip) : "",
    t.buckets.weekend ? String(t.buckets.weekend) : "",
    String(t.marked),
  ];
}

/** Пересчёт итоговых колонок табеля после ручного ввода дней. */
export function recalcTimesheet(block: PwBlock, period: HrPeriod): PwBlock {
  const days = daysInMonth(period);
  const rows = block.rows.map((r, i) => {
    const cells = r.slice(4, 4 + days);
    const filled = Array.from({ length: days }, (_, d) => cells[d] ?? "");
    const norm = rowDailyNorm(filled);
    return timesheetRow(i + 1, r[1] ?? "", r[2] ?? "", r[3] ?? "", filled, norm);
  });
  return { ...block, header: timesheetHeader(period), rows };
}

/** Дневная норма строки = наиболее частое положительное число часов в днях. */
function rowDailyNorm(cells: string[]): number {
  const counts = new Map<number, number>();
  for (const c of cells) {
    const n = Number(String(c).replace(",", "."));
    if (Number.isFinite(n) && n > 0) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = 8;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Данные из табеля для ведомости: дни и часы по каждому сотруднику. */
export function timesheetSummary(
  block: PwBlock,
  period: HrPeriod,
): { tab: string; name: string; days: number; hours: number }[] {
  const recalced = recalcTimesheet(block, period);
  const days = daysInMonth(period);
  const num = (v: string) => Number(String(v ?? "").replace(",", ".")) || 0;
  return recalced.rows.map((r) => ({
    tab: r[1] ?? "",
    name: r[2] ?? "",
    hours: num(r[4 + days]),
    days: num(r[5 + days]),
  }));
}

/* --------------------------- Зарплатная ведомость --------------------------- */

export type PayrollSource = { tab: string; name: string; days: number; hours: number };

export function buildPayrollTable(
  employees: HrEmployee[],
  period: HrPeriod,
  source: PayrollSource[] = [],
  advance = 0,
): PwBlock {
  const norm = normDays(period);
  const byTab = new Map(source.map((s) => [s.tab.trim(), s]));
  const byName = new Map(source.map((s) => [s.name.trim().toLowerCase(), s]));
  const calc: PayrollRow[] = [];
  const rows = employees.map((e) => {
    const src =
      byTab.get(e.tab_number.trim()) ??
      byName.get(e.full_name.trim().toLowerCase()) ??
      null;
    const salary = round2(e.tariff * (1 + (e.raise_pct || 0) / 100));
    const days = src ? src.days : norm;
    const hours = src ? src.hours : round2(norm * dailyNormFor(e));
    const row = payrollRow({
      salary,
      rate: e.rate || 1,
      days,
      hours,
      bonus: 0,
      advance,
      normDays: norm,
    });
    calc.push(row);
    return [
      e.tab_number,
      e.short_name || shortName(e.full_name),
      e.position,
      nf0(salary),
      nf0(e.rate || 1),
      nf0(days),
      nf0(hours),
      nf0(row.accrued),
      nf(row.bonus),
      nf0(row.total),
      nf0(row.tax),
      nf0(row.pension),
      nf0(row.advance),
      nf0(row.toPay),
      nf0(row.grandTotal),
    ];
  });
  rows.push(totalsRow(payrollTotals(calc), employees, period));
  return normalizeBlock({ type: "table", header: PAYROLL_HEADER, rows });
}

function totalsRow(t: PayrollRow, employees: HrEmployee[], period: HrPeriod): string[] {
  void employees;
  void period;
  return [
    "",
    "ИТОГО:",
    "",
    "",
    "",
    "",
    "",
    nf0(t.accrued),
    nf(t.bonus),
    nf0(t.total),
    nf0(t.tax),
    nf0(t.pension),
    nf0(t.advance),
    nf0(t.toPay),
    nf0(t.grandTotal),
  ];
}

/** Пересчёт ведомости после ручного ввода оклада / дней / надбавки / аванса. */
export function recalcPayroll(block: PwBlock, period: HrPeriod): PwBlock {
  const norm = normDays(period);
  const num = (v: string) => Number(String(v ?? "").replace(",", ".")) || 0;
  const calc: PayrollRow[] = [];
  const rows = block.rows
    .filter((r) => !r[1]?.trim().toUpperCase().startsWith("ИТОГО"))
    .map((r) => {
      const row = payrollRow({
        salary: num(r[3]),
        rate: num(r[4]) || 1,
        days: num(r[5]),
        hours: num(r[6]),
        bonus: num(r[8]),
        advance: num(r[12]),
        normDays: norm,
      });
      calc.push(row);
      const next = [...r];
      next[7] = nf0(row.accrued);
      next[9] = nf0(row.total);
      next[10] = nf0(row.tax);
      next[11] = nf0(row.pension);
      next[13] = nf0(row.toPay);
      next[14] = nf0(row.grandTotal);
      return next;
    });
  rows.push(totalsRow(payrollTotals(calc), [], period));
  return { ...block, header: PAYROLL_HEADER, rows };
}

/** Пересчёт любой кадровой таблицы документа. */
export function recalcHrBlocks(blocks: PwBlock[], period: HrPeriod): PwBlock[] {
  return blocks.map((b) => {
    const kind = detectHrTable(b);
    if (kind === "staffing") return recalcStaffing(b);
    if (kind === "timesheet") return recalcTimesheet(b, period);
    if (kind === "payroll") return recalcPayroll(b, period);
    return b;
  });
}

/** Сотрудники, восстановленные из таблицы штатного расписания. */
export function employeesFromStaffing(block: PwBlock): Partial<HrEmployee>[] {
  const num = (v: string) => Number(String(v ?? "").replace(",", ".")) || 0;
  return block.rows
    .filter((r) => r[0]?.trim() && !r[1]?.trim().toUpperCase().startsWith("ИТОГО"))
    .map((r) => ({
      position: r[1] ?? "",
      position_code: r[2] ?? "",
      rate: num(r[3]),
      tariff: num(r[4]),
      raise_pct: num(r[6]),
      full_name: r[11] ?? "",
      short_name: r[11] ?? "",
    }));
}
