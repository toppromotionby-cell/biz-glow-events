// Модель коммерческого предложения (КП): типы, значения по умолчанию,
// расчёт итогов и валидация. Файл browser-safe — используется и в админке,
// и на сервере при генерации документа.
import { z } from "zod";
import {
  QUOTE_TEMPLATES,
  normalizeBlocks,
  normalizeTemplate,
  type QuoteBlock,
  type QuoteTemplate,
} from "@/lib/quote-blocks";

export * from "@/lib/quote-blocks";

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  accepted: "Принято",
  rejected: "Отклонено",
};

export type QuoteTexts = {
  intro: string;
  included: string;
  excluded: string;
  timeline: string;
  terms: string;
  footer: string;
};

export const DEFAULT_QUOTE_TEXTS: QuoteTexts = {
  intro:
    "Благодарим за интерес к нашим услугам. Ниже — предложение по организации вашего мероприятия: состав, стоимость и условия сотрудничества.",
  included: "Доставка, монтаж и демонтаж оборудования\nРабота технической команды на площадке\nКоординация и сопровождение мероприятия",
  excluded: "Электропитание на площадке\nСогласования с администрацией площадки\nПитание персонала",
  timeline: "Монтаж — за 2–3 часа до начала мероприятия. Демонтаж — сразу после завершения.",
  terms:
    "Бронирование даты производится после согласования состава и внесения предоплаты. Окончательный расчёт — не позднее дня мероприятия.",
  footer: "",
};

export type QuoteDesign = {
  accent_color: string;
  show_logo: boolean;
  show_cover: boolean;
  show_about: boolean;
  show_signature: boolean;
  show_stamp: boolean;
  show_requisites: boolean;
  show_item_includes: boolean;
  show_section_subtotals: boolean;
};

export const DEFAULT_QUOTE_DESIGN: QuoteDesign = {
  accent_color: "",
  show_logo: true,
  show_cover: true,
  show_about: true,
  show_signature: true,
  show_stamp: false,
  show_requisites: true,
  show_item_includes: true,
  show_section_subtotals: true,
};

export type QuoteCompanyOverrides = Partial<{
  company_legal_name: string;
  company_brand: string;
  company_unp: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  bank_name: string;
  bank_bic: string;
  bank_account: string;
  signer_name: string;
  signer_title: string;
}>;

/** Пункт состава позиции: «что входит». */
export type QuoteItemInclude = { text: string; note: string };

export type QuoteItem = {
  id: string;
  quote_id: string;
  section: string;
  title: string;
  description: string;
  includes: QuoteItemInclude[];
  qty: number;
  unit: string;
  price: number;
  cost: number;
  sort_order: number;
  entity_type: string | null;
  entity_id: string | null;
};

export function normalizeIncludes(value: unknown): QuoteItemInclude[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (typeof raw === "string") return { text: raw.trim(), note: "" };
      const r = (raw ?? {}) as Record<string, unknown>;
      return { text: String(r.text ?? "").trim(), note: String(r.note ?? "").trim() };
    })
    .filter((r) => r.text.length > 0)
    .slice(0, 60);
}

export const NO_SECTION = "Без раздела";

