// Модель раздела «Документы и шаблоны»: блоки документа, типы, категории,
// нормализация строк БД. Модуль клиент-безопасный (используется и в PDF).
import { normalizeDocFont, type DocFont } from "@/lib/documents/doc-font";
import {
  DEFAULT_LOGO_LAYOUT,
  normalizeLogoLayout,
  type LogoLayout,
} from "@/lib/documents/logo-layout";

export const PW_CATEGORIES = [
  "letters",
  "orders",
  "protocols",
  "attorney",
  "certificates",
  "notices",
  "internal",
  "contracts",
  "hr",
  "finance",
  "custom",
] as const;
export type PwCategory = (typeof PW_CATEGORIES)[number];

export const PW_CATEGORY_LABELS: Record<PwCategory, string> = {
  letters: "Письма",
  orders: "Приказы",
  protocols: "Протоколы и заявления",
  attorney: "Доверенности",
  certificates: "Справки",
  notices: "Уведомления",
  internal: "Внутренние документы",
  contracts: "Договоры",
  hr: "Кадровые документы",
  finance: "Счета и акты",
  custom: "Пользовательские",
};


export const PW_DOC_TYPES = [
  "letter",
  "order",
  "protocol",
  "statement",

  "attorney",
  "certificate",
  "notice",
  "memo",
  "contract",
  "workact",
  "loan",
  "invoice",
  "act",
  "payroll",
  "staffing",
  "timesheet",
  "custom",
] as const;
export type PwDocType = (typeof PW_DOC_TYPES)[number];

export const PW_DOC_TYPE_LABELS: Record<PwDocType, string> = {
  letter: "Письмо",
  order: "Приказ",
  attorney: "Доверенность",
  certificate: "Справка",
  notice: "Уведомление",
  memo: "Служебная записка",
  contract: "Договор",
  workact: "Договор подряда + акт",
  loan: "Договор займа",
  invoice: "Счёт",
  act: "Акт",
  payroll: "Зарплатная ведомость",
  staffing: "Штатное расписание",
  timesheet: "Табель учёта рабочего времени",
  custom: "Произвольный документ",
};

/** Категория по умолчанию для типа документа. */
export const PW_TYPE_CATEGORY: Record<PwDocType, PwCategory> = {
  letter: "letters",
  order: "orders",
  attorney: "attorney",
  certificate: "certificates",
  notice: "notices",
  memo: "internal",
  contract: "contracts",
  workact: "contracts",
  loan: "contracts",
  invoice: "finance",
  act: "finance",
  payroll: "hr",
  staffing: "hr",
  timesheet: "hr",
  custom: "custom",
};

export const PW_STATUSES = ["draft", "ready", "archived"] as const;
export type PwStatus = (typeof PW_STATUSES)[number];
export const PW_STATUS_LABELS: Record<PwStatus, string> = {
  draft: "Черновик",
  ready: "Готов",
  archived: "Архив",
};

export const PW_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "list",
  "table",
  "recipient",
  "signature",
  "spacer",
  "pagebreak",
  "note",
  "lineitems",
  "parties",
] as const;
export type PwBlockType = (typeof PW_BLOCK_TYPES)[number];

export const PW_BLOCK_LABELS: Record<PwBlockType, string> = {
  heading: "Заголовок",
  paragraph: "Абзац",
  list: "Список",
  table: "Таблица",
  recipient: "Адресат",
  signature: "Подпись и печать",
  spacer: "Отступ",
  pagebreak: "Разрыв страницы",
  note: "Примечание",
  lineitems: "Позиции с суммами",
  parties: "Реквизиты сторон",
};

export type PwAlign = "left" | "center" | "right" | "justify";

export type PwBlock = {
  id: string;
  type: PwBlockType;
  /** Текст (heading / paragraph / note). */
  text: string;
  align: PwAlign;
  /** Список: пункты, нумерованный ли. */
  items: string[];
  ordered: boolean;
  /** Таблица. */
  header: string[];
  rows: string[][];
  /** Подпись. */
  signerName: string;
  signerTitle: string;
  withStamp: boolean;
  withSignature: boolean;
  /** Отступ в пунктах. */
  size: number;
  /** Абзац с отступом первой строки. */
  indent: boolean;
  /** Позиции с суммами (lineitems). */
  lines: PwLine[];
  currency: string;
  vatPct: number;
  totalWords: boolean;
  /** Реквизиты сторон (parties). */
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
};

