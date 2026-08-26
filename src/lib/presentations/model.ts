// Модель презентаций: типы слайдов, нормализация содержимого, дефолты.
// Файл клиент-безопасный — используется и в редакторе, и в server fns, и в PDF.
import { clamp } from "@/lib/canvas/model";
import { normalizeDocFontChoice, type DocFontChoice } from "@/lib/documents/doc-font";
import {
  PHOTO_ANCHORS, PHOTO_FITS, type PhotoAnchor, type PhotoFit,
} from "@/lib/presentations/photo-fit";
import { htmlToPlainText, isHtml } from "@/lib/rich-text";

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


/** Единый список типов слайдов — источник правды для UI и валидаторов. */
export const SLIDE_TYPES = [
  "title", "product", "text", "section", "contacts",
  "agenda", "stats", "timeline", "team", "compare",
  "gallery", "quote", "estimate", "logos", "cta",
] as const;

export type SlideType = (typeof SLIDE_TYPES)[number];


export type PresentationStatus = "draft" | "ready" | "archived";

/** Единый список шаблонов — источник правды и для UI, и для валидаторов. */
export const PRESENTATION_TEMPLATES = [
  "light", "dark", "accent", "night", "sunset", "emerald", "glow",
] as const;

export type PresentationTemplate = (typeof PRESENTATION_TEMPLATES)[number];

/**
 * Приводит любое значение к известному шаблону. Неизвестные значения
 * (например, из более новой версии клиента) не роняют запрос, а падают
 * в безопасный дефолт.
 */
export function normalizeTemplate(v: unknown): PresentationTemplate {
  return PRESENTATION_TEMPLATES.includes(v as PresentationTemplate)
    ? (v as PresentationTemplate)
    : "light";
}

export const PRESENTATION_STATUSES = ["draft", "ready", "archived"] as const;


export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  title: "Титульный",
  product: "Товар / позиция",
  text: "Текстовый",
  section: "Разделитель",
  contacts: "Контакты",
  agenda: "Оглавление / программа",
  stats: "Цифры и факты",
  timeline: "Тайминг / этапы",
  team: "Команда",
  compare: "Сравнение",
  gallery: "Галерея / портфолио",
  quote: "Отзыв / цитата",
  estimate: "Смета",
  logos: "Партнёры / логотипы",
  cta: "Призыв к действию",
};

/** Короткая подсказка под названием типа в блоке добавления слайда. */
export const SLIDE_TYPE_HINTS: Record<SlideType, string> = {
  title: "Обложка презентации",
  product: "Позиция с фото и ценой",
  text: "Свободный текст и тезисы",
  section: "Начало нового блока",
  contacts: "Телефон, почта, сайт",
  agenda: "Список разделов встречи",
  stats: "Ключевые метрики крупно",
  timeline: "Хронология по этапам",
  team: "Люди проекта с фото",
  compare: "Две колонки / пакеты",
  gallery: "Сетка фотографий",
  quote: "Слова клиента",
  estimate: "Позиции и итог",
  logos: "Клиенты и партнёры",
  cta: "Следующий шаг",
};

/** Вариант оформления слайда: 5 раскладок на каждый тип. */
export type SlideVariant = { id: string; label: string; hint: string };

