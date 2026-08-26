// Модель коммерческого предложения (КП): типы, значения по умолчанию,
// расчёт итогов и валидация. Файл browser-safe — используется и в админке,
// и на сервере при генерации документа.
import { z } from "zod";
import { normalizeDocFontChoice, type DocFontChoice } from "@/lib/documents/doc-font";
import {
  QUOTE_TEMPLATES,
  normalizeBlocks,
  normalizeTemplate,
  type QuoteBlock,
  type QuoteTemplate,
} from "@/lib/quote-blocks";
import { checkVatConfig, computeVat, vatConfig, normalizeVatMode, DEFAULT_VAT_RATE, type VatMode } from "@/lib/documents/vat";
import { checkFeesConfig, documentFees, normalizeFeeType, type FeeLine, type FeeType } from "@/lib/documents/fees";
import { normalizeLogoLayout, type LogoLayout } from "@/lib/documents/logo-layout";
import { normalizeCompanyOverrides, type CompanyOverrides } from "@/lib/documents/company";
import { normalizeCostMode, resolveUnitCost, type CostMode } from "@/lib/documents/economics";

export * from "@/lib/quote-blocks";
export * from "@/lib/documents/vat";


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
  /** Переопределения печати (мм / множители), см. documents/print-preset. */
  print_margin_top_mm?: number;
  print_margin_bottom_mm?: number;
  print_margin_x_mm?: number;
  print_line_height?: number;
  print_block_gap?: number;
  print_row_gap?: number;
  print_font_scale?: number;
  print_max_pages?: number;
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

export type QuoteCompanyOverrides = CompanyOverrides;

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
  /** Себестоимость за единицу (вычисляется из cost_mode + cost_input). */
  cost: number;
  /** Режим ввода себестоимости: сумма или процент от цены. */
  cost_mode: CostMode;
  /** Введённое значение себестоимости в выбранном режиме. */
  cost_input: number;
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
  valid_until_override: string | null;
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
  company_id: string | null;
  company_overrides: QuoteCompanyOverrides;
  logo_url: string | null;
  logo_layout: LogoLayout;
  signature_url: string | null;
  stamp_url: string | null;
  texts: QuoteTexts;
  design: QuoteDesign;
  template: QuoteTemplate;
  /** Шрифт документа: inherit — как в настройках. */
  font_family: DocFontChoice;
  blocks: QuoteBlock[];
  discount_type: "none" | "percent" | "amount";
  discount_value: number;
  prepayment_type: "none" | "percent" | "amount";
  prepayment_value: number;
  delivery_amount: number;
  /** Менеджмент: нет / процент от суммы после скидки и доставки / фикс. сумма. */
  management_type: FeeType;
  management_value: number;
  /** Комиссия агентства: считается после менеджмента, до НДС. */
  agency_fee_type: FeeType;
  agency_fee_value: number;
  vat_mode: VatMode;
  vat_rate: number;
  vat_as_line: boolean;
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
  /** Менеджмент — начисление до НДС. */
  management: number;
  /** Комиссия агентства — начисление до НДС. */
  agencyFee: number;
  /** Строки начислений для блока «Итого» (только ненулевые). */
  feeLines: FeeLine[];
  /** Сумма до НДС (в режиме «в том числе» — очищенная от налога). */
  net: number;
  vat: number;
  vatRate: number;
  vatMode: VatMode;
  vatEnabled: boolean;
  /** Итог к оплате (с НДС, если он есть). */
  total: number;
  prepayment: number;
  balance: number;
  cost: number;
  margin: number;
  marginPct: number;
};

export function computeTotals(
  quote: Pick<Quote, "discount_type" | "discount_value" | "prepayment_type" | "prepayment_value" | "delivery_amount"> &
    Partial<Pick<Quote, "vat_mode" | "vat_rate" | "vat_as_line">> &
    Partial<Pick<Quote, "management_type" | "management_value" | "agency_fee_type" | "agency_fee_value">>,
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
  const feeBase = Math.max(0, subtotal - discount + delivery);
  const fees = documentFees(feeBase, quote);
  const base = Math.max(0, feeBase + fees.total);
  const v = computeVat(base, vatConfig(quote));
  const total = v.gross;
  const pv = Math.max(0, num(quote.prepayment_value));
  const prepayment =
    quote.prepayment_type === "percent" ? (total * Math.min(pv, 100)) / 100
    : quote.prepayment_type === "amount" ? Math.min(pv, total)
    : 0;
  const revenue = v.net;
  const margin = revenue - cost;
  return {
    subtotal, discount, delivery,
    management: fees.management,
    agencyFee: fees.agency,
    feeLines: fees.lines,
    net: v.net,
    vat: v.vat,
    vatRate: v.rate,
    vatMode: v.mode,
    vatEnabled: v.enabled,
    total, prepayment,
    balance: Math.max(0, total - prepayment),
    cost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
  };

}


/** Область, к которой относится проверка — используется для перехода к нужной вкладке. */
export type QuoteCheckScope = "doc" | "client" | "item" | "block" | "totals";

