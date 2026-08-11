// Модель промо-КП (раздел «Документы → КП промо»).
// Browser-safe: используется формой, live-превью, PDF и XLSX — одна логика расчётов.
import { z } from "zod";
import { normalizeDocFontChoice, type DocFontChoice } from "@/lib/documents/doc-font";
import { normalizeIncludes, type QuoteItemInclude } from "@/lib/quotes-model";
import { checkVatConfig, computeVat, vatConfig, normalizeVatMode, DEFAULT_VAT_RATE, type VatMode } from "@/lib/documents/vat";
import { normalizeLogoLayout, type LogoLayout } from "@/lib/documents/logo-layout";
import { normalizeCompanyOverrides, type CompanyOverrides } from "@/lib/documents/company";

export { normalizeIncludes };
export type { QuoteItemInclude };

export const PROMO_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type PromoStatus = (typeof PROMO_STATUSES)[number];

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  accepted: "Согласовано",
  rejected: "Отклонено",
};

export const PROMO_DISCOUNT_TYPES = ["none", "percent", "fixed"] as const;
export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number];

export const PROMO_CURRENCIES = ["BYN", "USD", "EUR", "RUB"] as const;

export type PromoQuote = {
  id: string;
  doc_number: string | null;
  status: PromoStatus;
  project: string;
  client_name: string;
  period: string;
  venue: string;
  contact_name: string;
  contact_role: string;
  contact_phone: string;
  contact_email: string;
  logo_url: string | null;
  client_logo_url: string | null;
  logo_layout: LogoLayout;
  /** Шрифт документа: inherit — как в настройках. */
  font_family: DocFontChoice;
  company_id: string | null;
  company_overrides: CompanyOverrides;
  accent_color: string;
  show_qty: boolean;
  show_total_qty: boolean;
  show_notes: boolean;
  show_item_includes: boolean;
  show_section_subtotals: boolean;
  vat_enabled: boolean;
  vat_mode: VatMode;
  vat_rate: number;
  vat_as_line: boolean;
  commission_enabled: boolean;
  commission_rate: number;
  commission_label: string;
  management_enabled: boolean;
  management_amount: number;
  management_label: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  valid_until: string | null;
  sent_at: string | null;
  public_token: string;
  viewed_at: string | null;
  client_response: string;
  client_comment: string;
  responded_at: string | null;
  currency: string;
  footer_note: string;
  is_template: boolean;
  template_name: string;
  total: number;
  created_at: string;
  updated_at: string;
};

export type PromoItem = {
  id: string;
  quote_id: string;
  section: string;
  title: string;
  unit: string;
  qty: number;
  multiplier: number;
  price: number;
  cost: number;
  note: string;
  includes: QuoteItemInclude[];
  exclude_from_commission: boolean;
  /** Позиция входит в итог сметы (колонка «1 — включаем, 0 — не включаем»). */
  included: boolean;
  /** Строки с одинаковым ключом считаются одной связкой и включаются вместе. */
  group_key: string;
  /** Подпись первой единицы (например «чел»); пусто — колонка не показывается. */
  qty_unit: string;
  /** Подпись второй единицы (например «час»). */
  rate_unit: string;
  /** Справочная строка без цены (информация для клиента). */
  is_info: boolean;
  sort_order: number;
};



const num = (v: unknown, d = 0) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = "") => (v == null ? d : String(v));

