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

/** Условия автопоказа блока — блок скрывается, если данных нет. */
export const QUOTE_BLOCK_CONDITIONS = [
  "always",
  "has_items",
  "has_discount",
  "has_delivery",
  "has_fees",
  "has_prepayment",
  "has_requisites",
  "has_event_date",
  "has_venue",
  "has_client_company",
  "has_content",
] as const;
export type QuoteBlockCondition = (typeof QUOTE_BLOCK_CONDITIONS)[number];

export const QUOTE_BLOCK_CONDITION_LABELS: Record<QuoteBlockCondition, string> = {
  always: "Показывать всегда",
  has_items: "Если есть позиции",
  has_discount: "Если есть скидка",
  has_delivery: "Если есть доставка",
  has_fees: "Если есть менеджмент или комиссия",
  has_prepayment: "Если есть предоплата",
  has_requisites: "Если заполнены реквизиты",
  has_event_date: "Если указана дата мероприятия",
  has_venue: "Если указана площадка",
  has_client_company: "Если указана компания заказчика",
  has_content: "Если текст блока не пустой",
};

export type QuoteConditionContext = Record<QuoteBlockCondition, boolean> & { has_content?: boolean };

export function evaluateBlockCondition(
  condition: QuoteBlockCondition | undefined,
  ctx: Partial<QuoteConditionContext>,
  hasContent: boolean,
): boolean {
  const c = condition ?? "always";
  if (c === "always") return true;
  if (c === "has_content") return hasContent;
  return ctx[c] === true;
}

