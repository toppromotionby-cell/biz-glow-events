import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { buildPromoQuotePdf } from "@/lib/documents/pdf.server";
import { normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";

it("gen", async () => {
  const quote = normalizePromoQuote({ id: "11111111-1111-4111-8111-111111111111", doc_number: "01", project: "Праздник", client_name: "ООО Ромашка", show_notes: true, show_qty: true });
  const items = [
    { id: "1", section: "Техническое оснащение", title: 'Шатер "Звезда"', unit: "услуга", qty: 1, price: 1200, note: "Аренда белого шатра на 2 дня, монтаж, демонтаж, доставка" },
    { id: "2", section: "Техническое оснащение", title: "Звуковое оборудование", unit: "услуга", qty: 1, price: 600, note: "2 колонки на стойках, микшерный пульт, микрофон, звукооператор, доставка" },
    { id: "3", section: "Персонал", title: "Промоутер", unit: "чел.", qty: 2, rate_unit: "час", multiplier: 4, price: 20, note: "Работа на площадке" },
  ].map((i) => normalizePromoItem({ ...i, quote_id: quote.id }));
  writeFileSync("/tmp/qa/promo.pdf", await buildPromoQuotePdf(quote, items, DEFAULT_DOCUMENT_SETTINGS));
});