export function normalizePromoQuote(row: Record<string, unknown>): PromoQuote {
  return {
    id: str(row.id),
    doc_number: row.doc_number == null ? null : String(row.doc_number),
    status: (PROMO_STATUSES as readonly string[]).includes(str(row.status))
      ? (str(row.status) as PromoStatus)
      : "draft",
    project: str(row.project),
    client_name: str(row.client_name),
    period: str(row.period),
    venue: str(row.venue),
    contact_name: str(row.contact_name),
    contact_role: str(row.contact_role),
    contact_phone: str(row.contact_phone),
    contact_email: str(row.contact_email),
    logo_url: row.logo_url ? String(row.logo_url) : null,
    client_logo_url: row.client_logo_url ? String(row.client_logo_url) : null,
    logo_layout: normalizeLogoLayout(row.logo_layout),
    font_family: normalizeDocFontChoice(row.font_family),
    company_id: row.company_id ? String(row.company_id) : null,
    company_overrides: normalizeCompanyOverrides(row.company_overrides),
    accent_color: str(row.accent_color, "#F5A623"),
    show_qty: row.show_qty !== false,
    show_total_qty: row.show_total_qty !== false,
    show_notes: row.show_notes !== false,
    show_item_includes: row.show_item_includes !== false,
    show_section_subtotals: row.show_section_subtotals !== false,
    vat_enabled: normalizeVatMode(row.vat_mode) !== "none",
    vat_mode: normalizeVatMode(row.vat_mode),
    vat_rate: num(row.vat_rate, DEFAULT_VAT_RATE) || DEFAULT_VAT_RATE,
    vat_as_line: row.vat_as_line === true,
    commission_enabled: row.commission_enabled !== false,
    commission_rate: num(row.commission_rate, 10),
    commission_label: str(row.commission_label, "Комиссия агентства"),
    management_enabled: row.management_enabled === true,
    management_amount: num(row.management_amount),
    management_label: str(row.management_label, "Менеджмент"),
    discount_type: (PROMO_DISCOUNT_TYPES as readonly string[]).includes(str(row.discount_type))
      ? (str(row.discount_type) as PromoDiscountType)
      : "none",
    discount_value: num(row.discount_value),
    valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    public_token: str(row.public_token),
    viewed_at: row.viewed_at ? String(row.viewed_at) : null,
    client_response: str(row.client_response),
    client_comment: str(row.client_comment),
    responded_at: row.responded_at ? String(row.responded_at) : null,
    currency: str(row.currency, "BYN"),
    footer_note: str(row.footer_note),
    is_template: row.is_template === true,
    template_name: str(row.template_name),
    total: num(row.total),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export function normalizePromoItem(row: Record<string, unknown>): PromoItem {
  return {
    id: str(row.id),
    quote_id: str(row.quote_id),
    section: str(row.section),
    title: str(row.title),
    unit: str(row.unit, "услуга"),
    qty: num(row.qty, 1),
    multiplier: num(row.rate_qty ?? row.multiplier, 1),
    price: num(row.price),
    cost: num(row.cost),
    note: str(row.note),
    includes: normalizeIncludes(row.includes),
    exclude_from_commission: row.exclude_from_commission === true,
    included: row.included !== false,
    group_key: str(row.group_key),
    qty_unit: str(row.qty_unit),
    rate_unit: str(row.rate_unit),
    is_info: row.is_info === true,
    sort_order: num(row.sort_order),
  };
}


// ==== Валидация ====

export const promoItemSchema = z.object({
  id: z.string().optional(),
  section: z.string().max(120).default(""),
  title: z.string().max(600).default(""),
  unit: z.string().max(60).default("услуга"),
  qty: z.number().min(0).max(100000).default(1),
  multiplier: z.number().min(0).max(100000).default(1),
  price: z.number().min(0).max(100000000).default(0),
  cost: z.number().min(0).max(100000000).default(0),
  note: z.string().max(2000).default(""),
  includes: z
    .array(z.object({ text: z.string().max(300).default(""), note: z.string().max(300).default("") }))
    .max(60)
    .default([]),
  exclude_from_commission: z.boolean().default(false),
  included: z.boolean().default(true),
  group_key: z.string().max(60).default(""),
  qty_unit: z.string().max(40).default(""),
  rate_unit: z.string().max(40).default(""),
  is_info: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(10000).default(0),
});


export const promoQuotePatchSchema = z
  .object({
    status: z.enum(PROMO_STATUSES),
    project: z.string().max(300),
    client_name: z.string().max(300),
    period: z.string().max(300),
    venue: z.string().max(300),
    contact_name: z.string().max(200),
    contact_role: z.string().max(200),
    contact_phone: z.string().max(60),
    contact_email: z.string().max(200),
    logo_url: z.string().max(1000).nullable(),
    client_logo_url: z.string().max(1000).nullable(),
    logo_layout: z.unknown().transform(normalizeLogoLayout),
    font_family: z.unknown().optional().transform((v) => normalizeDocFontChoice(v)),
    company_id: z.string().uuid().nullable(),
    company_overrides: z.unknown().transform(normalizeCompanyOverrides),
    accent_color: z.string().max(20),
    show_qty: z.boolean(),
    show_total_qty: z.boolean(),
    show_notes: z.boolean(),
    show_item_includes: z.boolean(),
    show_section_subtotals: z.boolean(),
    vat_enabled: z.boolean(),
    vat_mode: z.enum(["none", "add", "included"]),
    vat_rate: z.number().min(0).max(30),
    vat_as_line: z.boolean(),
    commission_enabled: z.boolean(),
    commission_rate: z.number().min(0).max(100),
    commission_label: z.string().max(120),
    management_enabled: z.boolean(),
    management_amount: z.number().min(0).max(100000000),
    management_label: z.string().max(120),
    discount_type: z.enum(PROMO_DISCOUNT_TYPES),
    discount_value: z.number().min(0).max(100000000),
    valid_until: z.string().max(20).nullable(),
    sent_at: z.string().max(40).nullable(),
    currency: z.string().max(10),
    footer_note: z.string().max(4000),
    is_template: z.boolean(),
    template_name: z.string().max(200),
  })
  .partial();

// Проверки готовности документа: критичные (blocking) и предупреждения.
export type PromoCheck = { level: "error" | "warn"; message: string; itemIndex?: number };

export function checkPromoQuote(q: PromoQuote, items: PromoItem[]): PromoCheck[] {
  const out: PromoCheck[] = [];
  if (!q.project.trim()) out.push({ level: "error", message: "Не заполнено поле «Проект»" });
  if (!q.client_name.trim()) out.push({ level: "error", message: "Не заполнено поле «Клиент»" });
  if (q.contact_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.contact_email.trim()))
    out.push({ level: "error", message: "Некорректный e-mail контактного лица" });
  if (!items.length) out.push({ level: "error", message: "Не добавлено ни одной позиции" });
  if (!q.valid_until) out.push({ level: "warn", message: "Не указан срок действия предложения" });
  items.forEach((it, i) => {
    const label = it.title.trim() || `строка ${i + 1}`;
    if (!it.title.trim()) out.push({ level: "error", message: `Строка ${i + 1}: пустое наименование`, itemIndex: i });
    if (it.price < 0 || it.qty < 0 || it.multiplier < 0)
      out.push({ level: "error", message: `${label}: отрицательное значение`, itemIndex: i });
    else if (lineTotal(it) === 0) out.push({ level: "warn", message: `${label}: нулевая сумма`, itemIndex: i });
    if (it.cost > 0 && it.cost * lineQty(it) > lineTotal(it))
      out.push({ level: "warn", message: `${label}: себестоимость выше цены`, itemIndex: i });
    if (!it.unit.trim()) out.push({ level: "warn", message: `${label}: не указана единица измерения`, itemIndex: i });
  });

  // Итоги и НДС: без этих данных превью покажет некорректные суммы.
  const totals = computePromoTotals(q, items);
  if (items.length && totals.itemsSum <= 0) out.push({ level: "error", message: "Сумма позиций равна нулю — проверьте цены и количества" });
  if (totals.discount >= totals.gross && totals.gross > 0) out.push({ level: "error", message: "Скидка равна или больше суммы предложения" });
  if (q.commission_enabled && num(q.commission_rate) <= 0) out.push({ level: "warn", message: "Комиссия включена, но ставка не задана" });
  if (q.management_enabled && num(q.management_amount) <= 0) out.push({ level: "warn", message: "Управление проектом включено, но сумма не задана" });
  for (const v of checkVatConfig(q)) out.push({ level: v.level, message: v.message });
  return out;
}

// Совместимость: плоский список текстов ошибок.
export function validatePromoQuote(q: PromoQuote, items: PromoItem[]): string[] {
  return checkPromoQuote(q, items)
    .filter((c) => c.level === "error")
    .map((c) => c.message);
}

// ==== Расчёты ====

export function lineQty(it: PromoItem): number {
  return num(it.qty, 0) * num(it.multiplier, 1);
}

const nfQty = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Подпись первой единицы позиции: «Ед. 1» либо основная «Ед. изм.» («чел»). */
export function qtyUnitLabel(it: PromoItem): string {
  return (it.qty_unit || "").trim() || (it.unit || "").trim();
}

/** Подпись второй единицы («час», «день», «смена») — пусто, если не задана. */
export function rateUnitLabel(it: PromoItem): string {
  return (it.rate_unit || "").trim();
}

/** «2 чел» — количество с единицей (единица опциональна). */
export function formatQty(it: PromoItem): string {
  const u = qtyUnitLabel(it);
  return u ? `${nfQty(num(it.qty, 0))} ${u}` : nfQty(num(it.qty, 0));
}

/** «8 час» — общее количество (кол-во × множитель) со второй единицей, если она есть. */
export function formatTotalQty(it: PromoItem): string {
  const u = rateUnitLabel(it);
  return u ? `${nfQty(lineQty(it))} ${u}` : nfQty(lineQty(it));
}

/** Есть ли в документе хотя бы одна позиция со второй единицей («час», «смена»). */
export function hasSecondUnit(items: PromoItem[]): boolean {
  return items.some((it) => rateUnitLabel(it) !== "");
}

/** Единственная вторая единица на весь документ («час») либо «», если их несколько. */
export function soleRateUnit(items: PromoItem[]): string {
  const set = new Set(items.map(rateUnitLabel).filter(Boolean));
  return set.size === 1 ? [...set][0]! : "";
}

/** Число без единицы — для отдельных колонок «Кол-во» / «Кол-во 2». */
export const formatNumber = (n: number) => nfQty(num(n, 0));


/** «2 чел × 4 час × 25 = 200» — человекочитаемая расшифровка строки. */
export function explainLine(it: PromoItem): string {
  const parts = [formatQty(it)];
  const ru = rateUnitLabel(it);
  const mult = num(it.multiplier, 1);
  if (ru || mult !== 1) parts.push(ru ? `${nfQty(mult)} ${ru}` : nfQty(mult));
  parts.push(nfQty(num(it.price, 0)));
  return `${parts.join(" × ")} = ${nfQty(lineTotal(it))}`;
}


export function lineTotal(it: PromoItem): number {
  return round2(lineQty(it) * num(it.price, 0));
}

export function lineCost(it: PromoItem): number {
  return round2(lineQty(it) * num(it.cost, 0));
}

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Позиция участвует в расчёте итога (не «опция» и не справочная строка). */
export function isCounted(it: PromoItem): boolean {
  return it.included !== false && it.is_info !== true;
}

/** Сумма опциональных позиций — показывается отдельно, в итог не входит. */
export function optionsSum(items: PromoItem[]): number {
  return round2(items.filter((it) => !it.is_info && it.included === false).reduce((s, it) => s + lineTotal(it), 0));
}

export type PromoTotals = {
  itemsSum: number;
  optionsSum: number;
  commissionBase: number;
  commission: number;
  management: number;
  gross: number;
  discount: number;
  subtotal: number;
  net: number;
  vat: number;
  vatRate: number;
  vatMode: VatMode;
  vatEnabled: boolean;
  totalWithVat: number;
  costSum: number;
  margin: number;
  marginPct: number;
};

export function computePromoTotals(q: PromoQuote, items: PromoItem[]): PromoTotals {
  const counted = items.filter(isCounted);
  const itemsSum = round2(counted.reduce((s, it) => s + lineTotal(it), 0));
  const commissionBase = round2(
    counted.filter((it) => !it.exclude_from_commission).reduce((s, it) => s + lineTotal(it), 0),
  );
  const management = q.management_enabled ? round2(q.management_amount) : 0;
  const commission = q.commission_enabled ? round2((commissionBase * q.commission_rate) / 100) : 0;
  const gross = round2(itemsSum + management + commission);

  const discount =
    q.discount_type === "percent"
      ? round2((gross * Math.min(num(q.discount_value), 100)) / 100)
      : q.discount_type === "fixed"
        ? round2(Math.min(num(q.discount_value), gross))
        : 0;
  const subtotal = round2(gross - discount);
  const v = computeVat(subtotal, vatConfig(q));
  const vat = v.vat;
  const costSum = round2(counted.reduce((s, it) => s + lineCost(it), 0));
  const margin = round2(v.net - costSum);
  return {
    itemsSum,
    optionsSum: optionsSum(items),
    commissionBase,

    commission,
    management,
    gross,
    discount,
    subtotal,
    net: v.net,
    vat,
    vatRate: v.rate,
    vatMode: v.mode,
    vatEnabled: v.enabled,
    totalWithVat: v.gross,
    costSum,
    margin,
    marginPct: v.net > 0 ? round2((margin / v.net) * 100) : 0,
  };
}


// ==== Хелперы редактора ====

export const PROMO_SECTION_SUGGESTIONS = [
  "Организация",
  "Персонал",
  "Логистика",
  "Активности",
  "Техническое оснащение",
  "Шоу программа",
  "Призовой фонд",
  "Отчётность",
  "Прочее",
];

export function newPromoItem(section = "", patch: Partial<PromoItem> = {}): PromoItem {
  return {
    id: crypto.randomUUID(),
    quote_id: "",
    section,
    title: "",
    unit: "услуга",
    qty: 1,
    multiplier: 1,
    price: 0,
    cost: 0,
    note: "",
    includes: [],
    exclude_from_commission: false,
    included: true,
    group_key: "",
    qty_unit: "",
    rate_unit: "",
    is_info: false,
    sort_order: 0,
    ...patch,

  };
}

// Разбор вставки из Excel/таблицы: наименование [tab] кол-во [tab] цена [tab] примечание
export function parsePastedPromoRows(text: string, section = ""): PromoItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: PromoItem[] = [];
  for (const line of lines) {
    const cells = line.split(/\t|;/).map((c) => c.trim());
    if (!cells.length || !cells[0]) continue;
    const nums = cells.slice(1).map((c) => Number(c.replace(/\s/g, "").replace(",", ".")));
    const qty = Number.isFinite(nums[0]) ? nums[0] : 1;
    const price = Number.isFinite(nums[1]) ? nums[1] : 0;
    const note = cells.slice(1).find((c) => c && !Number.isFinite(Number(c.replace(",", ".")))) ?? "";
    out.push(newPromoItem(section, { title: cells[0], qty, price, note }));
  }
  return out;
}