export const SLIDE_VARIANTS: Record<SlideType, SlideVariant[]> = {
  title: [
    { id: "classic", label: "Классика", hint: "Текст слева, воздух справа" },
    { id: "hero-photo", label: "Фото на весь экран", hint: "Крупный кадр с затемнением" },
    { id: "split", label: "Split 50/50", hint: "Половина фото, половина текст" },
    { id: "minimal", label: "Минимал", hint: "По центру, много воздуха" },
    { id: "bento", label: "Bento", hint: "Обложка из модулей" },
  ],
  product: [
    { id: "classic", label: "Классика", hint: "Фото слева, описание справа" },
    { id: "hero-top", label: "Фото сверху", hint: "Широкий кадр над текстом" },
    { id: "gallery", label: "Галерея", hint: "Сетка кадров сбоку" },
    { id: "price-accent", label: "Акцент на цене", hint: "Крупная плашка стоимости" },
    { id: "full", label: "Фото на весь слайд", hint: "Текст поверх кадра" },
  ],
  text: [
    { id: "classic", label: "Одна колонка", hint: "Заголовок и текст" },
    { id: "two-cols", label: "Две колонки", hint: "Текст в два потока" },
    { id: "checklist", label: "Чек-лист", hint: "Тезисы списком" },
    { id: "quote", label: "Крупная мысль", hint: "Большая типографика" },
    { id: "with-photo", label: "С фото", hint: "Иллюстрация сбоку" },
  ],
  section: [
    { id: "classic", label: "Линия", hint: "Тонкий акцент и заголовок" },
    { id: "number", label: "Номер главы", hint: "Крупная цифра" },
    { id: "band", label: "Цветная плашка", hint: "Акцентная полоса" },
    { id: "photo", label: "Фото на весь экран", hint: "Кадр с затемнением" },
    { id: "minimal", label: "Минимал", hint: "Только заголовок по центру" },
  ],
  contacts: [
    { id: "classic", label: "Карточки 2×2", hint: "Контакты сеткой" },
    { id: "center", label: "По центру", hint: "Крупно и симметрично" },
    { id: "columns", label: "Три колонки", hint: "Контакты в ряд" },
    { id: "band", label: "Полоса", hint: "Акцентная лента снизу" },
    { id: "split", label: "Split", hint: "Текст слева, контакты справа" },
  ],
  agenda: [
    { id: "numbered", label: "Нумерованный список", hint: "01 · 02 · 03" },
    { id: "two-cols", label: "Две колонки", hint: "До 10 пунктов" },
    { id: "cards", label: "Карточки", hint: "Модули с номерами" },
    { id: "rail", label: "Лента", hint: "Вертикальная линия" },
    { id: "minimal", label: "Минимал", hint: "Только пункты, много воздуха" },
  ],
  stats: [
    { id: "row3", label: "Три метрики", hint: "Крупно в ряд" },
    { id: "bento", label: "Bento 2×2", hint: "Модули разного веса" },
    { id: "giant", label: "Одна цифра", hint: "Гигантское число" },
    { id: "strip", label: "Полоса", hint: "Метрики лентой" },
    { id: "cards", label: "Карточки", hint: "Акцентные плашки" },
  ],
  timeline: [
    { id: "horizontal", label: "Горизонталь", hint: "Линия со стопами" },
    { id: "vertical", label: "Вертикаль", hint: "Список этапов" },
    { id: "steps", label: "Шаги-карточки", hint: "Модули по этапам" },
    { id: "numbered", label: "Нумерация", hint: "Крупные цифры этапов" },
    { id: "compact", label: "Компакт", hint: "Много этапов подряд" },
  ],
  team: [
    { id: "cards3", label: "Три карточки", hint: "Фото, имя, роль" },
    { id: "grid4", label: "Сетка 4", hint: "Компактные карточки" },
    { id: "split", label: "Split", hint: "Один человек крупно" },
    { id: "strip", label: "Лента", hint: "Портреты в ряд" },
    { id: "minimal", label: "Без фото", hint: "Имена и роли" },
  ],
  compare: [
    { id: "two-cols", label: "Две колонки", hint: "Слева / справа" },
    { id: "checklist", label: "Чек-лист", hint: "Построчное сравнение" },
    { id: "before-after", label: "До / после", hint: "Контраст двух состояний" },
    { id: "accent", label: "С акцентом", hint: "Правая колонка выделена" },
    { id: "packages", label: "Пакеты", hint: "Карточки тарифов" },
  ],
  gallery: [
    { id: "auto", label: "Авто", hint: "Паттерн под количество фото" },
    { id: "contact-sheet", label: "Контактный лист", hint: "Ровная сетка" },
    { id: "bento", label: "Bento", hint: "Герой и модули" },
    { id: "fullbleed", label: "Во весь слайд", hint: "Без полей" },
    { id: "captions", label: "С подписями", hint: "Сетка и заголовок" },
  ],
  quote: [
    { id: "center", label: "По центру", hint: "Цитата крупно" },
    { id: "side-photo", label: "С портретом", hint: "Фото автора сбоку" },
    { id: "big", label: "Крупная типографика", hint: "Во весь слайд" },
    { id: "card", label: "Карточка", hint: "Цитата на плашке" },
    { id: "minimal", label: "Минимал", hint: "Тонко и сдержанно" },
  ],
  estimate: [
    { id: "table", label: "Таблица", hint: "Позиции и суммы" },
    { id: "total", label: "Таблица + итог", hint: "Акцент на сумме" },
    { id: "cards", label: "Карточки", hint: "Блоки услуг" },
    { id: "split", label: "Split", hint: "Список слева, итог справа" },
    { id: "compact", label: "Компакт", hint: "Много строк" },
  ],
  logos: [
    { id: "grid", label: "Сетка", hint: "Ровные логотипы" },
    { id: "strip", label: "Лента", hint: "В одну линию" },
    { id: "rows", label: "Два ряда", hint: "До 12 логотипов" },
    { id: "cards", label: "Карточки", hint: "Логотипы на плашках" },
    { id: "minimal", label: "Минимал", hint: "Заголовок и логотипы" },
  ],
  cta: [
    { id: "center", label: "По центру", hint: "Крупный призыв" },
    { id: "split", label: "Split", hint: "Текст и шаги" },
    { id: "band", label: "Полоса", hint: "Акцентная лента" },
    { id: "card", label: "Карточка", hint: "Контакты на плашке" },
    { id: "steps", label: "Шаги", hint: "Что дальше — по пунктам" },
  ],
};

