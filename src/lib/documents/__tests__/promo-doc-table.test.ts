// Регрессия: таблица промо-КП должна оставаться настоящей <table> внутри
// админки. Раньше класс назывался "grid" и совпадал с утилитой Tailwind
// (display: grid) — из-за этого colgroup/thead переставали задавать ширины,
// и шапка «съезжала» относительно строк в превью редактора.
import { describe, it, expect } from "vitest";
import { PROMO_DOC_CSS, buildPromoQuoteBody } from "@/lib/documents/promo-quote-html";
import { normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";

describe("promo doc table", () => {
  const quote = normalizePromoQuote({ id: "q", show_qty: true, show_notes: true });
  const items = [normalizePromoItem({ id: "i", title: "Позиция", unit: "шт.", qty: 1, price: 10 })];

  it("uses a non-colliding table class", () => {
    const html = buildPromoQuoteBody(quote, items);
    expect(html).toContain('<table class="doc-grid">');
    expect(html).not.toContain('<table class="grid">');
  });

  it("colgroup precedes thead and matches column count", () => {
    const html = buildPromoQuoteBody(quote, items);
    const cols = (html.match(/<col style="width:/g) ?? []).length;
    const ths = (html.match(/<th class="c-/g) ?? []).length;
    expect(cols).toBe(ths);
    expect(html.indexOf("<colgroup>")).toBeLessThan(html.indexOf("<thead>"));
  });

  it("isolates table display from global utility classes", () => {
    for (const rule of [
      ".promo-doc table { display: table !important; }",
      ".promo-doc colgroup { display: table-column-group !important; }",
      ".promo-doc thead { display: table-header-group !important; }",
      ".promo-doc tbody { display: table-row-group !important; }",
      ".promo-doc tr { display: table-row !important; }",
    ]) {
      expect(PROMO_DOC_CSS).toContain(rule);
    }
  });
});