export function promoValidityState(q: PromoQuote): "none" | "active" | "expired" {
  if (!q.valid_until) return "none";
  const d = new Date(`${q.valid_until}T23:59:59`);
  if (Number.isNaN(d.getTime())) return "none";
  return d.getTime() < Date.now() ? "expired" : "active";
}


// Группировка позиций по секциям с сохранением порядка.
export type PromoSection = { name: string; items: PromoItem[] };

export function groupBySection(items: PromoItem[]): PromoSection[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  // Все позиции одного раздела собираются в один блок, даже если в списке они
  // идут не подряд (например, строка добавлена в конец списка).
  const out: PromoSection[] = [];
  const byName = new Map<string, PromoSection>();
  for (const it of sorted) {
    const name = (it.section ?? "").trim();
    const found = byName.get(name);
    if (found) found.items.push(it);
    else {
      const sec: PromoSection = { name, items: [it] };
      byName.set(name, sec);
      out.push(sec);
    }
  }
  return out;
}

/** Позиция «не тронута»: только что добавлена и ещё ничего не заполнено. */
export function isPristinePromoItem(it: PromoItem): boolean {
  return (
    !(it.title ?? "").trim() &&
    !(it.note ?? "").trim() &&
    num(it.price, 0) === 0 &&
    num(it.cost, 0) === 0 &&
    !it.includes.length
  );
}