/** Валидный вариант оформления для типа слайда (дефолт — первый). */
export function slideVariantId(type: SlideType, raw: unknown): string {
  const list = SLIDE_VARIANTS[type] ?? [];
  const v = typeof raw === "string" ? raw : "";
  return list.some((x) => x.id === v) ? v : (list[0]?.id ?? "classic");
}


export const STATUS_LABELS: Record<PresentationStatus, string> = {
  draft: "Черновик",
  ready: "Готова",
  archived: "Архив",
};

export const TEMPLATE_LABELS: Record<PresentationTemplate, string> = {
  light: "Светлый",
  dark: "Тёмный",
  accent: "Акцентный",
  night: "Ночная волна",
  sunset: "Закат",
  emerald: "Изумруд",
  glow: "Сияние",
};


/* ------------------------------------------------------------------ */
/* Фон слайда                                                          */
/* ------------------------------------------------------------------ */

export type SlideBackgroundMode = "template" | "solid" | "gradient";

/** Переопределение фона конкретного слайда. */
export type SlideBackground = {
  mode: SlideBackgroundMode;
  /** Цвета фона: 1 для сплошного, 2–3 для градиента. */
  stops: string[];
  /** Угол градиента в градусах. */
  angle: number;
};

export const DEFAULT_SLIDE_BACKGROUND: SlideBackground = {
  mode: "template",
  stops: [],
  angle: 135,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (HEX_RE.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return fallback;
}

export function normalizeSlideBackground(raw: unknown): SlideBackground {
  const r = (raw ?? {}) as Record<string, unknown>;
  const mode: SlideBackgroundMode =
    r.mode === "solid" || r.mode === "gradient" ? r.mode : "template";
  if (mode === "template") return { ...DEFAULT_SLIDE_BACKGROUND };
  const list = Array.isArray(r.stops) ? r.stops : [];
  const stops = list
    .map((c) => normalizeHexColor(c, ""))
    .filter(Boolean)
    .slice(0, 3);
  if (!stops.length) return { ...DEFAULT_SLIDE_BACKGROUND };
  const angleRaw = Number(r.angle);
  const angle = Number.isFinite(angleRaw) ? ((Math.round(angleRaw) % 360) + 360) % 360 : 135;
  if (mode === "solid") return { mode: "solid", stops: [stops[0]], angle };
  return {
    mode: "gradient",
    stops: stops.length >= 2 ? stops : [stops[0], stops[0]],
    angle,
  };
}

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
  /** Фотографии слайда (до 15), первая — главная. */
  images: string[];
  /** Раскладка фотоблока. */
  imageLayout: SlideImageLayout;
  /** Правило кадрирования фото (общее для превью, PDF и экспорта). */
  photoFit: PhotoFit;
  /** Точка привязки при обрезке. */
  photoAnchor: PhotoAnchor;
  /** До 3 «главных» фото: попадают в самые заметные слоты раскладки. */
  photoPriority: string[];
  /** Пропорции кадров (url → w/h), нужны автоподбору паттерна. */
  photoAspect: Record<string, number>;
  /** Ручные настройки раскладки («умные зоны»). Пустые значения = авто. */
  layout: SlideLayoutOverrides;
  /** Фон слайда: «как в шаблоне» либо свой цвет/градиент. */
  background: SlideBackground;
  /** Тумблеры видимости блоков. */
  showDescription: boolean;
  showIncludes: boolean;
  showSpecs: boolean;
  showPrice: boolean;
  showImage: boolean;
  /** Вариант оформления слайда (id из SLIDE_VARIANTS для его типа). */
  variant: string;
};

