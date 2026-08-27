import { describe, expect, it } from "vitest";
import { colgroupHtml, lineItemColFractions, tableColFractions } from "@/lib/paperwork/table-cols";

const HEADER = ["№", "Наименование", "Количество"];
const ROWS = [
  ["1", "Световой прибор типа Beam", "4"],
  ["2", "Световой прибор типа Led Park", "14"],
  ["3", "Wi-fi приемники и передатчики", "12"],
  ["4", "Ноутбук для управления световыми приборами", "1"],
];

describe("tableColFractions", () => {
  it("сумма долей равна 1", () => {
    const f = tableColFractions(HEADER, ROWS);
    expect(f).toHaveLength(3);
    expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it("текстовая колонка получает больше половины, числовые — минимум", () => {
    const [num, name, qty] = tableColFractions(HEADER, ROWS);
    expect(name!).toBeGreaterThan(0.5);
    expect(num!).toBeLessThan(0.15);
    expect(qty!).toBeLessThan(0.3);
    expect(name!).toBeGreaterThan(num! * 4);
  });

  it("текст умещается без слоговых переносов при рассчитанной ширине", () => {
    const f = tableColFractions(HEADER, ROWS);
    // 175 мм полезной ширины при 10pt ≈ 95 символов в строку.
    const charsPerLine = 95 * f[1]!;
    const longestWord = ROWS.flatMap((r) => r[1]!.split(" ")).reduce((m, w) => Math.max(m, w.length), 0);
    expect(charsPerLine).toBeGreaterThan(longestWord + 2);
  });

  it("ни одна колонка не схлопывается в ноль", () => {
    const f = tableColFractions([], [["a", "b", "c", "d", "e", "f", "g", "h"]]);
    for (const v of f) expect(v).toBeGreaterThan(0.01);
  });

  it("уважает число колонок, переданное явно", () => {
    expect(tableColFractions(["A"], [["1"]], 5)).toHaveLength(5);
  });
});

describe("lineItemColFractions", () => {
  it("наименование шире служебных колонок", () => {
    const f = lineItemColFractions([
      { name: "Аренда светового оборудования на площадке", qty: 2, unit: "шт.", price: "1 200,00", total: "2 400,00" },
      { name: "Монтаж и демонтаж", qty: 1, unit: "услуга", price: "500,00", total: "500,00" },
    ]);
    expect(f).toHaveLength(6);
    expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(f[1]!).toBeGreaterThan(Math.max(f[0]!, f[2]!, f[3]!, f[4]!, f[5]!));
    expect(f[0]!).toBeLessThan(0.1);
  });
});

describe("colgroupHtml", () => {
  it("отдаёт colgroup c процентами, совпадающими с долями", () => {
    const html = colgroupHtml([0.25, 0.75]);
    expect(html).toBe('<colgroup><col style="width:25.000%" /><col style="width:75.000%" /></colgroup>');
  });
});
