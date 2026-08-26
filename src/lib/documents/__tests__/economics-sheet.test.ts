import { describe, expect, it } from "vitest";
import { buildEconomicsSheetDoc } from "@/lib/documents/economics-sheet";
import { buildPromoQuoteHtmlDoc } from "@/lib/documents/promo-quote-html";
import { normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";
import { promoEconRows } from "@/lib/documents/economics-source";

const quote = normalizePromoQuote({ id: "q1", client_name: "ООО «Ромашка»" });
const items = [
  normalizePromoItem({ id: "i1", title: "Шатёр", unit: "услуга", qty: 1, price: 1000, cost: 400 }),
];

describe("внутренний бланк экономики", () => {
  it("показывает себестоимость и прибыль", () => {
    const html = buildEconomicsSheetDoc({ docLabel: "КП №1", client: quote.client_name }, promoEconRows(items), 1000);
    expect(html).toContain("Внутренний документ — не для клиента");
    expect(html).toContain("400,00");
    expect(html).toContain("600,00");
  });

  it("клиентский документ не содержит себестоимости", () => {
    const html = buildPromoQuoteHtmlDoc(quote, items, "ООО");
    expect(html).not.toContain("Себестоимость");
    expect(html).not.toContain("Внутренний документ");
  });
});
