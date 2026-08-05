// Модель промо-КП (раздел «Документы → КП промо»).
// Browser-safe: используется формой, live-превью, PDF и XLSX — одна логика расчётов.
import { z } from "zod";

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
  accent_color: string;
  show_qty: boolean;
  show_total_qty: boolean;
  show_notes: boolean;
  vat_enabled: boolean;
  vat_rate: number;
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
  exclude_from_commission: boolean;
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
    accent_color: str(row.accent_color, "#F5A623"),
    show_qty: row.show_qty !== false,
    show_total_qty: row.show_total_qty !== false,
    show_notes: row.show_notes !== false,
    vat_enabled: row.vat_enabled !== false,
    vat_rate: num(row.vat_rate, 20),
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
    multiplier: num(row.multiplier, 1),
    price: num(row.price),
    cost: num(row.cost),
    note: str(row.note),
    exclude_from_commission: row.exclude_from_commission === true,
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
  exclude_from_commission: z.boolean().default(false),
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
    accent_color: z.string().max(20),
    show_qty: z.boolean(),
    show_total_qty: z.boolean(),
    show_notes: z.boolean(),
    vat_enabled: z.boolean(),
    vat_rate: z.number().min(0).max(100),
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
  });
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

export function lineTotal(it: PromoItem): number {
  return round2(lineQty(it) * num(it.price, 0));
}

export function lineCost(it: PromoItem): number {
  return round2(lineQty(it) * num(it.cost, 0));
}

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export type PromoTotals = {
  itemsSum: number;
  commissionBase: number;
  commission: number;
  management: number;
  gross: number;
  discount: number;
  subtotal: number;
  vat: number;
  totalWithVat: number;
  costSum: number;
  margin: number;
  marginPct: number;
};

export function computePromoTotals(q: PromoQuote, items: PromoItem[]): PromoTotals {
  const itemsSum = round2(items.reduce((s, it) => s + lineTotal(it), 0));
  const commissionBase = round2(
    items.filter((it) => !it.exclude_from_commission).reduce((s, it) => s + lineTotal(it), 0),
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
  const vat = q.vat_enabled ? round2((subtotal * q.vat_rate) / 100) : 0;
  const costSum = round2(items.reduce((s, it) => s + lineCost(it), 0));
  const margin = round2(subtotal - costSum);
  return {
    itemsSum,
    commissionBase,
    commission,
    management,
    gross,
    discount,
    subtotal,
    vat,
    totalWithVat: round2(subtotal + vat),
    costSum,
    margin,
    marginPct: subtotal > 0 ? round2((margin / subtotal) * 100) : 0,
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
    exclude_from_commission: false,
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
  const out: PromoSection[] = [];
  for (const it of sorted) {
    const name = it.section.trim();
    const last = out[out.length - 1];
    if (last && last.name === name) last.items.push(it);
    else out.push({ name, items: [it] });
  }
  return out;
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
