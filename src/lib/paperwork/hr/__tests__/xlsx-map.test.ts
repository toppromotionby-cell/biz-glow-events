import { describe, expect, it } from "vitest";
import { detectHeader, rowsToEmployees } from "../xlsx-map";

const staffing = [
  ["ШТАТНОЕ РАСПИСАНИЕ", null, null, null, null],
  [null, null, null, null, null],
  ["№", "Наименование должности", "Код по ОКРБ", "Кол-во штатных единиц", "Тарифный оклад"],
  ["", "Основное подразделение", "", "", ""],
  ["1", "Директор", "1210", "0,25", "1500"],
  ["2", "Бухгалтер", "2411", "1", "1200"],
  ["", "ИТОГО:", "", "1,25", ""],
];

const payroll = [
  ["Таб. номер", "ФИО", "Должность", "Оклад", "Ставка"],
  ["1", "Кузнецов Дмитрий Владимирович", "Директор", "1500", "0,25"],
  ["2", "Протас Ольга Ивановна", "Бухгалтер", "1200", "1"],
];

describe("hr/xlsx-map", () => {
  it("находит строку заголовков", () => {
    expect(detectHeader(staffing)?.rowIndex).toBe(2);
    expect(detectHeader(payroll)?.rowIndex).toBe(0);
  });

  it("разбирает штатное расписание с подразделениями", () => {
    const rows = rowsToEmployees(staffing);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      position: "Директор",
      position_code: "1210",
      rate: 0.25,
      tariff: 1500,
      unit: "Основное подразделение",
    });
  });

  it("разбирает ведомость с ФИО", () => {
    const rows = rowsToEmployees(payroll);
    expect(rows).toHaveLength(2);
    expect(rows[1].full_name).toBe("Протас Ольга Ивановна");
    expect(rows[1].short_name).toBe("Протас О.И.");
    expect(rows[1].rate).toBe(1);
  });

  it("игнорирует итоговые строки и пустые файлы", () => {
    expect(rowsToEmployees([[null, null]])).toEqual([]);
    expect(rowsToEmployees(payroll).some((r) => r.full_name.toLowerCase().includes("итого"))).toBe(false);
  });
});
