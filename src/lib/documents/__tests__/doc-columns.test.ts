// Доли ширины колонок — один расчёт для превью, PDF и таблиц.
import { describe, expect, it } from "vitest";
import { docColumnWidths } from "@/lib/documents/doc-layout";
import { normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";

const quote = normalizePromoQuote({
  id: "q1",
  show_qty: true,
  show_total_qty: true,
  show_notes: true,
});
const items = [
  normalizePromoItem({ id: "i1", title: "Шатёр «Звезда»", unit: "услуга", qty: 1, price: 1200 }),
  normalizePromoItem({
    id: "i2", title: "Промоутеры", unit: "чел.", qty: 4,
    rate_unit: "час", multiplier: 19, price: 25, note: "Девушки миловидной внешности",
  }),
];

describe("docColumnWidths", () => {
  it("покрывает всю ширину таблицы", () => {
    const cols = docColumnWidths(quote, items);
    const sum = cols.reduce((s, c) => s + c.pct, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it("отдаёт основное место наименованию и примечаниям", () => {
    const cols = docColumnWidths(quote, items);
    const note = cols.find((c) => c.key === "note")!;
    const unit = cols.find((c) => c.key === "unit")!;
    expect(note.pct).toBeGreaterThan(unit.pct);
    expect(note.align).toBe("left");
    expect(unit.align).toBe("center");
  });
});