export type QuoteCheck = {
  level: "error" | "warn" | "info";
  message: string;
  /** Машинный код правила. */
  code?: string;
  scope?: QuoteCheckScope;
  /** id позиции / блока, к которому относится замечание. */
  refId?: string;
  itemIndex?: number;
};

/** Проверки документа перед отправкой клиенту. */
export function checkQuote(quote: Quote, items: QuoteItem[]): QuoteCheck[] {
  const out: QuoteCheck[] = [];
  const totals = computeTotals(quote, items);
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  if (!quote.client_company.trim() && !quote.client_name.trim()) {
    out.push({ level: "error", code: "client_missing", scope: "client", message: "Не указан заказчик (компания или контактное лицо)" });
  }
  if (!items.length) out.push({ level: "error", code: "items_empty", scope: "item", message: "В предложении нет ни одной позиции" });
  if (!quote.title.trim()) out.push({ level: "warn", code: "title_missing", scope: "doc", message: "Не заполнена тема предложения" });
  if (!quote.validity_days) out.push({ level: "warn", code: "validity_missing", scope: "doc", message: "Не указан срок действия предложения" });
  if (!quote.event_date) out.push({ level: "warn", code: "event_date_missing", scope: "client", message: "Не указана дата мероприятия" });
  if (!quote.client_email.trim()) {
    out.push({ level: "warn", code: "client_email_missing", scope: "client", message: "Нет e-mail заказчика — отправка письмом недоступна" });
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(quote.client_email.trim())) {
    out.push({ level: "error", code: "client_email_invalid", scope: "client", message: "Некорректный e-mail заказчика" });
  }

  // Построчные проверки: без них превью показывает нули и пустые строки.
  sorted.forEach((it, i) => {
    const label = it.title.trim() || `строка ${i + 1}`;
    const ref = { scope: "item" as const, refId: it.id, itemIndex: i };
    if (!it.title.trim()) out.push({ level: "error", code: "item_title", message: `Строка ${i + 1}: нет названия позиции`, ...ref });
    if (num(it.price) < 0 || num(it.qty) < 0) {
      out.push({ level: "error", code: "item_negative", message: `${label}: отрицательное количество или цена`, ...ref });
    } else {
      if (num(it.price) === 0) out.push({ level: "warn", code: "item_price_zero", message: `${label}: не указана цена — в сумму попадёт 0`, ...ref });
      if (num(it.qty) === 0) out.push({ level: "warn", code: "item_qty_zero", message: `${label}: количество 0 — строка не попадёт в итог`, ...ref });
    }
    if (!it.unit.trim()) out.push({ level: "warn", code: "item_unit", message: `${label}: не указана единица измерения`, ...ref });
    if (num(it.cost) > 0 && num(it.cost) > num(it.price)) {
      out.push({ level: "warn", code: "item_cost", message: `${label}: себестоимость выше цены`, ...ref });
    }
  });

  if (totals.discount >= totals.subtotal && totals.subtotal > 0) {
    out.push({ level: "error", code: "discount_too_big", scope: "totals", message: "Скидка не может быть равна или больше суммы позиций" });
  }
  if (totals.total <= 0 && items.length > 0) {
    out.push({ level: "error", code: "total_zero", scope: "totals", message: "Итог документа равен нулю — проверьте цены, скидку и доставку" });
  }
  if (totals.prepayment > totals.total && totals.total > 0) {
    out.push({ level: "error", code: "prepayment_too_big", scope: "totals", message: "Предоплата больше итоговой суммы" });
  }
  for (const f of checkFeesConfig(quote, totals.subtotal)) {
    out.push({ level: f.level, code: f.code, scope: "totals", message: f.message });
  }
  for (const v of checkVatConfig(quote)) {
    out.push({ level: v.level, code: v.code, scope: "totals", message: v.message });
  }
  if (totals.cost > 0 && totals.marginPct < 15) {
    out.push({ level: "warn", code: "low_margin", scope: "totals", message: `Низкая маржа: ${totals.marginPct.toFixed(1)}%` });
  }
  return out;
}