/** Список разделов в порядке их первого появления. */
export function listSections(items: QuoteItem[]): string[] {
  const out: string[] = [];
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const key = it.section?.trim() || "";
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

const reindex = (items: QuoteItem[]): QuoteItem[] => items.map((it, i) => ({ ...it, sort_order: i }));

/** Пересобрать позиции в заданном порядке разделов. */
export function orderBySections(items: QuoteItem[], order: string[]): QuoteItem[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const out: QuoteItem[] = [];
  for (const section of order) out.push(...sorted.filter((it) => (it.section?.trim() || "") === section));
  for (const it of sorted) if (!out.includes(it)) out.push(it);
  return reindex(out);
}

export function renameSection(items: QuoteItem[], from: string, to: string): QuoteItem[] {
  return items.map((it) => ((it.section?.trim() || "") === from ? { ...it, section: to.trim() } : it));
}

export function moveSection(items: QuoteItem[], section: string, dir: -1 | 1): QuoteItem[] {
  const order = listSections(items);
  const i = order.indexOf(section);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return items;
  const next = [...order];
  next[i] = order[j]!;
  next[j] = order[i]!;
  return orderBySections(items, next);
}

/** Удалить раздел: вместе с позициями или с переносом их в «без раздела». */
export function removeSection(items: QuoteItem[], section: string, mode: "items" | "keep"): QuoteItem[] {
  const match = (it: QuoteItem) => (it.section?.trim() || "") === section;
  const next = mode === "items" ? items.filter((it) => !match(it)) : items.map((it) => (match(it) ? { ...it, section: "" } : it));
  return reindex([...next].sort((a, b) => a.sort_order - b.sort_order));
}

export function duplicateSection(items: QuoteItem[], section: string): QuoteItem[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const copies = sorted
    .filter((it) => (it.section?.trim() || "") === section)
    .map((it) => ({
      ...it,
      id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}`,
      section: `${section || NO_SECTION} (копия)`,
      includes: it.includes.map((x) => ({ ...x })),
    }));
  return reindex([...sorted, ...copies]);
}


export const QUOTE_SECTION_SUGGESTIONS = [
  "Оборудование",
  "Интерактивные зоны",
  "Персонал",
  "Логистика",
  "Продакшн",
  "Декор",
  "Дополнительно",
];


export type Quote = {
  id: string;
  quote_number: string | null;
  status: QuoteStatus;
  title: string;
  doc_date: string;
  validity_days: number;
  client_name: string;
  client_company: string;
  client_unp: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  event_date: string | null;
  event_time_start: string;
  event_time_end: string;
  venue: string;
  guests_count: number | null;
  event_format: string;
  setup_note: string;
  event_notes: string;
  company_overrides: QuoteCompanyOverrides;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  texts: QuoteTexts;
  design: QuoteDesign;
  template: QuoteTemplate;
  blocks: QuoteBlock[];
  discount_type: "none" | "percent" | "amount";
  discount_value: number;
  prepayment_type: "none" | "percent" | "amount";
  prepayment_value: number;
  delivery_amount: number;
  vat_note: string;
  total: number;
  order_id: string | null;
  sent_at: string | null;
  is_template: boolean;
  template_name: string;
  public_token: string;
  viewed_at: string | null;
  client_response: string;
  client_comment: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};


export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  prepayment: number;
  balance: number;
  cost: number;
  margin: number;
  marginPct: number;
};

export function computeTotals(
  quote: Pick<Quote, "discount_type" | "discount_value" | "prepayment_type" | "prepayment_value" | "delivery_amount">,
  items: Array<Pick<QuoteItem, "qty" | "price"> & { cost?: number }>,
): QuoteTotals {
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const cost = items.reduce((s, it) => s + num(it.qty) * num(it.cost), 0);
  const dv = Math.max(0, num(quote.discount_value));
  const discount =
    quote.discount_type === "percent" ? (subtotal * Math.min(dv, 100)) / 100
    : quote.discount_type === "amount" ? Math.min(dv, subtotal)
    : 0;
  const delivery = Math.max(0, num(quote.delivery_amount));
  const total = Math.max(0, subtotal - discount + delivery);
  const pv = Math.max(0, num(quote.prepayment_value));
  const prepayment =
    quote.prepayment_type === "percent" ? (total * Math.min(pv, 100)) / 100
    : quote.prepayment_type === "amount" ? Math.min(pv, total)
    : 0;
  const margin = subtotal - discount - cost;
  const revenue = subtotal - discount;
  return {
    subtotal, discount, delivery, total, prepayment,
    balance: Math.max(0, total - prepayment),
    cost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
  };
}

export type QuoteCheck = { level: "error" | "warn" | "info"; message: string };

/** Проверки документа перед отправкой клиенту. */
export function checkQuote(quote: Quote, items: QuoteItem[]): QuoteCheck[] {
  const out: QuoteCheck[] = [];
  const totals = computeTotals(quote, items);

  if (!quote.client_company.trim() && !quote.client_name.trim()) {
    out.push({ level: "error", message: "Не указан заказчик (компания или контактное лицо)" });
  }
  if (!items.length) out.push({ level: "error", message: "В предложении нет ни одной позиции" });
  if (!quote.title.trim()) out.push({ level: "warn", message: "Не заполнена тема предложения" });
  if (!quote.validity_days) out.push({ level: "warn", message: "Не указан срок действия предложения" });
  if (!quote.event_date) out.push({ level: "warn", message: "Не указана дата мероприятия" });
  if (!quote.client_email.trim()) out.push({ level: "warn", message: "Нет e-mail заказчика — отправка письмом недоступна" });

  const zero = items.filter((it) => num(it.price) <= 0);
  if (zero.length) {
    out.push({
      level: "warn",
      message: zero.length === 1 ? `Нулевая цена: ${zero[0]!.title || "позиция без названия"}` : `Нулевая цена у ${zero.length} позиций`,
    });
  }
  const noTitle = items.filter((it) => !it.title.trim()).length;
  if (noTitle) out.push({ level: "error", message: `Позиции без названия: ${noTitle}` });

  if (totals.discount >= totals.subtotal && totals.subtotal > 0) {
    out.push({ level: "error", message: "Скидка не может быть равна или больше суммы позиций" });
  }
  if (totals.cost > 0 && totals.marginPct < 15) {
    out.push({ level: "warn", message: `Низкая маржа: ${totals.marginPct.toFixed(1)}%` });
  }
  return out;
}

/** Разбор таблицы, скопированной из Excel: название / кол-во / ед. / цена [/ себестоимость]. */
export function parsePastedQuoteRows(text: string): Array<Pick<QuoteItem, "title" | "qty" | "unit" | "price" | "cost">> {
  const rows: Array<Pick<QuoteItem, "title" | "qty" | "unit" | "price" | "cost">> = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = raw.split("\t").length > 1 ? raw.split("\t") : raw.split(/ {2,}|;/);
    const title = (cells[0] ?? "").trim();
    if (!title) continue;
    const nums = cells.slice(1).map((c) => c.trim());
    const isNum = (v: string) => v !== "" && Number.isFinite(num(v, NaN));
    const qty = isNum(nums[0] ?? "") ? num(nums[0]) : 1;
    const unit = nums[1] && !isNum(nums[1]) ? nums[1] : "шт.";
    const priceCell = nums.slice(1).find((v) => isNum(v));
    const rest = nums.slice(1).filter((v) => isNum(v));
    rows.push({
      title,
      qty: qty || 1,
      unit,
      price: priceCell ? num(priceCell) : 0,
      cost: rest.length > 1 ? num(rest[1]) : 0,
    });
  }
  return rows;
}


// --- Сумма прописью (BYN) ---
const ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

function triadToWords(n: number, female: boolean): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) out.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) out.push(TENS[t]);
    if (o) out.push(female ? ONES_F[o] : ONES[o]);
  }
  return out;
}

export function amountToWords(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 100);
  const rub = Math.floor(rounded / 100);
  const kop = rounded % 100;
  if (rub === 0) return `ноль рублей ${String(kop).padStart(2, "0")} копеек`;

  const groups: Array<{ v: number; female: boolean; forms: [string, string, string] }> = [
    { v: Math.floor(rub / 1_000_000) % 1000, female: false, forms: ["миллион", "миллиона", "миллионов"] },
    { v: Math.floor(rub / 1000) % 1000, female: true, forms: ["тысяча", "тысячи", "тысяч"] },
    { v: rub % 1000, female: false, forms: ["", "", ""] },
  ];
  const words: string[] = [];
  groups.forEach((g, i) => {
    if (!g.v) return;
    words.push(...triadToWords(g.v, g.female));
    if (i < 2) words.push(plural(g.v, g.forms));
  });
  const rubWord = plural(rub, ["рубль", "рубля", "рублей"]);
  const kopWord = plural(kop, ["копейка", "копейки", "копеек"]);
  const text = `${words.join(" ")} ${rubWord} ${String(kop).padStart(2, "0")} ${kopWord}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Валидация ---
const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const quoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  section: z.string().max(120).default(""),
  title: z.string().trim().min(1, "Укажите название").max(300),
  description: z.string().max(2000).default(""),
  qty: z.number().min(0, "Не может быть отрицательным").max(100000),
  unit: z.string().max(40).default("шт."),
  price: z.number().min(0, "Не может быть отрицательной").max(10_000_000),
  cost: z.number().min(0).max(10_000_000).default(0),
  sort_order: z.number().int().min(0).default(0),
  entity_type: z.string().max(40).nullable().default(null),
  entity_id: z.string().uuid().nullable().default(null),
});

export const quotePatchSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  quote_number: z.string().max(60).optional(),
  is_template: z.boolean().optional(),
  template_name: z.string().max(160).optional(),
  title: z.string().max(200).optional(),

  doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата").optional(),
  validity_days: z.number().int().min(0).max(365).optional(),
  client_name: z.string().max(200).optional(),
  client_company: z.string().max(200).optional(),
  client_unp: z.string().max(40).optional(),
  client_phone: z.string().max(60).optional(),
  client_email: z.string().max(200).optional(),
  client_address: z.string().max(300).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  event_time_start: z.string().refine((v) => v === "" || timeRe.test(v), "Формат ЧЧ:ММ").optional(),
  event_time_end: z.string().refine((v) => v === "" || timeRe.test(v), "Формат ЧЧ:ММ").optional(),
  venue: z.string().max(300).optional(),
  guests_count: z.number().int().min(0).max(100000).nullable().optional(),
  event_format: z.string().max(200).optional(),
  setup_note: z.string().max(500).optional(),
  event_notes: z.string().max(3000).optional(),
  company_overrides: z.record(z.string(), z.string()).optional(),
  logo_url: z.string().max(1000).nullable().optional(),
  signature_url: z.string().max(1000).nullable().optional(),
  stamp_url: z.string().max(1000).nullable().optional(),
  texts: z.record(z.string(), z.string()).optional(),
  design: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  template: z.enum(QUOTE_TEMPLATES).optional(),
  blocks: z
    .array(
      z.object({
        id: z.string().max(80),
        type: z.string().max(40),
        title: z.string().max(160).default(""),
        enabled: z.boolean().default(true),
        content: z.string().max(5000).default(""),
        condition: z.string().max(40).default("always"),
      }),
    )
    .max(40)
    .optional(),

  discount_type: z.enum(["none", "percent", "amount"]).optional(),
  discount_value: z.number().min(0).max(10_000_000).optional(),
  prepayment_type: z.enum(["none", "percent", "amount"]).optional(),
  prepayment_value: z.number().min(0).max(10_000_000).optional(),
  delivery_amount: z.number().min(0).max(10_000_000).optional(),
  vat_note: z.string().max(300).optional(),
  order_id: z.string().uuid().nullable().optional(),
});

