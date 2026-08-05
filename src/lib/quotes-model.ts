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
};

export const DEFAULT_QUOTE_DESIGN: QuoteDesign = {
  accent_color: "",
  show_logo: true,
  show_cover: true,
  show_about: true,
  show_signature: true,
  show_stamp: false,
  show_requisites: true,
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

export type QuoteItem = {
  id: string;
  quote_id: string;
  section: string;
  title: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  sort_order: number;
  entity_type: string | null;
  entity_id: string | null;
};

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
};

export function computeTotals(quote: Pick<Quote, "discount_type" | "discount_value" | "prepayment_type" | "prepayment_value" | "delivery_amount">, items: Array<Pick<QuoteItem, "qty" | "price">>): QuoteTotals {
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
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
  return { subtotal, discount, delivery, total, prepayment, balance: Math.max(0, total - prepayment) };
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
  sort_order: z.number().int().min(0).default(0),
  entity_type: z.string().max(40).nullable().default(null),
  entity_id: z.string().uuid().nullable().default(null),
});

export const quotePatchSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  quote_number: z.string().max(60).optional(),
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
    sort_order: Math.trunc(num(row.sort_order)),
    section: String(row.section ?? ""),
    description: String(row.description ?? ""),
    unit: String(row.unit ?? "шт."),
  };
}
