import { describe, expect, it } from "vitest";
import { normDays, normHours, shortName, type HrEmployee, type HrPeriod } from "../model";
import { payrollRow, staffingRow, timesheetTotals } from "../calc";
import {
  buildPayrollTable,
  buildStaffingTable,
  buildTimesheetTable,
  detectHrTable,
  recalcPayroll,
  recalcStaffing,
  recalcTimesheet,
  staffingFund,
  timesheetSummary,
} from "../tables";

const emp = (over: Partial<HrEmployee> = {}): HrEmployee => ({
  id: over.id ?? "1",
  company_profile_id: null,
  tab_number: "1",
  full_name: "Кузнецов Дмитрий Владимирович",
  short_name: "Кузнецов Д.В.",
  position: "Директор",
  position_code: "1210",
  unit: "Основное",
  tariff: 1500,
  raise_pct: 0,
  rate: 0.25,
  hired_on: null,
  fired_on: null,
  is_active: true,
  sort_order: 0,
  notes: "",
  ...over,
});

const period: HrPeriod = { year: 2025, month: 4 }; // 22 рабочих дня

describe("hr/model", () => {
  it("сокращает ФИО", () => {
    expect(shortName("Кузнецов Дмитрий Владимирович")).toBe("Кузнецов Д.В.");
    expect(shortName("Протас Ольга")).toBe("Протас О.");
  });
  it("считает норму дней и часов", () => {
    expect(normDays(period)).toBe(22);
    expect(normHours(period)).toBe(176);
  });
});

describe("hr/calc", () => {
  it("штатная строка: повышение и оклад", () => {
    const r = staffingRow(emp({ tariff: 1000, raise_pct: 20, rate: 2 }));
    expect(r.raiseUnit).toBe(200);
    expect(r.salaryUnit).toBe(1200);
    expect(r.salaryTotal).toBe(2400);
  });

  it("ведомость: налог считается с учётом вычета", () => {
    const r = payrollRow({ salary: 1500, rate: 0.25, days: 22, hours: 44, bonus: 0, advance: 100, normDays: 22 });
    expect(r.accrued).toBe(375);
    expect(r.tax).toBe(23.79);
    expect(r.pension).toBe(3.75);
    expect(r.toPay).toBe(247.46);
    expect(r.grandTotal).toBe(347.46);
  });

  it("ведомость: налог не уходит в минус", () => {
    const r = payrollRow({ salary: 100, rate: 1, days: 22, hours: 176, bonus: 0, advance: 0, normDays: 22 });
    expect(r.tax).toBe(0);
  });

  it("табель: часы, дни и категории неявок", () => {
    const t = timesheetTotals(["8", "8", "В", "О", "Б", "8"], 8);
    expect(t.hours).toBe(24);
    expect(t.days).toBe(3);
    expect(t.buckets.vacation).toBe(1);
    expect(t.buckets.sick).toBe(1);
    expect(t.buckets.weekend).toBe(1);
    expect(t.marked).toBe(6);
  });
});

describe("hr/tables", () => {
  const people = [emp(), emp({ id: "2", tab_number: "2", full_name: "Протас Ольга Ивановна", position: "Бухгалтер", rate: 1, tariff: 1200 })];

  it("строит и распознаёт таблицы", () => {
    expect(detectHrTable(buildStaffingTable(people))).toBe("staffing");
    expect(detectHrTable(buildTimesheetTable(people, period))).toBe("timesheet");
    expect(detectHrTable(buildPayrollTable(people, period))).toBe("payroll");
  });

  it("штатное: итог и фонд оплаты труда", () => {
    const table = recalcStaffing(buildStaffingTable(people));
    const fund = staffingFund(table);
    expect(fund.units).toBe(1.25);
    expect(fund.fund).toBe(1575); // 1500*0.25 + 1200*1
  });

  it("табель кормит ведомость данными по дням", () => {
    const ts = recalcTimesheet(buildTimesheetTable(people, period), period);
    const summary = timesheetSummary(ts, period);
    expect(summary[1].days).toBe(22);
    expect(summary[1].hours).toBe(176);
    const payroll = buildPayrollTable(people, period, summary);
    // последняя строка — ИТОГО
    expect(payroll.rows.at(-1)?.[1]).toBe("ИТОГО:");
    expect(payroll.rows[1][7]).toBe("1200");
  });

  it("пересчёт ведомости после ручной правки", () => {
    const table = buildPayrollTable(people, period);
    const edited = { ...table, rows: table.rows.map((r, i) => (i === 1 ? [...r.slice(0, 5), "11", ...r.slice(6)] : r)) };
    const out = recalcPayroll(edited, period);
    expect(out.rows[1][7]).toBe("600");
  });
});
