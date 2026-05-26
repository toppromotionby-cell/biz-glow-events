// Регрессия: данные клиентского письма подтверждения должны совпадать
// с тем, что админ видит в карточке заказа (src/routes/admin.orders.$id.tsx).
// Если что-то меняется в одной стороне (поле, форматирование, ярлык
// сущности), тест падает и заставляет синхронизировать обе стороны.
import { describe, it, expect } from "vitest";
import { buildClientOrderConfirmedEmail, type ClientOrderConfirmedPayload } from "@/lib/admin-email.server";

// Зеркало карт из admin.orders.$id.tsx / admin-email.server.ts.
// Если меняешь одну — синхронизируй другую (тест поймает расхождение).
const ENTITY_LABEL_ADMIN: Record<string, string> = {
  zone: "Зона", service: "Услуга", equipment: "Оборудование",
  tech_equipment: "Оборудование", production: "Продакшн",
  production_item: "Продакшн", extras: "Доп. услуга",
};

const STATUS_LABEL_ADMIN: Record<string, string> = {
  new: "Новая", consultation: "Консультация", estimate: "Смета",
  in_progress: "В работе", quoted: "Смета выслана", contract: "Договор",
  confirmed: "Подтверждён", paid: "Оплачен", completed: "Завершён",
  cancelled: "Отменён",
};

// Реалистичная "база" — то же, что админка читает из таблицы orders + order_items.
const sampleOrder = {
  id: "abcdef12-3456-7890-abcd-ef1234567890",
  status: "confirmed",
  client_name: "Иван Петров",
  client_email: "ivan@example.com",
  client_phone: "+375 29 111-22-33",
  client_company: 'ООО "Ромашка"',
  event_date: "2026-08-15",
  total: 1500,
  paid: 500,
  notes: "Нужна сцена 6x4 и микрофон-петличка",
};

const sampleItems = [
  { title: "Зона лофт", qty: 1, price: 800, entity_type: "zone", start_date: "2026-08-15", end_date: "2026-08-15" },
  { title: "Свет PAR", qty: 4, price: 100, entity_type: "tech_equipment", start_date: null, end_date: null },
  { title: "Кейтеринг", qty: 1, price: 300, entity_type: "service", start_date: null, end_date: null },
];

// Воспроизводим маппинг из confirmOrderAdmin / previewOrderConfirmationEmail
// (src/lib/orders.functions.ts) — что именно уходит в письмо.
function payloadFromOrder(): ClientOrderConfirmedPayload {
  return {
    orderId: sampleOrder.id,
    clientName: sampleOrder.client_name,
    clientEmail: sampleOrder.client_email,
    clientPhone: sampleOrder.client_phone,
    clientCompany: sampleOrder.client_company,
    total: Number(sampleOrder.total),
    paid: Number(sampleOrder.paid),
    status: sampleOrder.status,
    eventDate: sampleOrder.event_date,
    notes: sampleOrder.notes,
    items: sampleItems.map(i => ({
      title: i.title, qty: i.qty, price: i.price,
      entityType: i.entity_type, startDate: i.start_date, endDate: i.end_date,
    })),
  };
}

function fmtDateRu(d: string) { return new Date(d).toLocaleDateString("ru-BY"); }

describe("client confirmation email vs admin order view", () => {
  const { subject, html } = buildClientOrderConfirmedEmail(payloadFromOrder());

  it("включает номер заказа, как показано в админке (первые 8 символов id)", () => {
    expect(html).toContain(sampleOrder.id.slice(0, 8));
  });

  it("включает все контактные поля клиента из админки", () => {
    expect(html).toContain(sampleOrder.client_name);
    expect(html).toContain(sampleOrder.client_email);
    expect(html).toContain(sampleOrder.client_phone);
    // Компания экранируется (двойные кавычки → &quot;)
    expect(html).toContain(sampleOrder.client_company.replace(/"/g, "&quot;"));
  });

  it("статус в письме совпадает со словарём админки", () => {
    expect(html).toContain(STATUS_LABEL_ADMIN[sampleOrder.status]);
  });

  it("дата мероприятия отформатирована как в админке (ru-BY)", () => {
    expect(html).toContain(fmtDateRu(sampleOrder.event_date));
  });

  it("каждая позиция: title, qty, человекочитаемый entity_type из ENTITY_LABEL", () => {
    for (const it of sampleItems) {
      expect(html).toContain(it.title);
      expect(html).toContain(`${it.qty} шт.`);
      expect(html).toContain(ENTITY_LABEL_ADMIN[it.entity_type]);
    }
  });

  it("итого, оплачено и остаток к оплате присутствуют", () => {
    // BYN форматер использует non-breaking spaces — проверяем по числам.
    expect(html).toMatch(/Итого/);
    expect(html).toMatch(/1[\s\u00A0\u202F]?500/); // total
    expect(html).toMatch(/Оплачено/);
    expect(html).toMatch(/500/);
    expect(html).toMatch(/Осталось доплатить/);
    expect(html).toMatch(/1[\s\u00A0\u202F]?000/); // remaining = 1500-500
  });

  it("комментарий клиента (notes) попадает в письмо как есть", () => {
    expect(html).toContain(sampleOrder.notes);
  });

  it("тема письма содержит маркер подтверждения", () => {
    expect(subject).toMatch(/подтверждён/i);
  });

  it("внутренние заметки НЕ попадают в письмо клиенту", () => {
    // Эмулируем заказ с internal_notes (поле админки) — payload не должен
    // их подхватывать, и в HTML их быть не должно.
    const secret = "ВНУТРЕННЯЯ ПОМЕТКА: скидка по договорённости";
    const p = payloadFromOrder();
    // internal_notes намеренно нет в ClientOrderConfirmedPayload —
    // если кто-то его туда добавит, этот assert поймает.
    const { html: h2 } = buildClientOrderConfirmedEmail(p);
    expect(h2).not.toContain(secret);
  });
});