/* ------------------------------------------------------------------ */
/* Ручная раскладка слайда («умные зоны»)                              */
/* ------------------------------------------------------------------ */

export type PhotoZone = "auto" | "left" | "right" | "top" | "full" | "none";
export type TextZone = "auto" | "top" | "center" | "bottom";
export type TextAlignX = "auto" | "left" | "center" | "right";
export type PriceZone = "auto" | "under-text" | "corner" | "beside-photo";
export type LogoZone = "auto" | "tl" | "tr" | "bl" | "br" | "footer" | "hero";

/** Свободная позиция логотипа в долях холста (0..1 от 1280×720). */
export type LogoPos = { x: number; y: number };

export type LogoOverride = { zone: LogoZone; scale: number | null; pos: LogoPos | null };

export type SlideLayoutOverrides = {
  photoZone: PhotoZone;
  /** Доля ширины слайда под фотоблок, 0.25–0.65. */
  photoScale: number | null;
  textZone: TextZone;
  /** Доля доступной ширины под текст, 0.3–1. */
  textWidth: number | null;
  /** Горизонтальное выравнивание текстового блока и выключка текста. */
  alignX: TextAlignX;
  /** Выравнивание отдельных частей текста (auto = как у блока). */
  titleAlignX: TextAlignX;
  subtitleAlignX: TextAlignX;
  bodyAlignX: TextAlignX;
  /** Множители кегля отдельных частей текста, 0.6–2 (null — авто). */
  titleScale: number | null;
  subtitleScale: number | null;
  bodyScale: number | null;

  /** Растянуть текстовый блок на всю доступную ширину. */
  stretchX: boolean;
  /** Растянуть текстовый блок на всю доступную высоту. */
  stretchY: boolean;
  priceZone: PriceZone;
  /** Масштаб блока цены, 0.6–1.8 (null — авто). */
  priceScale: number | null;
  brandLogo: LogoOverride;
  clientLogo: LogoOverride;
};

export const DEFAULT_LAYOUT_OVERRIDES: SlideLayoutOverrides = {
  photoZone: "auto",
  photoScale: null,
  textZone: "auto",
  textWidth: null,
  alignX: "auto",
  titleAlignX: "auto",
  subtitleAlignX: "auto",
  bodyAlignX: "auto",
  titleScale: null,
  subtitleScale: null,
  bodyScale: null,
  stretchX: false,
  stretchY: false,
  priceZone: "auto",
  priceScale: null,
  brandLogo: { zone: "auto", scale: null, pos: null },
  clientLogo: { zone: "auto", scale: null, pos: null },
};