export type QuoteBlock = {
  id: string;
  type: QuoteBlockType;
  title: string;
  enabled: boolean;
  content: string;
  /** Условие автопоказа. По умолчанию "always". */
  condition: QuoteBlockCondition;
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
  { key: "management", label: "Менеджмент", group: "Суммы" },
  { key: "agency_fee", label: "Комиссия агентства", group: "Суммы" },
  { key: "total", label: "Итого", group: "Суммы" },
  { key: "total_words", label: "Итого прописью", group: "Суммы" },
  { key: "prepayment", label: "Предоплата", group: "Суммы" },
  { key: "advance", label: "Аванс (= предоплата)", group: "Суммы" },
  { key: "balance", label: "Остаток к оплате", group: "Суммы" },
  { key: "vat_rate", label: "Ставка НДС, %", group: "Суммы" },
  { key: "vat_amount", label: "Сумма НДС", group: "Суммы" },
  { key: "total_with_vat", label: "Итого с НДС", group: "Суммы" },
  { key: "items_count", label: "Количество позиций", group: "Суммы" },
  { key: "items_qty", label: "Суммарное количество единиц", group: "Суммы" },
  { key: "= total - advance", label: "Формула: {{= выражение }}", group: "Суммы" },


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
/** Числовые значения для формул {{= ... }}. */
export type NumericMap = Record<string, number>;

/** Ставка НДС по умолчанию (%), используется в {{vat_amount}} / {{total_with_vat}}. */
export const QUOTE_VAT_RATE = 20;

export function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} BYN`;
}

/**
 * Безопасный расчёт арифметического выражения: + - * / ( ) и числа/переменные.
 * eval не используется — простой разбор по алгоритму сортировочной станции.
 */
export function evaluateFormula(expr: string, vars: NumericMap): number | null {
  const tokens = String(expr ?? "").match(/\d+(?:[.,]\d+)?|[a-z_][a-z0-9_]*|[()+\-*/%]/gi);
  if (!tokens || !tokens.length) return null;

  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  const out: Array<number | string> = [];
  const ops: string[] = [];
  let prevWasValue = false;

  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (/^\d/.test(t)) {
      out.push(Number(t.replace(",", ".")));
      prevWasValue = true;
    } else if (/^[a-z_]/.test(t)) {
      const v = vars[t];
      if (v === undefined || !Number.isFinite(v)) return null;
      out.push(v);
      prevWasValue = true;
    } else if (t === "(") {
      ops.push(t);
      prevWasValue = false;
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!);
      if (!ops.length) return null;
      ops.pop();
      prevWasValue = true;
    } else {
      // унарный минус/плюс
      if (!prevWasValue && (t === "-" || t === "+")) out.push(0);
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]!]! >= prec[t]!) {
        out.push(ops.pop()!);
      }
      ops.push(t);
      prevWasValue = false;
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") return null;
    out.push(op);
  }

  const stack: number[] = [];
  for (const tok of out) {
    if (typeof tok === "number") {
      stack.push(tok);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    if (tok === "+") stack.push(a + b);
    else if (tok === "-") stack.push(a - b);
    else if (tok === "*") stack.push(a * b);
    else if (tok === "%") stack.push((a * b) / 100);
    else if (tok === "/") stack.push(b === 0 ? 0 : a / b);
    else return null;
  }
  const res = stack.length === 1 ? stack[0]! : null;
  return res !== null && Number.isFinite(res) ? res : null;
}

/**
 * Подстановка {{placeholder}} и вычисляемых выражений {{= subtotal - discount }}.
 */
export function applyPlaceholders(text: string, map: PlaceholderMap, numbers: NumericMap = {}): string {
  return String(text ?? "").replace(/\{\{\s*(=?)\s*([^{}]+?)\s*\}\}/g, (full, eq: string, body: string) => {
    if (eq === "=") {
      const res = evaluateFormula(body, numbers);
      return res === null ? full : formatMoney(res);
    }
    const key = body.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(key)) return full;
    const v = map[key];
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
    condition: DEFAULT_BLOCK_CONDITION[type] ?? "always",
  };
}

/** Разумные условия «из коробки»: блок сам исчезает, если данных нет. */
const DEFAULT_BLOCK_CONDITION: Partial<Record<QuoteBlockType, QuoteBlockCondition>> = {
  items: "has_items",
  requisites: "has_requisites",
  included: "has_content",
  excluded: "has_content",
  timeline: "has_content",
  terms: "has_content",
  text: "has_content",
};

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

/** Готовая библиотека блоков — быстрые заготовки для сборки КП. */
export type QuoteSnippetPreset = {
  key: string;
  name: string;
  description: string;
  type: QuoteBlockType;
  title: string;
  content: string;
  condition: QuoteBlockCondition;
};

export const QUOTE_SNIPPET_PRESETS: QuoteSnippetPreset[] = [
  {
    key: "payment_schedule",
    name: "График платежей",
    description: "Предоплата и остаток с автоматическим расчётом сумм",
    type: "text",
    title: "Порядок оплаты",
    content:
      "Предоплата: {{prepayment}} — для бронирования даты {{event_date}}.\nОстаток: {{= total - advance }} — не позднее дня мероприятия.\nОбщая сумма договора: {{total}} ({{total_words}}).",
    condition: "has_prepayment",
  },
  {
    key: "delivery_block",
    name: "Доставка и логистика",
    description: "Показывается только если в КП есть стоимость доставки",
    type: "text",
    title: "Доставка и логистика",
    content:
      "Доставка, монтаж и демонтаж оборудования на площадку «{{venue}}» — {{delivery}}.\nВыезд команды и все погрузочные работы включены в стоимость.",
    condition: "has_delivery",
  },
  {
    key: "discount_note",
    name: "Комментарий по скидке",
    description: "Появляется только когда применена скидка",
    type: "text",
    title: "Специальные условия",
    content:
      "Для вас действует специальная скидка — {{discount}}. Стоимость позиций до скидки: {{subtotal}}, итог с учётом всех условий: {{total}}.",
    condition: "has_discount",
  },
  {
    key: "vat_block",
    name: "Расчёт с НДС",
    description: "Итог с НДС по ставке 20%",
    type: "text",
    title: "Расчёт с НДС",
    content:
      "Стоимость без НДС: {{total}}.\nНДС {{vat_rate}}%: {{vat_amount}}.\nИтого с НДС: {{total_with_vat}}.",
    condition: "always",
  },
  {
    key: "requisites_note",
    name: "Реквизиты для оплаты",
    description: "Показывается, если реквизиты заполнены",
    type: "text",
    title: "Реквизиты для оплаты",
    content:
      "{{company_legal}}, УНП {{company_unp}}\nр/с {{bank_account}}, {{bank_name}}, БИК {{bank_bic}}\nНазначение платежа: оплата по КП №{{quote_number}} от {{doc_date}}.",
    condition: "has_requisites",
  },
  {
    key: "venue_note",
    name: "Требования к площадке",
    description: "Появляется, если указана площадка",
    type: "text",
    title: "Требования к площадке",
    content:
      "Площадка: {{venue}}. Необходим доступ для разгрузки за 3 часа до начала, электропитание 220В и свободная зона монтажа.",
    condition: "has_venue",
  },
  {
    key: "validity",
    name: "Срок действия предложения",
    description: "Короткая приписка со сроком действия КП",
    type: "text",
    title: "Срок действия предложения",
    content:
      "Предложение действительно до {{valid_until}}. После этой даты состав и стоимость могут быть пересчитаны.",
    condition: "always",
  },
  {
    key: "about",
    name: "О компании",
    description: "Презентационный абзац для премиум-КП",
    type: "text",
    title: "О нас",
    content:
      "{{company_brand}} — техническое и организационное сопровождение мероприятий под ключ: звук, свет, сцена, декор и координация. Работаем с корпоративными клиентами и площадками по всей Беларуси.",
    condition: "always",
  },
];

export type QuoteSnippet = {
  id: string;
  name: string;
  description: string;
  block_type: QuoteBlockType;
  title: string;
  content: string;
  condition: QuoteBlockCondition;
};

export function blockFromSnippet(s: {
  block_type?: string;
  type?: string;
  title?: string;
  content?: string;
  condition?: string;
}): QuoteBlock {
  const type = normalizeBlockType(s.block_type ?? s.type);
  return {
    ...block(type),
    title: s.title?.trim() || QUOTE_BLOCK_LABELS[type],
    content: s.content ?? "",
    condition: normalizeCondition(s.condition),
  };
}

export function normalizeBlockType(raw: unknown): QuoteBlockType {
  const v = String(raw ?? "");
  return (QUOTE_BLOCK_TYPES as readonly string[]).includes(v) ? (v as QuoteBlockType) : "text";
}

export function normalizeCondition(raw: unknown): QuoteBlockCondition {
  const v = String(raw ?? "");
  return (QUOTE_BLOCK_CONDITIONS as readonly string[]).includes(v) ? (v as QuoteBlockCondition) : "always";
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
      condition: normalizeCondition(o.condition),
    });
  }
  return out.length ? out : defaultBlocksForTemplate(template);
}


export function normalizeTemplate(raw: unknown): QuoteTemplate {
  const v = String(raw ?? "");
  return (QUOTE_TEMPLATES as readonly string[]).includes(v) ? (v as QuoteTemplate) : "classic";
}
