import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { buildOrderDocPdf, buildPromoQuotePdf, buildStandaloneQuotePdf } from "@/lib/documents/pdf.server";
import { normalizeQuote, normalizeItem } from "@/lib/quotes-model";
import { normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";

async function expectPdf(bytes: Uint8Array) {
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect(bytes.byteLength).toBeGreaterThan(1_000);
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getPageCount()).toBeGreaterThan(0);
}

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  order_number: "05/08/2026-01",
  client_name: "Иван Петров",
  client_company: "ООО Ромашка",
  client_phone: "+375 29 000-00-00",
  client_email: "client@example.com",
  event_date: "2026-08-20",
  notes: "Проверка кириллицы",
  paid: 100,
};
const orderItems = [{ title: "Аренда сцены", qty: 1, price: 500 }];

describe("document PDF generators", () => {
  for (const kind of ["quote", "invoice", "contract", "act"] as const) {
    it(`builds valid ${kind} PDF`, async () => {
      await expectPdf(await buildOrderDocPdf(kind, order, orderItems, DEFAULT_DOCUMENT_SETTINGS));
    });
  }

  it("builds a valid standalone quote PDF", async () => {
    const quote = normalizeQuote({
      id: order.id, quote_number: "КП-01", title: "Летнее мероприятие", doc_date: "2026-08-05",
      client_name: order.client_name, client_company: order.client_company, event_date: order.event_date,
      public_token: "22222222-2222-4222-8222-222222222222",
    });
    const item = normalizeItem({ id: "item-1", quote_id: quote.id, title: "Сцена", qty: 1, price: 500 });
    await expectPdf(await buildStandaloneQuotePdf(quote, [item], DEFAULT_DOCUMENT_SETTINGS));
  });

  it("builds a valid promo quote PDF", async () => {
    const quote = normalizePromoQuote({
      id: order.id, doc_number: "ПРОМО-01", project: "Промоакция", client_name: order.client_company,
      contact_name: order.client_name, contact_email: order.client_email, public_token: "33333333-3333-4333-8333-333333333333",
    });
    const item = normalizePromoItem({ id: "item-1", quote_id: quote.id, section: "Персонал", title: "Промоутер", qty: 2, multiplier: 4, price: 20 });
    await expectPdf(await buildPromoQuotePdf(quote, [item], DEFAULT_DOCUMENT_SETTINGS));
  });
});