/** Нормализация строки из БД в модель Quote. */
export function normalizeQuote(row: Record<string, unknown>): Quote {
  return {
    ...(row as unknown as Quote),
    status: (QUOTE_STATUSES as readonly string[]).includes(String(row.status)) ? (row.status as QuoteStatus) : "draft",
    company_overrides: (row.company_overrides ?? {}) as QuoteCompanyOverrides,
    texts: { ...DEFAULT_QUOTE_TEXTS, ...((row.texts ?? {}) as Partial<QuoteTexts>) },
    design: { ...DEFAULT_QUOTE_DESIGN, ...((row.design ?? {}) as Partial<QuoteDesign>) },
    template: normalizeTemplate(row.template),
    blocks: normalizeBlocks(row.blocks, normalizeTemplate(row.template)),
    discount_value: num(row.discount_value),
    prepayment_value: num(row.prepayment_value),
    delivery_amount: num(row.delivery_amount),
    total: num(row.total),
  };
}

export function normalizeItem(row: Record<string, unknown>): QuoteItem {
  return {
    ...(row as unknown as QuoteItem),
    qty: num(row.qty, 1),
    price: num(row.price),
    cost: num(row.cost),
    sort_order: Math.trunc(num(row.sort_order)),
    section: String(row.section ?? ""),
    description: String(row.description ?? ""),
    includes: normalizeIncludes(row.includes),
    unit: String(row.unit ?? "шт."),
  };
}

/** Пустая позиция КП. */
export function emptyQuoteItem(quoteId: string, sortOrder: number, init?: Partial<QuoteItem>): QuoteItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}`,
    quote_id: quoteId,
    section: "",
    title: "",
    description: "",
    includes: [],
    qty: 1,
    unit: "шт.",
    price: 0,
    cost: 0,
    sort_order: sortOrder,
    entity_type: null,
    entity_id: null,
    ...init,
  };
}