export const PHOTO_SCALE_MIN = 0.25;
export const PHOTO_SCALE_MAX = 0.65;
export const TEXT_WIDTH_MIN = 0.3;
export const TEXT_WIDTH_MAX = 1;
export const LOGO_SCALE_MIN = 0.6;
export const LOGO_SCALE_MAX = 1.8;
export const PRICE_SCALE_MIN = 0.6;
export const PRICE_SCALE_MAX = 1.8;
/** Пределы ручного кегля частей текста (заголовок / подзаголовок / описание). */
export const TEXT_SCALE_MIN = 0.6;
export const TEXT_SCALE_MAX = 2;

/** Ручной множитель кегля части текста (null — авто). */
export const partTextScale = (v: number | null | undefined): number =>
  v == null ? 1 : Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, v));

/** Единое ядро геометрии холста — реэкспорт, чтобы не плодить копии. */
export const clampNum = clamp;

const PHOTO_ZONES: PhotoZone[] = ["auto", "left", "right", "top", "full", "none"];
const TEXT_ZONES: TextZone[] = ["auto", "top", "center", "bottom"];
const ALIGN_X: TextAlignX[] = ["auto", "left", "center", "right"];
const PRICE_ZONES: PriceZone[] = ["auto", "under-text", "corner", "beside-photo"];
const LOGO_ZONES: LogoZone[] = ["auto", "tl", "tr", "bl", "br", "footer", "hero"];

function normLogoPos(raw: unknown): LogoPos | null {
  const r = (raw ?? null) as Record<string, unknown> | null;
  if (!r) return null;
  const x = Number(r.x);
  const y = Number(r.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clampNum(x, 0, 1), y: clampNum(y, 0, 1) };
}

function normLogoOverride(raw: unknown): LogoOverride {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = Number(r.scale);
  return {
    zone: LOGO_ZONES.includes(r.zone as LogoZone) ? (r.zone as LogoZone) : "auto",
    scale: Number.isFinite(s) && s > 0 ? clampNum(s, LOGO_SCALE_MIN, LOGO_SCALE_MAX) : null,
    pos: normLogoPos(r.pos),
  };
}

/** Множитель кегля части текста: положительное число в допустимых пределах. */
const textScaleOf = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? clampNum(n, TEXT_SCALE_MIN, TEXT_SCALE_MAX) : null;
};

const alignOf = (v: unknown): TextAlignX =>
  ALIGN_X.includes(v as TextAlignX) ? (v as TextAlignX) : "auto";

export function normalizeLayoutOverrides(raw: unknown): SlideLayoutOverrides {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ps = Number(r.photoScale);
  const tw = Number(r.textWidth);
  const prs = Number(r.priceScale);
  return {
    photoZone: PHOTO_ZONES.includes(r.photoZone as PhotoZone) ? (r.photoZone as PhotoZone) : "auto",
    photoScale: Number.isFinite(ps) && ps > 0 ? clampNum(ps, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) : null,
    textZone: TEXT_ZONES.includes(r.textZone as TextZone) ? (r.textZone as TextZone) : "auto",
    textWidth: Number.isFinite(tw) && tw > 0 ? clampNum(tw, TEXT_WIDTH_MIN, TEXT_WIDTH_MAX) : null,
    alignX: alignOf(r.alignX),
    titleAlignX: alignOf(r.titleAlignX),
    subtitleAlignX: alignOf(r.subtitleAlignX),
    bodyAlignX: alignOf(r.bodyAlignX),
    titleScale: textScaleOf(r.titleScale),
    subtitleScale: textScaleOf(r.subtitleScale),
    bodyScale: textScaleOf(r.bodyScale),
    stretchX: r.stretchX === true,
    stretchY: r.stretchY === true,
    priceZone: PRICE_ZONES.includes(r.priceZone as PriceZone) ? (r.priceZone as PriceZone) : "auto",
    priceScale: Number.isFinite(prs) && prs > 0 ? clampNum(prs, PRICE_SCALE_MIN, PRICE_SCALE_MAX) : null,
    brandLogo: normLogoOverride(r.brandLogo),
    clientLogo: normLogoOverride(r.clientLogo),
  };
}

