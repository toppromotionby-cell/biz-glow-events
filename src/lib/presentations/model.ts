// Модель презентаций: типы слайдов, нормализация содержимого, дефолты.
// Файл клиент-безопасный — используется и в редакторе, и в server fns, и в PDF.
import { normalizeDocFontChoice, type DocFontChoice } from "@/lib/documents/doc-font";

/** Как накладывать логотипы на слайды. */
export type LogoPlacement = "auto" | "always" | "title-only" | "off";

export const LOGO_PLACEMENT_LABELS: Record<LogoPlacement, string> = {
  auto: "Авто (где есть место)",
  always: "На каждом слайде",
  "title-only": "Только титул и контакты",
  off: "Не показывать",
};

export type PresentationLogoLayout = {
  brand: LogoPlacement;
  client: LogoPlacement;
  /** Масштаб логотипов, 0.6–1.6 (1 — базовый размер). */
  scale: number;
};

export const DEFAULT_PRESENTATION_LOGO_LAYOUT: PresentationLogoLayout = {
  brand: "auto",
  client: "auto",
  scale: 1,
};

const PLACEMENTS: LogoPlacement[] = ["auto", "always", "title-only", "off"];

export function normalizePresentationLogoLayout(raw: unknown): PresentationLogoLayout {
  const r = (raw ?? {}) as Record<string, unknown>;
  const place = (v: unknown, d: LogoPlacement): LogoPlacement =>
    PLACEMENTS.includes(v as LogoPlacement) ? (v as LogoPlacement) : d;
  const scale = Number(r.scale);
  return {
    brand: place(r.brand, "auto"),
    client: place(r.client, "auto"),
    scale: Number.isFinite(scale) ? Math.min(1.6, Math.max(0.6, scale)) : 1,
  };
}


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
  /** Ручные настройки раскладки («умные зоны»). Пустые значения = авто. */
  layout: SlideLayoutOverrides;
  /** Тумблеры видимости блоков. */
  showDescription: boolean;
  showIncludes: boolean;
  showSpecs: boolean;
  showPrice: boolean;
  showImage: boolean;
};

/* ------------------------------------------------------------------ */
/* Ручная раскладка слайда («умные зоны»)                              */
/* ------------------------------------------------------------------ */

export type PhotoZone = "auto" | "left" | "right" | "top" | "full" | "none";
export type TextZone = "auto" | "top" | "center" | "bottom";
export type PriceZone = "auto" | "under-text" | "corner" | "beside-photo";
export type LogoZone = "auto" | "tl" | "tr" | "bl" | "br" | "footer" | "hero";

export type LogoOverride = { zone: LogoZone; scale: number | null };

export type SlideLayoutOverrides = {
  photoZone: PhotoZone;
  /** Доля ширины слайда под фотоблок, 0.25–0.65. */
  photoScale: number | null;
  textZone: TextZone;
  /** Доля доступной ширины под текст, 0.3–1. */
  textWidth: number | null;
  priceZone: PriceZone;
  brandLogo: LogoOverride;
  clientLogo: LogoOverride;
};

export const DEFAULT_LAYOUT_OVERRIDES: SlideLayoutOverrides = {
  photoZone: "auto",
  photoScale: null,
  textZone: "auto",
  textWidth: null,
  priceZone: "auto",
  brandLogo: { zone: "auto", scale: null },
  clientLogo: { zone: "auto", scale: null },
};

export const PHOTO_SCALE_MIN = 0.25;
export const PHOTO_SCALE_MAX = 0.65;
export const TEXT_WIDTH_MIN = 0.3;
export const TEXT_WIDTH_MAX = 1;
export const LOGO_SCALE_MIN = 0.6;
export const LOGO_SCALE_MAX = 1.8;

export const clampNum = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const PHOTO_ZONES: PhotoZone[] = ["auto", "left", "right", "top", "full", "none"];
const TEXT_ZONES: TextZone[] = ["auto", "top", "center", "bottom"];
const PRICE_ZONES: PriceZone[] = ["auto", "under-text", "corner", "beside-photo"];
const LOGO_ZONES: LogoZone[] = ["auto", "tl", "tr", "bl", "br", "footer", "hero"];

function normLogoOverride(raw: unknown): LogoOverride {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = Number(r.scale);
  return {
    zone: LOGO_ZONES.includes(r.zone as LogoZone) ? (r.zone as LogoZone) : "auto",
    scale: Number.isFinite(s) && s > 0 ? clampNum(s, LOGO_SCALE_MIN, LOGO_SCALE_MAX) : null,
  };
}

export function normalizeLayoutOverrides(raw: unknown): SlideLayoutOverrides {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ps = Number(r.photoScale);
  const tw = Number(r.textWidth);
  return {
    photoZone: PHOTO_ZONES.includes(r.photoZone as PhotoZone) ? (r.photoZone as PhotoZone) : "auto",
    photoScale: Number.isFinite(ps) && ps > 0 ? clampNum(ps, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) : null,
    textZone: TEXT_ZONES.includes(r.textZone as TextZone) ? (r.textZone as TextZone) : "auto",
    textWidth: Number.isFinite(tw) && tw > 0 ? clampNum(tw, TEXT_WIDTH_MIN, TEXT_WIDTH_MAX) : null,
    priceZone: PRICE_ZONES.includes(r.priceZone as PriceZone) ? (r.priceZone as PriceZone) : "auto",
    brandLogo: normLogoOverride(r.brandLogo),
    clientLogo: normLogoOverride(r.clientLogo),
  };
}

/** Раскладка слайда полностью автоматическая? */
export function isAutoLayout(o: SlideLayoutOverrides): boolean {
  return (
    o.photoZone === "auto" &&
    o.photoScale === null &&
    o.textZone === "auto" &&
    o.textWidth === null &&
    o.priceZone === "auto" &&
    o.brandLogo.zone === "auto" &&
    o.brandLogo.scale === null &&
    o.clientLogo.zone === "auto" &&
    o.clientLogo.scale === null
  );
}



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
  /** Логотип компании: пусто — берётся из настроек документов. */
  logo_url: string | null;
  /** Логотип клиента — накладывается на слайды автоматически. */
  client_logo_url: string | null;
  /** Настройки размещения логотипов. */
  logo_layout: PresentationLogoLayout;
  /** Шрифт презентации: inherit — как в настройках документов. */
  font_family: DocFontChoice;
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
  layout: DEFAULT_LAYOUT_OVERRIDES,

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
    layout: normalizeLayoutOverrides(r.layout),

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
    logo_url: row.logo_url ? str(row.logo_url) : null,
    client_logo_url: row.client_logo_url ? str(row.client_logo_url) : null,
    logo_layout: normalizePresentationLogoLayout(row.logo_layout),
    font_family: normalizeDocFontChoice(row.font_family),
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
