// Универсальная объектная модель холста — общее ядро для «Документов» и
// «Презентаций». Страница любого формата (A4 или слайд 16:9) описывается
// одинаково: массив элементов с абсолютной геометрией.
//
// Ровно эта модель питает и превью, и PDF: рендер — это обход элементов,
// поэтому расхождений между экраном и файлом быть не может.

/** Формат листа в пикселях холста (единая система координат). */
export type PageFormat = { id: string; label: string; w: number; h: number };

/** A4 при 96 dpi и слайд 16:9 — вся разница между документом и презентацией. */
export const PAGE_FORMATS = {
  a4: { id: "a4", label: "A4 (210×297 мм)", w: 794, h: 1123 },
  a4landscape: { id: "a4landscape", label: "A4 альбомная", w: 1123, h: 794 },
  slide: { id: "slide", label: "Слайд 16:9", w: 1280, h: 720 },
} as const satisfies Record<string, PageFormat>;

export type PageFormatId = keyof typeof PAGE_FORMATS;

export type ElementType =
  | "text"
  | "image"
  | "shape"
  | "logo"
  | "table";

/** Базовый объект холста — как в Canva: геометрия + типовые свойства. */
export type CanvasElement<P = Record<string, unknown>> = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  /** Типозависимые свойства: текст и кегль, путь картинки, стиль плашки. */
  props: P;
};

export type CanvasPage = {
  id: string;
  format: PageFormat;
  background: string | null;
  elements: CanvasElement[];
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** Дефолты элемента: любой частичный объект превращается в валидный. */
export function normalizeElement(
  raw: Partial<CanvasElement> & { id: string; type: ElementType },
): CanvasElement {
  return {
    id: raw.id,
    type: raw.type,
    x: Number.isFinite(raw.x) ? (raw.x as number) : 0,
    y: Number.isFinite(raw.y) ? (raw.y as number) : 0,
    w: Math.max(1, Number.isFinite(raw.w) ? (raw.w as number) : 100),
    h: Math.max(1, Number.isFinite(raw.h) ? (raw.h as number) : 40),
    rotation: raw.rotation ?? 0,
    zIndex: raw.zIndex ?? 0,
    locked: raw.locked ?? false,
    props: raw.props ?? {},
  };
}

/** Элемент не должен уезжать за лист целиком — оставляем видимый край. */
export function clampToPage(
  el: CanvasElement,
  page: PageFormat,
  keepVisible = 24,
): CanvasElement {
  return {
    ...el,
    x: clamp(el.x, keepVisible - el.w, page.w - keepVisible),
    y: clamp(el.y, keepVisible - el.h, page.h - keepVisible),
  };
}

/** Порядок отрисовки: сначала фон, потом верхние слои. */
export const byZIndex = (a: CanvasElement, b: CanvasElement): number =>
  a.zIndex - b.zIndex || a.id.localeCompare(b.id);

/** Верхний элемент под точкой — основа выделения кликом. */
export function hitTest(
  elements: CanvasElement[],
  x: number,
  y: number,
): CanvasElement | null {
  const sorted = [...elements].sort(byZIndex).reverse();
  return (
    sorted.find(
      (el) => !el.locked && x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h,
    ) ?? null
  );
}

/** Общая рамка выделенных элементов (для группового трансформа). */
export function bbox(elements: CanvasElement[]): {
  x: number; y: number; w: number; h: number;
} | null {
  if (!elements.length) return null;
  const x = Math.min(...elements.map((e) => e.x));
  const y = Math.min(...elements.map((e) => e.y));
  const r = Math.max(...elements.map((e) => e.x + e.w));
  const b = Math.max(...elements.map((e) => e.y + e.h));
  return { x, y, w: r - x, h: b - y };
}

/** Шаблон — это просто JSON-массив элементов. */
export function elementsFromTemplate(json: unknown, page: PageFormat): CanvasElement[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((raw): raw is Partial<CanvasElement> & { id: string; type: ElementType } =>
      !!raw && typeof raw === "object" && "type" in raw)
    .map((raw, i) => clampToPage(normalizeElement({ ...raw, id: raw.id ?? `el-${i}` }), page));
}