/** Короткая сводка по проверкам: сколько ошибок и предупреждений. */
export function summarizeChecks(checks: QuoteCheck[]): { errors: number; warns: number } {
  return {
    errors: checks.filter((c) => c.level === "error").length,
    warns: checks.filter((c) => c.level === "warn").length,
  };
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

/**
 * Приводит время к виду ЧЧ:ММ: "18:00:00" → "18:00", "1800"/"18.00"/"18-00" → "18:00",
 * "9:5" → "09:05". Непонятное значение возвращается как есть (его отсеет проверка).
 */
export function normalizeTime(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const m = /^(\d{1,2})\s*[:.\-\s]?\s*(\d{1,2})?(?::\d{1,2})?$/.exec(raw);
  if (!m) return raw;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (!Number.isFinite(h) || h > 23 || min > 59) return raw;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Поле времени в patch-схеме: пустое значение допустимо, остальное нормализуется. */
const timeField = () =>
  z
    .preprocess((v) => (typeof v === "string" ? normalizeTime(v) : v),
      z.string().refine((v) => v === "" || timeRe.test(v), "укажите в формате ЧЧ:ММ"))
    .optional();


export const quoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  section: z.string().max(120).default(""),
  title: z.string().trim().min(1, "Укажите название").max(300),
  description: z.string().max(2000).default(""),
  includes: z
    .array(z.object({ text: z.string().max(300).default(""), note: z.string().max(120).default("") }))
    .max(60)
    .default([]),
  qty: z.number().min(0, "Не может быть отрицательным").max(100000),
  unit: z.string().max(40).default("шт."),
  price: z.number().min(0, "Не может быть отрицательной").max(10_000_000),
  cost: z.number().min(0).max(10_000_000).default(0),
  cost_mode: z.enum(["amount", "percent"]).default("amount"),
  cost_input: z.number().min(0).max(10_000_000).default(0),
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
  valid_until_override: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата")
    .nullable()
    .optional(),
  client_name: z.string().max(200).optional(),
  client_company: z.string().max(200).optional(),
  client_unp: z.string().max(40).optional(),
  client_phone: z.string().max(60).optional(),
  client_email: z.string().max(200).optional(),
  client_address: z.string().max(300).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  event_time_start: timeField(),
  event_time_end: timeField(),
  venue: z.string().max(300).optional(),
  guests_count: z.number().int().min(0).max(100000).nullable().optional(),
  event_format: z.string().max(200).optional(),
  setup_note: z.string().max(500).optional(),
  event_notes: z.string().max(3000).optional(),
  company_id: z.string().uuid().nullable().optional(),
  company_overrides: z.record(z.string(), z.string()).optional(),
  logo_url: z.string().max(1000).nullable().optional(),
  logo_layout: z
    .unknown()
    .optional()
    .transform((v) => (v === undefined ? undefined : normalizeLogoLayout(v))),

  signature_url: z.string().max(1000).nullable().optional(),
  stamp_url: z.string().max(1000).nullable().optional(),
  texts: z.record(z.string(), z.string()).optional(),
  design: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  template: z.enum(QUOTE_TEMPLATES).optional(),
  font_family: z.unknown().optional().transform((v) => (v === undefined ? undefined : normalizeDocFontChoice(v))),
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
  vat_mode: z.enum(["none", "add", "included"]).optional(),
  vat_rate: z.number().min(0).max(30).optional(),
  vat_as_line: z.boolean().optional(),
  vat_note: z.string().max(300).optional(),
  management_type: z.enum(["none", "percent", "amount"]).optional(),
  management_value: z.number().min(0).max(10_000_000).optional(),
  agency_fee_type: z.enum(["none", "percent", "amount"]).optional(),
  agency_fee_value: z.number().min(0).max(10_000_000).optional(),
  order_id: z.string().uuid().nullable().optional(),
});

/** Нормализация строки из БД в модель Quote. */
export function normalizeQuote(row: Record<string, unknown>): Quote {
  return {
    ...(row as unknown as Quote),
    event_time_start: normalizeTime(row.event_time_start),
    event_time_end: normalizeTime(row.event_time_end),
    status: (QUOTE_STATUSES as readonly string[]).includes(String(row.status)) ? (row.status as QuoteStatus) : "draft",
    company_id: row.company_id ? String(row.company_id) : null,
    company_overrides: normalizeCompanyOverrides(row.company_overrides),
    texts: { ...DEFAULT_QUOTE_TEXTS, ...((row.texts ?? {}) as Partial<QuoteTexts>) },
    design: { ...DEFAULT_QUOTE_DESIGN, ...((row.design ?? {}) as Partial<QuoteDesign>) },
    logo_layout: normalizeLogoLayout(row.logo_layout),
    template: normalizeTemplate(row.template),
    font_family: normalizeDocFontChoice(row.font_family),
    blocks: normalizeBlocks(row.blocks, normalizeTemplate(row.template)),
    discount_value: num(row.discount_value),
    prepayment_value: num(row.prepayment_value),
    delivery_amount: num(row.delivery_amount),
    vat_mode: normalizeVatMode(row.vat_mode),
    vat_rate: num(row.vat_rate, DEFAULT_VAT_RATE) || DEFAULT_VAT_RATE,
    vat_as_line: row.vat_as_line === true,
    management_type: normalizeFeeType(row.management_type),
    management_value: num(row.management_value),
    agency_fee_type: normalizeFeeType(row.agency_fee_type),
    agency_fee_value: num(row.agency_fee_value),
    total: num(row.total),
  };
}

export function normalizeItem(row: Record<string, unknown>): QuoteItem {
  const price = num(row.price);
  const cost_mode = normalizeCostMode(row.cost_mode);
  const cost_input = num(row.cost_input, cost_mode === "percent" ? 0 : num(row.cost));
  return {
    ...(row as unknown as QuoteItem),
    qty: num(row.qty, 1),
    price,
    cost_mode,
    cost_input,
    cost: resolveUnitCost(price, cost_mode, cost_input, row.cost),
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
    cost_mode: "amount",
    cost_input: 0,
    sort_order: sortOrder,
    entity_type: null,
    entity_id: null,
    ...init,
  };
}