/** Раскладка слайда полностью автоматическая? */
export function isAutoLayout(o: SlideLayoutOverrides): boolean {
  const autoLogo = (l: LogoOverride) => l.zone === "auto" && l.scale === null && l.pos === null;
  return (
    o.photoZone === "auto" &&
    o.photoScale === null &&
    o.textZone === "auto" &&
    o.textWidth === null &&
    o.alignX === "auto" &&
    o.titleAlignX === "auto" &&
    o.subtitleAlignX === "auto" &&
    o.bodyAlignX === "auto" &&
    o.titleScale === null &&
    o.subtitleScale === null &&
    o.bodyScale === null &&
    !o.stretchX &&
    !o.stretchY &&
    o.priceScale === null &&
    o.priceZone === "auto" &&
    autoLogo(o.brandLogo) &&
    autoLogo(o.clientLogo)
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
  /** Постоянный токен публичной ссылки /p/<token>. */
  public_token: string;
  /** Доступ по публичной ссылке включён. */
  share_enabled: boolean;
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

export const MAX_IMAGES = 15;

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
  photoFit: "cover",
  photoAnchor: "center",
  photoPriority: [],
  photoAspect: {},
  layout: DEFAULT_LAYOUT_OVERRIDES,
  background: { ...DEFAULT_SLIDE_BACKGROUND },

  showDescription: true,
  showIncludes: true,
  showSpecs: true,
  showPrice: true,
  showImage: true,
  variant: "classic",
};

const IMAGE_LAYOUTS: SlideImageLayout[] = ["auto", "left", "right", "top", "none"];

export function normalizeContent(raw: unknown): SlideContent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, d = true) => (typeof v === "boolean" ? v : d);
  const images = Array.isArray(r.images)
    ? Array.from(new Set(r.images.map((i) => str(i).trim()).filter(Boolean))).slice(0, MAX_IMAGES)
    : [];
  // Описания в каталоге хранятся как HTML; слайды рисуются простым текстом.
  const plain = (v: unknown, d = "") => {
    const s = str(v, d);
    return isHtml(s) ? htmlToPlainText(s) : s;
  };
  return {
    description: plain(r.description),
    includes: Array.isArray(r.includes) ? r.includes.map((i) => plain(i)).filter(Boolean) : [],
    specs: Array.isArray(r.specs)
      ? (r.specs as Record<string, unknown>[])
          .map((s) => ({ label: plain(s?.label), value: plain(s?.value) }))
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
    photoFit: PHOTO_FITS.includes(r.photoFit as PhotoFit) ? (r.photoFit as PhotoFit) : "cover",
    photoAnchor: PHOTO_ANCHORS.includes(r.photoAnchor as PhotoAnchor)
      ? (r.photoAnchor as PhotoAnchor)
      : "center",
    photoPriority: Array.isArray(r.photoPriority)
      ? Array.from(new Set(r.photoPriority.map((i) => str(i).trim()).filter(Boolean)))
        .filter((u) => images.includes(u))
        .slice(0, 3)
      : [],
    photoAspect: (() => {
      const src = (r.photoAspect ?? {}) as Record<string, unknown>;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(src)) {
        const n = Number(v);
        if (images.includes(k) && Number.isFinite(n) && n > 0.05 && n < 20) out[k] = n;
      }
      return out;
    })(),
    layout: normalizeLayoutOverrides(r.layout),
    background: normalizeSlideBackground(r.background),

    showDescription: bool(r.showDescription),
    showIncludes: bool(r.showIncludes),
    showSpecs: bool(r.showSpecs),
    showPrice: bool(r.showPrice),
    showImage: bool(r.showImage),
    variant: str(r.variant, "classic") || "classic",
  };
}



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
  const status = PRESENTATION_STATUSES.includes(row.status as PresentationStatus)
    ? (row.status as PresentationStatus)
    : "draft";
  const template = normalizeTemplate(row.template);
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
    public_token: str(row.public_token),
    share_enabled: row.share_enabled === true,
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

