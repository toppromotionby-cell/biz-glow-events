// Расчёты кадровых документов: штатное расписание, табель, зарплатная ведомость.
// Чистые функции без зависимостей от UI — используются в редакторе, PDF и тестах.
import {
  daysInMonth,
  isWeekend,
  markByCode,
  normDays,
  type HrBucket,
  type HrEmployee,
  type HrPeriod,
} from "./model";

export const HR_TAX = {
  /** Подоходный налог, %. */
  incomePct: 13,
  /** Стандартный налоговый вычет, BYN. */
  deduction: 192,
  /** Взнос в пенсионный фонд, %. */
  pensionPct: 1,
  /** Часов в рабочем дне на полную ставку. */
  hoursPerDay: 8,
};

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/* --------------------------- Штатное расписание --------------------------- */

export type StaffingRow = {
  position: string;
  code: string;
  units: number;
  tariff: number;
  tariffTotal: number;
  raisePct: number;
  raiseUnit: number;
  raiseTotal: number;
  salaryUnit: number;
  salaryTotal: number;
  note: string;
  unit: string;
};

export function staffingRow(e: HrEmployee): StaffingRow {
  const units = e.rate || 0;
  const tariff = round2(e.tariff);
  const raiseUnit = round2((tariff * (e.raise_pct || 0)) / 100);
  const salaryUnit = round2(tariff + raiseUnit);
  return {
    position: e.position,
    code: e.position_code,
    units,
    tariff,
    tariffTotal: round2(tariff * units),
    raisePct: e.raise_pct || 0,
    raiseUnit,
    raiseTotal: round2(raiseUnit * units),
    salaryUnit,
    salaryTotal: round2(salaryUnit * units),
    note: e.notes || e.short_name,
    unit: e.unit || "Основное",
  };
}

export function staffingTotals(rows: StaffingRow[]) {
  return rows.reduce(
    (acc, r) => ({
      units: round2(acc.units + r.units),
      tariffTotal: round2(acc.tariffTotal + r.tariffTotal),
      raiseTotal: round2(acc.raiseTotal + r.raiseTotal),
      salaryTotal: round2(acc.salaryTotal + r.salaryTotal),
    }),
    { units: 0, tariffTotal: 0, raiseTotal: 0, salaryTotal: 0 },
  );
}

/* --------------------------------- Табель --------------------------------- */

export type TimesheetTotals = {
  hours: number;
  days: number;
  buckets: Record<HrBucket, number>;
  marked: number;
};

const emptyBuckets = (): Record<HrBucket, number> => ({
  vacation: 0,
  unpaid: 0,
  sick: 0,
  adminLeave: 0,
  state: 0,
  trip: 0,
  weekend: 0,
});

/**
 * Итоги строки табеля. Ячейка дня — число часов либо буквенное обозначение.
 * `dailyNorm` — часов в день на ставке сотрудника.
 */
export function timesheetTotals(cells: string[], dailyNorm: number): TimesheetTotals {
  const buckets = emptyBuckets();
  let hours = 0;
  let marked = 0;
  for (const raw of cells) {
    const cell = (raw ?? "").trim();
    if (!cell) continue;
    marked += 1;
    const n = Number(cell.replace(",", "."));
    if (Number.isFinite(n)) {
      hours += n;
      continue;
    }
    const mark = markByCode(cell);
    if (mark?.bucket) buckets[mark.bucket] += 1;
  }
  const norm = dailyNorm > 0 ? dailyNorm : HR_TAX.hoursPerDay;
  return { hours: round2(hours), days: round2(hours / norm), buckets, marked };
}

/** Дневная норма часов сотрудника с учётом ставки. */
export function dailyNormFor(e: Pick<HrEmployee, "rate">): number {
  return round2(HR_TAX.hoursPerDay * (e.rate || 1));
}

/** Заготовка дней месяца: рабочие — норма часов, выходные — «В». */
export function defaultTimesheetCells(period: HrPeriod, dailyNorm: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(period); d += 1) {
    out.push(isWeekend(period, d) ? "В" : String(round2(dailyNorm)));
  }
  return out;
}

/* --------------------------- Зарплатная ведомость --------------------------- */

export type PayrollInput = {
  salary: number;
  rate: number;
  days: number;
  hours: number;
  /** Надбавка за сложность и напряжённость. */
  bonus: number;
  /** Аванс, выданный на руки. */
  advance: number;
  /** Дополнительные вычеты (на детей и т.п.), сверх стандартного. */
  extraDeduction?: number;
  /** Норма рабочих дней месяца. */
  normDays: number;
};

export type PayrollRow = {
  accrued: number;
  bonus: number;
  total: number;
  tax: number;
  pension: number;
  advance: number;
  toPay: number;
  grandTotal: number;
};

export function payrollRow(i: PayrollInput): PayrollRow {
  const norm = i.normDays > 0 ? i.normDays : 1;
  const accrued = round2(i.salary * (i.rate || 1) * (i.days / norm));
  const bonus = round2(i.bonus);
  const total = round2(accrued + bonus);
  const taxable = Math.max(0, total - HR_TAX.deduction - (i.extraDeduction ?? 0));
  const tax = round2((taxable * HR_TAX.incomePct) / 100);
  const pension = round2((total * HR_TAX.pensionPct) / 100);
  const advance = round2(i.advance);
  const toPay = round2(total - tax - pension - advance);
  return { accrued, bonus, total, tax, pension, advance, toPay, grandTotal: round2(toPay + advance) };
}

export function payrollTotals(rows: PayrollRow[]): PayrollRow {
  return rows.reduce<PayrollRow>(
    (a, r) => ({
      accrued: round2(a.accrued + r.accrued),
      bonus: round2(a.bonus + r.bonus),
      total: round2(a.total + r.total),
      tax: round2(a.tax + r.tax),
      pension: round2(a.pension + r.pension),
      advance: round2(a.advance + r.advance),
      toPay: round2(a.toPay + r.toPay),
      grandTotal: round2(a.grandTotal + r.grandTotal),
    }),
    { accrued: 0, bonus: 0, total: 0, tax: 0, pension: 0, advance: 0, toPay: 0, grandTotal: 0 },
  );
}

/** Норма дней периода — реэкспорт для удобства расчётов ведомости. */
export const periodNormDays = normDays;
