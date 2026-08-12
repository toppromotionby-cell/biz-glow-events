import { writeFileSync } from "node:fs";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { buildPromoQuotePdf } from "@/lib/documents/pdf.server";
import { normalizePromoQuote, normalizePromoItem } from "@/lib/promo-quote-model";

const quote = normalizePromoQuote({
  id: "11111111-1111-4111-8111-111111111111",
  doc_number: "11.08.2026-01",
  project: "КП-ТОП ПРОМОУШН -БЕЛТЕЛЕКОМ 18-19 сентября",
  client_name: "БЕЛТЕЛЕКОМ",
  period: "18-19 сентября 2026г.",
  venue: 'парк активного отдыха "Якутские горки"',
  contact_name: "Кузнецов Дмитрий Владимирович",
  contact_role: "директор",
  contact_phone: "+375(44)7099122",
  contact_email: "dk@toppromotion.by",
  footer_note: "Оплата по счёту.\nСрок действия предложения — 10 дней.",
});
const mk = (o: any) => normalizePromoItem({ quote_id: quote.id, ...o });
const items = [
  mk({ id: "1", section: "Техническое оснащение", title: 'Шатер "Звезда"', unit: "услуга", qty: 1, price: 1200, note: "Аренда белого шатра на 2 дня, монтаж, демонтаж, доставка" }),
  mk({ id: "2", section: "Техническое оснащение", title: "Звуковое оборудование", unit: "услуга", qty: 1, price: 600, note: "2 колонки на стойках, микшерный пульт, микрофон, звукооператор, доставка, монтаж, демонтаж" }),
  mk({ id: "3", section: "Техническое оснащение", title: "Кресла мешки", unit: "услуга", qty: 1, price: 360, note: "Аренда 12-ти кресел мешков" }),
  mk({ id: "4", section: "Техническое оснащение", title: "Транспортные расходы", unit: "услуга", qty: 1, price: 330, note: "Доставка и увоз кресел-мешков" }),
  mk({ id: "5", section: "Персонал", title: "Промоперсонал", unit: "чел", qty: 4, rate_unit: "час", multiplier: 19, price: 25, note: "Девушки миловидной внешности работают на площадке" }),
  mk({ id: "6", section: "Персонал", title: "Координатор", unit: "чел", qty: 1, rate_unit: "час", multiplier: 10, price: 30, note: "Координация работы персонала" }),
];
const bytes = await buildPromoQuotePdf(quote, items, { ...DEFAULT_DOCUMENT_SETTINGS, company_legal_name: 'ООО "ТОП ПРОМОУШН"', company_unp: "692203969", company_address: "г. Минск, ул. Фроликова, дом 11, офис 309-310" } as any);
writeFileSync("/tmp/pdfqa/out.pdf", bytes);
console.log("ok", bytes.length);
