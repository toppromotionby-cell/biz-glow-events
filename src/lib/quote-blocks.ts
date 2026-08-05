// Шаблоны КП и конструктор блоков документа.
// Browser-safe: используется в админке (редактор), при рендере HTML и PDF.

export const QUOTE_TEMPLATES = ["classic", "minimal", "premium"] as const;
export type QuoteTemplate = (typeof QUOTE_TEMPLATES)[number];

export const QUOTE_TEMPLATE_LABELS: Record<QuoteTemplate, string> = {
  classic: "Классический",
  minimal: "Минимальный",
  premium: "Премиум",
};

export const QUOTE_TEMPLATE_HINTS: Record<QuoteTemplate, string> = {
  classic: "Полное КП: обложка, детали, состав, условия, реквизиты, подписи",
  minimal: "Только суть: состав, итоги и короткие условия",
  premium: "Презентационный: акцентная обложка, «что входит», сроки, реквизиты",
};

export const QUOTE_BLOCK_TYPES = [
  "cover",
  "client",
  "event",
  "items",
  "totals",
  "included",
  "excluded",
  "timeline",
  "terms",
  "requisites",
  "signature",
  "text",
] as const;
export type QuoteBlockType = (typeof QUOTE_BLOCK_TYPES)[number];

export const QUOTE_BLOCK_LABELS: Record<QuoteBlockType, string> = {
  cover: "Обложка",
  client: "Заказчик",
  event: "Мероприятие",
  items: "Состав предложения",
  totals: "Итоги и оплата",
  included: "Что входит",
  excluded: "Не входит",
  timeline: "Сроки и логистика",
  terms: "Условия",
  requisites: "Реквизиты исполнителя",
  signature: "Подписи сторон",
  text: "Произвольный текст",
};

/** Блоки, содержимое которых редактируется прямо в блоке (текстовые). */
export const EDITABLE_BLOCK_TYPES: QuoteBlockType[] = [
  "cover",
  "included",
  "excluded",
  "timeline",
  "terms",
  "text",
];

export type QuoteBlock = {
  id: string;
  type: QuoteBlockType;
  title: string;
  enabled: boolean;
  content: string;
};

export const QUOTE_PLACEHOLDERS: Array<{ key: string; label: string; group: string }> = [
  { key: "client_name", label: "Контактное лицо", group: "Заказчик" },
  { key: "client_company", label: "Компания заказчика", group: "Заказчик" },
  { key: "client_unp", label: "УНП заказчика", group: "Заказчик" },
  { key: "client_phone", label: "Телефон заказчика", group: "Заказчик" },
  { key: "client_email", label: "E-mail заказчика", group: "Заказчик" },

  { key: "event_date", label: "Дата мероприятия", group: "Мероприятие" },
  { key: "event_time", label: "Время мероприятия", group: "Мероприятие" },
  { key: "venue", label: "Площадка", group: "Мероприятие" },
  { key: "guests", label: "Количество гостей", group: "Мероприятие" },
  { key: "event_format", label: "Формат", group: "Мероприятие" },
  { key: "setup_note", label: "Монтаж / демонтаж", group: "Мероприятие" },

  { key: "subtotal", label: "Стоимость позиций", group: "Суммы" },
  { key: "discount", label: "Скидка", group: "Суммы" },
  { key: "delivery", label: "Доставка", group: "Суммы" },
  { key: "total", label: "Итого", group: "Суммы" },
  { key: "total_words", label: "Итого прописью", group: "Суммы" },
  { key: "prepayment", label: "Предоплата", group: "Суммы" },
  { key: "balance", label: "Остаток к оплате", group: "Суммы" },

  { key: "quote_number", label: "Номер КП", group: "Документ" },
  { key: "doc_date", label: "Дата документа", group: "Документ" },
  { key: "valid_until", label: "Действительно до", group: "Документ" },
  { key: "quote_title", label: "Тема предложения", group: "Документ" },

  { key: "company_legal", label: "Юр. название", group: "Реквизиты" },
  { key: "company_brand", label: "Бренд", group: "Реквизиты" },
  { key: "company_unp", label: "УНП", group: "Реквизиты" },
  { key: "company_address", label: "Адрес", group: "Реквизиты" },
  { key: "company_phone", label: "Телефон", group: "Реквизиты" },
  { key: "company_email", label: "E-mail", group: "Реквизиты" },
  { key: "company_website", label: "Сайт", group: "Реквизиты" },
  { key: "bank_name", label: "Банк", group: "Реквизиты" },
  { key: "bank_bic", label: "БИК", group: "Реквизиты" },
  { key: "bank_account", label: "Расчётный счёт", group: "Реквизиты" },
  { key: "signer_name", label: "Подписант", group: "Реквизиты" },
  { key: "signer_title", label: "Должность подписанта", group: "Реквизиты" },
];

export type PlaceholderMap = Record<string, string>;

/** Подстановка {{placeholder}} в произвольный текст блока. */
export function applyPlaceholders(text: string, map: PlaceholderMap): string {
  return String(text ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const v = map[key.toLowerCase()];
    return v === undefined ? full : v;
  });
}

function block(type: QuoteBlockType, content = "", enabled = true): QuoteBlock {
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title: QUOTE_BLOCK_LABELS[type],
    enabled,
    content,
  };
}

const TEMPLATE_BLOCKS: Record<QuoteTemplate, QuoteBlockType[]> = {
  classic: [
    "cover", "client", "event", "items", "totals",
    "included", "excluded", "timeline", "terms", "requisites", "signature",
  ],
  minimal: ["client", "items", "totals", "terms", "requisites"],
  premium: [
    "cover", "client", "event", "items", "totals",
    "included", "timeline", "terms", "requisites", "signature",
  ],
};

export function defaultBlocksForTemplate(template: QuoteTemplate): QuoteBlock[] {
  return (TEMPLATE_BLOCKS[template] ?? TEMPLATE_BLOCKS.classic).map((t) => block(t));
}

export function newTextBlock(): QuoteBlock {
  return {
    ...block("text"),
    title: "Дополнительный раздел",
    content:
      "Для {{client_company}} на {{event_date}}, площадка: {{venue}}. Итого: {{total}}, предоплата {{prepayment}}.",
  };
}

export function newBlock(type: QuoteBlockType): QuoteBlock {
  return type === "text" ? newTextBlock() : block(type);
}

export function normalizeBlocks(raw: unknown, template: QuoteTemplate): QuoteBlock[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: QuoteBlock[] = [];
  for (const r of arr) {
    const o = (r ?? {}) as Record<string, unknown>;
    const type = String(o.type ?? "") as QuoteBlockType;
    if (!(QUOTE_BLOCK_TYPES as readonly string[]).includes(type)) continue;
    out.push({
      id: String(o.id ?? `${type}-${out.length}`),
      type,
      title: String(o.title ?? QUOTE_BLOCK_LABELS[type]),
      enabled: o.enabled !== false,
      content: String(o.content ?? ""),
    });
  }
  return out.length ? out : defaultBlocksForTemplate(template);
}

export function normalizeTemplate(raw: unknown): QuoteTemplate {
  const v = String(raw ?? "");
  return (QUOTE_TEMPLATES as readonly string[]).includes(v) ? (v as QuoteTemplate) : "classic";
}
