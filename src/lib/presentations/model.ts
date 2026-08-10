// Модель презентаций: типы слайдов, нормализация содержимого, дефолты.
// Файл клиент-безопасный — используется и в редакторе, и в server fns, и в PDF.

export type SlideType = "title" | "product" | "text" | "section" | "contacts";

export type PresentationStatus = "draft" | "ready" | "archived";

export type PresentationTemplate = "light" | "dark" | "accent";

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  title: "Титульный",
  product: "Товар / позиция",
  text: "Текстовый",
  section: "Разделитель",
  contacts: "Контакты",
};

export const STATUS_LABELS: Record<PresentationStatus, string> = {
  draft: "Черновик",
  ready: "Готова",
  archived: "Архив",
};

export const TEMPLATE_LABELS: Record<PresentationTemplate, string> = {
  light: "Светлый",
  dark: "Тёмный",
  accent: "Акцентный",
};

export type SlideSpec = { label: string; value: string };

/** Ручное переопределение стороны фотоблока. */
export type SlideImageLayout = "auto" | "left" | "right" | "top" | "none";

export const IMAGE_LAYOUT_LABELS: Record<SlideImageLayout, string> = {
  auto: "Авто",
  left: "Фото слева",
  right: "Фото справа",
  top: "Фото сверху",
  none: "Только текст",
};

export type SlideContent = {
  /** Основной текст (описание позиции или текст слайда). */
  description: string;
  /** Блок «Что входит». */
  includes: string[];
  /** Характеристики. */
  specs: SlideSpec[];
  /** Цена позиции (BYN) и единица. */
  price: number | null;
  priceUnit: string;
  qty: number | null;
  sku: string;
  /** Фотографии слайда (до 5), первая — главная. */
  images: string[];
  /** Раскладка фотоблока. */
  imageLayout: SlideImageLayout;
  /** Тумблеры видимости блоков. */
  showDescription: boolean;
  showIncludes: boolean;
  showSpecs: boolean;
  showPrice: boolean;
  showImage: boolean;
};


export type PresentationSlide = {
  id: string;
  position: number;
  type: SlideType;
  title: string;
  subtitle: string;
  image_url: string | null;
  content: SlideContent;
  entity_type: string | null;
  entity_id: string | null;
  quote_item_id: string | null;
  is_visible: boolean;
};

export type Presentation = {
  id: string;
  title: string;
  company_id: string | null;
  quote_id: string | null;
  status: PresentationStatus;
  template: PresentationTemplate;
  created_at: string;
  updated_at: string;
};

export type PresentationListRow = Presentation & {
  company_name: string | null;
  quote_number: string | null;
  slides_count: number;
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const MAX_IMAGES = 5;

export const EMPTY_CONTENT: SlideContent = {
  description: "",
  includes: [],
  specs: [],
  price: null,
  priceUnit: "шт.",
  qty: null,
  sku: "",
  images: [],
  imageLayout: "auto",
  showDescription: true,
  showIncludes: true,
  showSpecs: true,
  showPrice: true,
  showImage: true,
};

const IMAGE_LAYOUTS: SlideImageLayout[] = ["auto", "left", "right", "top", "none"];

export function normalizeContent(raw: unknown): SlideContent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, d = true) => (typeof v === "boolean" ? v : d);
  const images = Array.isArray(r.images)
    ? Array.from(new Set(r.images.map((i) => str(i).trim()).filter(Boolean))).slice(0, MAX_IMAGES)
    : [];
  return {
    description: str(r.description),
    includes: Array.isArray(r.includes) ? r.includes.map((i) => str(i)).filter(Boolean) : [],
    specs: Array.isArray(r.specs)
      ? (r.specs as Record<string, unknown>[])
          .map((s) => ({ label: str(s?.label), value: str(s?.value) }))
          .filter((s) => s.label || s.value)
      : [],
    price: num(r.price),
    priceUnit: str(r.priceUnit, "шт.") || "шт.",
    qty: num(r.qty),
    sku: str(r.sku),
    images,
    imageLayout: IMAGE_LAYOUTS.includes(r.imageLayout as SlideImageLayout)
      ? (r.imageLayout as SlideImageLayout)
      : "auto",
    showDescription: bool(r.showDescription),
    showIncludes: bool(r.showIncludes),
    showSpecs: bool(r.showSpecs),
    showPrice: bool(r.showPrice),
    showImage: bool(r.showImage),
  };
}


const SLIDE_TYPES: SlideType[] = ["title", "product", "text", "section", "contacts"];

export function normalizeSlide(row: Record<string, unknown>, index = 0): PresentationSlide {
  const type = SLIDE_TYPES.includes(row.type as SlideType) ? (row.type as SlideType) : "text";
  return {
    id: str(row.id),
    position: Number(row.position ?? index) || index,
    type,
    title: str(row.title),
    subtitle: str(row.subtitle),
    image_url: row.image_url ? str(row.image_url) : null,
    content: normalizeContent(row.content_json ?? row.content),
    entity_type: row.entity_type ? str(row.entity_type) : null,
    entity_id: row.entity_id ? str(row.entity_id) : null,
    quote_item_id: row.quote_item_id ? str(row.quote_item_id) : null,
    is_visible: row.is_visible !== false,
  };
}

export function normalizePresentation(row: Record<string, unknown>): Presentation {
  const status = (["draft", "ready", "archived"] as const).includes(row.status as PresentationStatus)
    ? (row.status as PresentationStatus)
    : "draft";
  const template = (["light", "dark", "accent"] as const).includes(row.template as PresentationTemplate)
    ? (row.template as PresentationTemplate)
    : "light";
  return {
    id: str(row.id),
    title: str(row.title, "Без названия"),
    company_id: row.company_id ? str(row.company_id) : null,
    quote_id: row.quote_id ? str(row.quote_id) : null,
    status,
    template,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

let localSeq = 0;
/** Локальный id для новых слайдов до сохранения. */
export function draftSlideId(): string {
  localSeq += 1;
  return `new-${Date.now()}-${localSeq}`;
}

export function blankSlide(type: SlideType, position: number): PresentationSlide {
  const titles: Record<SlideType, string> = {
    title: "Титульный слайд",
    product: "Новая позиция",
    text: "Заголовок слайда",
    section: "Новый раздел",
    contacts: "Свяжитесь с нами",
  };
  return {
    id: draftSlideId(),
    position,
    type,
    title: titles[type],
    subtitle: "",
    image_url: null,
    content: { ...EMPTY_CONTENT, includes: [], specs: [], images: [] },
    entity_type: null,
    entity_id: null,
    quote_item_id: null,
    is_visible: true,
  };
}

/** Отображаемое имя файла экспорта: Prezentatsiya_Nazvanie_2026-06-22.pdf */
export function presentationFileName(title: string, ext: "pdf" | "pptx"): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const slug = title
    .toLowerCase()
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "prezentatsiya";
  const date = new Date().toISOString().slice(0, 10);
  return `Prezentatsiya_${slug}_${date}.${ext}`;
}