/** Строка блока «Позиции с суммами». */
export type PwLine = {
  name: string;
  qty: number;
  unit: string;
  price: number;
};

export type PwVariable = {
  key: string;
  label: string;
  /** Источник значения: авто из профиля компании / документа, либо ручной ввод. */
  source: "auto" | "manual";
  defaultValue: string;
};

/* --------------------------- Схема полей документа --------------------------- */

export const PW_FIELD_TYPES = ["text", "multiline", "date", "number", "money"] as const;
export type PwFieldType = (typeof PW_FIELD_TYPES)[number];

export const PW_FIELD_TYPE_LABELS: Record<PwFieldType, string> = {
  text: "Строка",
  multiline: "Многострочный текст",
  date: "Дата",
  number: "Число",
  money: "Сумма",
};

/** Объявленное поле шаблона: контракт «что нужно заполнить». */
export type PwFieldSpec = {
  key: string;
  label: string;
  type: PwFieldType;
  required: boolean;
  defaultValue: string;
  /** auto — подставляется из компании/метаданных, manual — вводится вручную. */
  source: "auto" | "manual";
  hint: string;
};

export function normalizeFieldSpec(raw: unknown): PwFieldSpec {
  const r = (raw ?? {}) as Record<string, unknown>;
  const key = str(r.key).trim();
  return {
    key,
    label: str(r.label) || key,
    type: oneOf(PW_FIELD_TYPES, r.type, "text"),
    required: r.required === true,
    defaultValue: str(r.defaultValue),
    source: r.source === "auto" ? "auto" : "manual",
    hint: str(r.hint),
  };
}

export function normalizeFieldSchema(raw: unknown): PwFieldSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeFieldSpec).filter((f) => f.key);
}

