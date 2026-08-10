import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { buildStandaloneQuotePdf } from "@/lib/documents/pdf.server";
import { normalizeQuote, normalizeItem } from "@/lib/quotes-model";

it("gen", async () => {
  const quote = normalizeQuote({
    id: "11111111-1111-4111-8111-111111111111",
    quote_number: "10.08.2026-01", title: "Организация корпоративного мероприятия",
    doc_date: "2026-08-10", client_company: "ЗАО «БЕЛАЗ»", client_name: "Мария Иванова",
    client_unp: "600000000", client_phone: "+375 29 111-11-11", client_email: "m@belaz.by",
    event_date: "2026-09-09", event_time_start: "12:00", event_time_end: "18:00",
    venue: "Площадка у заводоуправления", guests_count: 350, event_format: "Семейный праздник",
    setup_note: "Монтаж с 08:00, демонтаж до 22:00", validity_days: 14,
    public_token: "22222222-2222-4222-8222-222222222222",
  });
  const mk = (i: number, section: string, title: string, price: number, qty = 1) => normalizeItem({
    id: `i${i}`, quote_id: quote.id, section, title, qty, price, sort_order: i,
    description: i % 3 === 0 ? "Описание позиции с деталями по составу и срокам выполнения работ." : "",
    includes: i % 4 === 0 ? [{ text: "Доставка и монтаж" }, { text: "Оператор на площадке" }] : [],
  });
  const items = [
    mk(1, "Сцена и звук", "Сцена 8×6 м", 2200),
    mk(2, "Сцена и звук", "Звуковой комплект", 1400),
    mk(3, "Сцена и звук", "Световое оборудование", 900),
    mk(4, "Артисты", "Ведущий", 800),
    mk(5, "Артисты", "Кавер-группа", 1800),
    mk(6, "Организационные расходы", "Координатор проекта", 600),
    mk(7, "Организационные расходы", "Персонал площадки", 500, 4),
    mk(8, "Транспортные расходы", "Логистика оборудования", 700),
  ];
  const bytes = await buildStandaloneQuotePdf(quote, items, DEFAULT_DOCUMENT_SETTINGS);
  writeFileSync("/tmp/qa/kp.pdf", bytes);
}, 60000);