export const PROMO_NO_SECTION = "Без раздела";

export const reindexPromo = (items: PromoItem[]): PromoItem[] =>
  items.map((it, i) => ({ ...it, sort_order: i }));

/** Вставить позиции сразу после последней строки указанного раздела. */
export function insertPromoItems(items: PromoItem[], section: string, created: PromoItem[]): PromoItem[] {
  if (!created.length) return items;
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const key = (section ?? "").trim();
  const lastIdx = sorted.map((it) => (it.section ?? "").trim()).lastIndexOf(key);
  const out =
    lastIdx >= 0
      ? [...sorted.slice(0, lastIdx + 1), ...created, ...sorted.slice(lastIdx + 1)]
      : [...sorted, ...created];
  return reindexPromo(out);
}

const secKey = (it: PromoItem) => (it.section ?? "").trim();

/** Список разделов в порядке появления. */
export function listPromoSections(items: PromoItem[]): string[] {
  const out: string[] = [];
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const key = secKey(it);
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** Пересобрать позиции в заданном порядке разделов. */
export function orderPromoBySections(items: PromoItem[], order: string[]): PromoItem[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const out: PromoItem[] = [];
  for (const section of order) out.push(...sorted.filter((it) => secKey(it) === section));
  for (const it of sorted) if (!out.includes(it)) out.push(it);
  return reindexPromo(out);
}

export function renamePromoSection(items: PromoItem[], from: string, to: string): PromoItem[] {
  return items.map((it) => (secKey(it) === from ? { ...it, section: to } : it));
}

export function movePromoSection(items: PromoItem[], section: string, dir: -1 | 1): PromoItem[] {
  const order = listPromoSections(items);
  const i = order.indexOf(section);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return items;
  const next = [...order];
  next[i] = order[j]!;
  next[j] = order[i]!;
  return orderPromoBySections(items, next);
}

/** Удалить раздел: вместе с позициями или с переносом их в «без раздела». */
export function removePromoSection(items: PromoItem[], section: string, mode: "items" | "keep"): PromoItem[] {
  const next =
    mode === "items"
      ? items.filter((it) => secKey(it) !== section)
      : items.map((it) => (secKey(it) === section ? { ...it, section: "" } : it));
  return reindexPromo([...next].sort((a, b) => a.sort_order - b.sort_order));
}

export function duplicatePromoSection(items: PromoItem[], section: string): PromoItem[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const copies = sorted
    .filter((it) => secKey(it) === section)
    .map((it) => ({
      ...it,
      id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}`,
      section: `${section || PROMO_NO_SECTION} (копия)`,
      includes: it.includes.map((x) => ({ ...x })),
    }));
  return reindexPromo([...sorted, ...copies]);
}

/** Перенести позицию в другой раздел (в конец этого раздела). */
export function movePromoItemToSection(items: PromoItem[], id: string, section: string): PromoItem[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const item = sorted.find((it) => it.id === id);
  if (!item) return items;
  const rest = sorted.filter((it) => it.id !== id);
  const moved = { ...item, section };
  const lastIdx = rest.map((it) => secKey(it)).lastIndexOf(section.trim());
  const out = lastIdx >= 0 ? [...rest.slice(0, lastIdx + 1), moved, ...rest.slice(lastIdx + 1)] : [...rest, moved];
  return reindexPromo(out);
}

export function promoNumberDisplay(q: PromoQuote): string {
  const n = (q.doc_number ?? "").trim();
  return n ? n.replaceAll("/", ".") : q.id.slice(0, 8).toUpperCase();
}

export function promoFileName(q: PromoQuote, ext: "pdf" | "xlsx"): string {
  const base = `КП ${promoNumberDisplay(q)}${q.client_name ? ` — ${q.client_name}` : ""}`;
  return `${base.replace(/[\\/:*?"<>|]/g, "-")}.${ext}`;
}

export function formatMoney(n: number, currency = "BYN"): string {
  return `${new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  )}${currency ? ` ${currency}` : ""}`;
}

// ==== Пресеты ====

export type PromoPreset = { key: string; label: string; description: string; items: Array<Partial<PromoItem>> };

export const PROMO_PRESETS: PromoPreset[] = [
  {
    key: "ad_game",
    label: "Рекламная игра",
    description: "Организация, регистрация в МАРТ, призовой фонд, отчётность",
    items: [
      { section: "Организация", title: "Подготовка правил рекламной игры в соответствии с законодательством", unit: "услуга", price: 2400, note: "Разработка правил юристом по механике Клиента" },
      { section: "Организация", title: "Регистрация игры в МАРТ (государственная пошлина)", unit: "пошлина, 5 базовых величин", price: 225, note: "Зафиксированные цифры на текущий год" },
      { section: "Организация", title: "Подготовка пакета документов и регистрация рекламной игры", unit: "услуга", price: 2250, note: "" },
      { section: "Организация", title: "Публикация правил проведения рекламной игры в СМИ", unit: "услуга", price: 3000, note: "Сумма ориентировочная" },
      { section: "Организация", title: "Организация горячей линии, модерация чеков, обратная связь", unit: "услуга, 2 месяца", price: 5000, note: "" },
      { section: "Призовой фонд", title: "Главный приз", unit: "услуга", price: 0, note: "", exclude_from_commission: true },
      { section: "Призовой фонд", title: "Подоходный налог за победителя", unit: "услуга", price: 0, note: "13% от стоимости приза", exclude_from_commission: true },
      { section: "Отчётность", title: "Подготовка и подача отчёта в МАРТ", unit: "услуга", price: 900, note: "" },
    ],
  },
  {
    key: "event",
    label: "Мероприятие под ключ",
    description: "Персонал, логистика, активности, техническое оснащение, шоу",
    items: [
      { section: "Персонал", title: "Ведущий", unit: "услуга", price: 1600, note: "Работа на протяжении мероприятия" },
      { section: "Персонал", title: "Фотограф", unit: "услуга", price: 1310, note: "" },
      { section: "Логистика", title: "Транспортные расходы", unit: "услуга", price: 200, note: "Доставка персонала" },
      { section: "Активности", title: "Фотозона", unit: "услуга", price: 1550, note: "Конструктив, баннер, монтаж и доставка включены" },
      { section: "Техническое оснащение", title: "Звуковое оборудование", unit: "услуга", price: 600, note: "" },
      { section: "Техническое оснащение", title: "Световое оборудование", unit: "услуга", price: 450, note: "" },
      { section: "Техническое оснащение", title: "Технический персонал", unit: "услуга", price: 420, note: "Монтаж/демонтаж и дежурство" },
      { section: "Шоу программа", title: "DJ (сопровождение мероприятия)", unit: "услуга", price: 500, note: "" },
    ],
  },
  {
    key: "blank",
    label: "Пустой документ",
    description: "Одна секция и одна строка",
    items: [{ section: "Организация", title: "", unit: "услуга", price: 0 }],
  },
];
