// Типы документов, которые можно отправить в Telegram. Клиентский модуль.
export const TG_DOC_KINDS = [
  "quote",
  "quote-internal",
  "promo",
  "promo-internal",
  "finance",
  "paperwork",
  "presentation",
  "order",
] as const;

export type TgDocKind = (typeof TG_DOC_KINDS)[number];

export const TG_DOC_LABELS: Record<TgDocKind, string> = {
  quote: "КП",
  "quote-internal": "КП (внутренний расчёт)",
  promo: "Промо-КП",
  "promo-internal": "Промо-КП (внутренний расчёт)",
  finance: "Финансовый документ",
  paperwork: "Корпоративный документ",
  presentation: "Презентация",
  order: "Документ по заявке",
};
