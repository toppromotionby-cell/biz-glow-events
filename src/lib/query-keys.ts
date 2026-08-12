// Единый реестр ключей кэша админки.
// Зачем: раньше строки ключей дублировались по файлам, и опечатка тихо ломала
// обновление списка после сохранения. Теперь ключ у списка и у инвалидации один.
import type { QueryClient } from "@tanstack/react-query";

export const adminKeys = {
  // Контент
  cases: ["admin-cases"] as const,
  testimonials: ["admin-testimonials"] as const,
  blog: ["admin-blog"] as const,
  catalog: (table: string) => ["catalog", table] as const,
  catalogAll: ["catalog"] as const,
  promo: ["admin-promo"] as const,

  // Заказы
  ordersAll: ["admin-orders"] as const,
  orders: (params: Record<string, unknown>) => ["admin-orders", params] as const,
  order: (id: string) => ["order", id] as const,
  orderItems: (id: string) => ["order-items", id] as const,
  orderTimeline: (id: string) => ["order-timeline", id] as const,
  orderAttachments: (id: string) => ["order-attachments", id] as const,
  attention: ["admin-attention"] as const,
  managers: ["assignable-managers"] as const,

  // Документы
  documents: ["admin-documents-overview"] as const,
  quotesAll: ["admin-quotes"] as const,
  quote: (id: string) => ["admin-quote", id] as const,
  quoteVersions: (id: string) => ["admin-quote-versions", id] as const,
  promoQuotesAll: ["admin-promo-quotes"] as const,
  promoQuote: (id: string) => ["promo-quote", id] as const,
  promoQuoteVersions: (id: string) => ["promo-versions", id] as const,
  financeDocuments: ["finance-documents"] as const,
  companyProfiles: ["company-profiles"] as const,
  snippets: ["promo-snippets"] as const,

  // Презентации
  presentations: ["presentations"] as const,
  presentation: (id: string) => ["presentation", id] as const,

  // Настройки
  users: ["admin", "users"] as const,
  siteSettings: ["admin", "site-settings"] as const,
};

/**
 * Обновить всё, что зависит от одного заказа: карточку, позиции, историю,
 * вложения, список заказов и счётчик «требуют внимания».
 * Раньше каждый компонент инвалидировал свой набор ключей и что-то забывал —
 * например, модалка заказа держала отдельные ключи и не видела правок из списка.
 */
export function invalidateOrder(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: adminKeys.order(id) });
  qc.invalidateQueries({ queryKey: adminKeys.orderItems(id) });
  qc.invalidateQueries({ queryKey: adminKeys.orderTimeline(id) });
  qc.invalidateQueries({ queryKey: adminKeys.orderAttachments(id) });
  qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
  qc.invalidateQueries({ queryKey: adminKeys.attention });
}

/** Обновить КП: сам документ, его версии и список документов. */
export function invalidateQuote(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: adminKeys.quote(id) });
  qc.invalidateQueries({ queryKey: adminKeys.quoteVersions(id) });
  qc.invalidateQueries({ queryKey: adminKeys.quotesAll });
  qc.invalidateQueries({ queryKey: adminKeys.documents });
}

/** Обновить промо-КП: сам документ, его версии и список документов. */
export function invalidatePromoQuote(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: adminKeys.promoQuote(id) });
  qc.invalidateQueries({ queryKey: adminKeys.promoQuoteVersions(id) });
  qc.invalidateQueries({ queryKey: adminKeys.promoQuotesAll });
  qc.invalidateQueries({ queryKey: adminKeys.documents });
}