const SLIDE_SEED: Record<SlideType, { title: string; subtitle?: string; content?: Partial<SlideContent> }> = {
  title: { title: "Титульный слайд" },
  product: { title: "Новая позиция" },
  text: { title: "Заголовок слайда" },
  section: { title: "Новый раздел" },
  contacts: { title: "Свяжитесь с нами" },
  agenda: {
    title: "Программа",
    content: { includes: ["Знакомство и задача", "Концепция", "Площадка и тайминг", "Смета", "Следующие шаги"] },
  },
  stats: {
    title: "Цифры проекта",
    content: {
      specs: [
        { label: "Гостей", value: "350" },
        { label: "Площадок", value: "3" },
        { label: "Часов шоу", value: "6" },
      ],
    },
  },
  timeline: {
    title: "Тайминг мероприятия",
    content: {
      specs: [
        { label: "17:00", value: "Сбор гостей, велком-зона" },
        { label: "18:00", value: "Официальная часть" },
        { label: "19:30", value: "Шоу-программа" },
        { label: "22:00", value: "Финал и афтепати" },
      ],
    },
  },
  team: {
    title: "Команда проекта",
    content: {
      specs: [
        { label: "Имя Фамилия", value: "Продюсер" },
        { label: "Имя Фамилия", value: "Арт-директор" },
        { label: "Имя Фамилия", value: "Технический директор" },
      ],
    },
  },
  compare: {
    title: "Сравнение вариантов",
    content: {
      includes: ["Базовый", "Расширенный"],
      specs: [
        { label: "Сцена 6×4 м", value: "Сцена 10×6 м" },
        { label: "Свет: базовый комплект", value: "Свет: полный райдер" },
        { label: "Звук до 200 гостей", value: "Звук до 500 гостей" },
      ],
    },
  },
  gallery: { title: "Портфолио" },
  quote: {
    title: "Отзыв клиента",
    subtitle: "Имя Фамилия, компания",
    content: { description: "Команда собрала мероприятие под ключ и держала тайминг до минуты." },
  },
  estimate: {
    title: "Смета",
    content: {
      specs: [
        { label: "Техническое обеспечение", value: "12 000 BYN" },
        { label: "Шоу-программа", value: "8 000 BYN" },
        { label: "Декор и застройка", value: "6 500 BYN" },
      ],
    },
  },
  logos: { title: "Нам доверяют" },
  cta: {
    title: "Готовы начать?",
    subtitle: "Забронируем дату и соберём финальную смету",
    content: { includes: ["Согласуем концепцию", "Фиксируем дату", "Подписываем договор"] },
  },
};

export function blankSlide(type: SlideType, position: number, variant?: string): PresentationSlide {
  const seed = SLIDE_SEED[type];
  return {
    id: draftSlideId(),
    position,
    type,
    title: seed.title,
    subtitle: seed.subtitle ?? "",
    image_url: null,
    content: {
      ...EMPTY_CONTENT,
      includes: [],
      specs: [],
      images: [],
      ...seed.content,
      variant: slideVariantId(type, variant),
    },
    entity_type: null,
    entity_id: null,
    quote_item_id: null,
    is_visible: true,
  };
}


/** Отображаемое имя файла экспорта: Prezentatsiya_Nazvanie_2026-06-22.pdf */
export function presentationFileName(title: string, ext: "pdf"): string {
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