export type PwTemplate = {
  id: string;
  company_profile_id: string | null;
  category: PwCategory;
  doc_type: PwDocType;
  name: string;
  description: string;
  blocks: PwBlock[];
  variables: PwVariable[];
  variables_schema: PwFieldSpec[];
  revision: number;
  background_url: string | null;
  is_archived: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type PwDocument = {
  id: string;
  template_id: string | null;
  template_revision: number | null;
  company_profile_id: string | null;
  brand_kit_id: string | null;
  doc_type: PwDocType;
  title: string;
  doc_number: string;
  doc_date: string;
  blocks: PwBlock[];
  values: Record<string, string>;
  status: PwStatus;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PwDocumentListRow = PwDocument & {
  company_name: string | null;
  author_name: string | null;
};

/** Фирменный набор компании: несколько на компанию, один основной. */
export type PwBrandKit = {
  id: string;
  company_profile_id: string;
  name: string;
  is_default: boolean;
  settings: PwBlank;
  created_at: string;
  updated_at: string;
};

/* ------------------------- Настройки фирменного бланка ------------------------- */

export type PwBlank = {
  /** Расположение шапки. */
  headerLayout: "logo-left" | "logo-center" | "logo-right" | "none";
  /** Показывать реквизиты в шапке. */
  headerRequisites: boolean;
  /** Размеры логотипа в шапке (тот же движок, что в КП). */
  logoLayout: LogoLayout;
  /** Показывать логотип клиента (если он задан переменной `client_logo`). */
  clientLogo: boolean;
  /** Полоса фирменного цвета сверху. */
  accentBar: boolean;
  /** Футер с контактами. */
  footer: boolean;
  footerText: string;
  accentColor: string;
  font: DocFont;
  fontSizePt: number;
  marginXMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  /** Логотип-подложка (URL) на первой странице. */
  backgroundUrl: string | null;
  backgroundOpacity: number;
  /** Стараться уместить документ на один лист A4 (лёгкое сжатие кегля и полей). */
  fitOnePage: boolean;
};

export const DEFAULT_BLANK: PwBlank = {
  headerLayout: "logo-left",
  headerRequisites: true,
  logoLayout: DEFAULT_LOGO_LAYOUT,
  clientLogo: true,
  accentBar: true,
  footer: true,
  footerText: "",
  accentColor: "#FF7500",
  font: "brand",
  fontSizePt: 11,
  marginXMm: 20,
  marginTopMm: 18,
  marginBottomMm: 18,
  backgroundUrl: null,
  backgroundOpacity: 0.12,
  fitOnePage: true,
};

/* ------------------------------- Нормализация ------------------------------- */

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  (list as readonly string[]).includes(String(v)) ? (v as T) : fallback;

let seq = 0;
export function pwId(prefix = "b"): string {
  seq += 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${rnd}`;
}

export function normalizeLine(raw: unknown): PwLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    name: str(r.name),
    qty: num(r.qty),
    unit: str(r.unit) || "шт.",
    price: num(r.price),
  };
}

export function normalizeBlock(raw: unknown): PwBlock {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = Array.isArray(r.items) ? r.items.map((i) => str(i)) : [];
  const header = Array.isArray(r.header) ? r.header.map((i) => str(i)) : [];
  const rows = Array.isArray(r.rows)
    ? (r.rows as unknown[]).map((row) => (Array.isArray(row) ? row.map((c) => str(c)) : []))
    : [];
  const vat = Number(r.vatPct);
  return {
    id: str(r.id) || pwId(),
    type: oneOf(PW_BLOCK_TYPES, r.type, "paragraph"),
    text: str(r.text),
    align: oneOf(["left", "center", "right", "justify"] as const, r.align, "left"),
    items,
    ordered: r.ordered === true,
    header,
    rows,
    signerName: str(r.signerName),
    signerTitle: str(r.signerTitle),
    withStamp: r.withStamp === true,
    withSignature: r.withSignature !== false,
    size: Number(r.size) > 0 ? Number(r.size) : 12,
    indent: r.indent === true,
    lines: Array.isArray(r.lines) ? r.lines.map(normalizeLine) : [],
    currency: str(r.currency) || "BYN",
    vatPct: Number.isFinite(vat) && vat >= 0 && vat <= 100 ? vat : 0,
    totalWords: r.totalWords === true,
    leftTitle: str(r.leftTitle),
    leftText: str(r.leftText),
    rightTitle: str(r.rightTitle),
    rightText: str(r.rightText),
  };
}

export function normalizeBlocks(raw: unknown): PwBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock);
}

export function normalizeVariable(raw: unknown): PwVariable {
  const r = (raw ?? {}) as Record<string, unknown>;
  const key = str(r.key).trim();
  return {
    key,
    label: str(r.label) || key,
    source: r.source === "auto" ? "auto" : "manual",
    defaultValue: str(r.defaultValue),
  };
}

export function normalizeVariables(raw: unknown): PwVariable[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeVariable).filter((v) => v.key);
}

export function normalizeBlank(raw: unknown): PwBlank {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : d;
  };
  return {
    headerLayout: oneOf(
      ["logo-left", "logo-center", "logo-right", "none"] as const,
      r.headerLayout,
      DEFAULT_BLANK.headerLayout,
    ),
    headerRequisites: r.headerRequisites !== false,
    logoLayout: normalizeLogoLayout(r.logoLayout),
    clientLogo: r.clientLogo !== false,
    accentBar: r.accentBar !== false,
    footer: r.footer !== false,
    footerText: str(r.footerText),
    accentColor: /^#[0-9a-f]{6}$/i.test(str(r.accentColor)) ? str(r.accentColor) : DEFAULT_BLANK.accentColor,
    font: normalizeDocFont(r.font, "brand"),
    fontSizePt: num(r.fontSizePt, DEFAULT_BLANK.fontSizePt, 8, 16),
    marginXMm: num(r.marginXMm, DEFAULT_BLANK.marginXMm, 8, 40),
    marginTopMm: num(r.marginTopMm, DEFAULT_BLANK.marginTopMm, 8, 60),
    marginBottomMm: num(r.marginBottomMm, DEFAULT_BLANK.marginBottomMm, 8, 40),
    backgroundUrl: str(r.backgroundUrl) || null,
    backgroundOpacity: num(r.backgroundOpacity, DEFAULT_BLANK.backgroundOpacity, 0.02, 1),
    fitOnePage: r.fitOnePage !== false,
  };
}

export function normalizeBrandKit(row: Record<string, unknown>): PwBrandKit {
  return {
    id: str(row.id),
    company_profile_id: str(row.company_profile_id),
    name: str(row.name, "Основной бланк") || "Основной бланк",
    is_default: row.is_default === true,
    settings: normalizeBlank(row.settings),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export function normalizeTemplate(row: Record<string, unknown>): PwTemplate {
  return {
    id: str(row.id),
    company_profile_id: str(row.company_profile_id) || null,
    category: oneOf(PW_CATEGORIES, row.category, "custom"),
    doc_type: oneOf(PW_DOC_TYPES, row.doc_type, "custom"),
    name: str(row.name, "Без названия") || "Без названия",
    description: str(row.description),
    blocks: normalizeBlocks(row.blocks),
    variables: normalizeVariables(row.variables),
    variables_schema: normalizeFieldSchema(row.variables_schema),
    revision: Number(row.revision) > 0 ? Number(row.revision) : 1,
    background_url: str(row.background_url) || null,
    is_archived: row.is_archived === true,
    is_favorite: row.is_favorite === true,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export function normalizeDocument(row: Record<string, unknown>): PwDocument {
  const values = (row.values ?? {}) as Record<string, unknown>;
  return {
    id: str(row.id),
    template_id: str(row.template_id) || null,
    template_revision: Number(row.template_revision) > 0 ? Number(row.template_revision) : null,
    company_profile_id: str(row.company_profile_id) || null,
    brand_kit_id: str(row.brand_kit_id) || null,
    doc_type: oneOf(PW_DOC_TYPES, row.doc_type, "custom"),
    title: str(row.title, "Без названия") || "Без названия",
    doc_number: str(row.doc_number),
    doc_date: str(row.doc_date) || new Date().toISOString().slice(0, 10),
    blocks: normalizeBlocks(row.blocks),
    values: Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")]),
    ),
    status: oneOf(PW_STATUSES, row.status, "draft"),
    author_id: str(row.author_id) || null,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

/** Пустой блок нужного типа. */
export function emptyBlock(type: PwBlockType): PwBlock {
  const base = normalizeBlock({ type });
  if (type === "heading") return { ...base, text: "Заголовок", align: "center" };
  if (type === "paragraph") return { ...base, text: "Текст абзаца", align: "justify", indent: true };
  if (type === "list") return { ...base, items: ["Первый пункт", "Второй пункт"] };
  if (type === "table")
    return { ...base, header: ["№", "Наименование", "Значение"], rows: [["1", "", ""]] };
  if (type === "recipient")
    return { ...base, align: "right", text: "Директору\n{{Получатель}}" };
  if (type === "signature")
    return { ...base, signerName: "{{ФИО директора}}", signerTitle: "Директор", withStamp: true };
  if (type === "note") return { ...base, text: "Примечание" };
  if (type === "lineitems")
    return {
      ...base,
      lines: [{ name: "Услуга", qty: 1, unit: "усл.", price: 0 }],
      currency: "BYN",
      totalWords: true,
    };
  if (type === "parties")
    return {
      ...base,
      leftTitle: "Исполнитель",
      leftText: "{{Компания}}\nУНП {{УНП}}\n{{Адрес}}",
      rightTitle: "Заказчик",
      rightText: "{{Заказчик}}\nУНП {{УНП заказчика}}\n{{Адрес заказчика}}",
    };
  return base;
}

/** Имя файла для экспорта. */
export function pwFileName(title: string, ext: "pdf" | "docx"): string {
  const clean = (title || "Документ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${clean || "Документ"}.${ext}`;
}
