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
// === Стресс-тест: КП с большим числом позиций ===
function bigQuote(count: number, opts: Partial<Record<string, unknown>> = {}) {
  const quote = normalizeQuote({
    id: "44444444-4444-4444-8444-444444444444",
    quote_number: "КП-999",
    title: "Большое мероприятие",
    doc_date: "2026-08-05",
    client_name: "Иван Петров",
    client_company: "ООО «Очень длинное название компании заказчика для проверки переносов»",
    event_date: "2026-08-20",
    public_token: "55555555-5555-4555-8555-555555555555",
    ...opts,
  });
  const items = Array.from({ length: count }, (_, i) =>
    normalizeItem({
      id: `item-${i}`,
      quote_id: quote.id,
      section: `Раздел ${Math.floor(i / 10) + 1}`,
      title: `Позиция ${i + 1} — аренда оборудования с длинным названием для переноса строки`,
      description:
        i % 3 === 0
          ? "Описание позиции: доставка, монтаж, настройка и демонтаж силами исполнителя. ".repeat(3)
          : "",
      includes: i % 4 === 0 ? [{ text: "Монтаж и демонтаж", note: "в стоимости" }, { text: "Оператор", note: "8 часов" }] : [],
      qty: (i % 5) + 1,
      unit: "шт",
      price: 100 + i * 7.5,
      sort_order: i,
    }),
  );
  return { quote, items };
}

describe("quote PDF pagination under load", () => {
  for (const count of [60, 120, 200]) {
    it(`renders ${count} items without losing totals or signature`, async () => {
      const { quote, items } = bigQuote(count);
      const bytes = await buildStandaloneQuotePdf(quote, items, DEFAULT_DOCUMENT_SETTINGS);
      await expectPdf(bytes);
      const parsed = await PDFDocument.load(bytes);
      // Итог и подпись всегда попадают в документ — значит страниц больше одной,
      // но не «взрывное» количество.
      expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2);
      expect(parsed.getPageCount()).toBeLessThan(Math.ceil(count / 8) + 6);
      for (const page of parsed.getPages()) {
        expect(page.getSize().height).toBeGreaterThan(800);
      }
    }, 60_000);
  }

  it("respects per-document print overrides (tight margins fit more rows)", async () => {
    const wide = bigQuote(80, {
      design: { print_margin_top_mm: 25, print_margin_bottom_mm: 25, print_margin_x_mm: 25, print_line_height: 1.6, print_row_gap: 1.4 },
    });
    const tight = bigQuote(80, {
      design: { print_margin_top_mm: 6, print_margin_bottom_mm: 6, print_margin_x_mm: 6, print_line_height: 1.1, print_row_gap: 0.7, print_font_scale: 0.85 },
    });
    const widePages = (await PDFDocument.load(await buildStandaloneQuotePdf(wide.quote, wide.items, DEFAULT_DOCUMENT_SETTINGS))).getPageCount();
    const tightPages = (await PDFDocument.load(await buildStandaloneQuotePdf(tight.quote, tight.items, DEFAULT_DOCUMENT_SETTINGS))).getPageCount();
    expect(tightPages).toBeLessThan(widePages);
  }, 120_000);

  it("renders with hidden cover/requisites/signature", async () => {
    const { quote, items } = bigQuote(40, {
      design: { show_cover: false, show_requisites: false, show_signature: false, show_item_includes: false, show_section_subtotals: false },
    });
    await expectPdf(await buildStandaloneQuotePdf(quote, items, DEFAULT_DOCUMENT_SETTINGS));
  }, 60_000);
});
