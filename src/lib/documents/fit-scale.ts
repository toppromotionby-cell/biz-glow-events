// Единый расчёт масштаба «вписать лист в область» для всех превью документов
// (КП, корпоративные документы, внутренние виды). Один источник правды, чтобы
// нигде не накладывался двойной зум и превью совпадало с PDF.

/** Ширина листа A4 при 96 dpi. */
export const DOC_PAGE_W = 794;
/** Высота листа A4 при 96 dpi. */
export const DOC_PAGE_H = 1123;
export const DOC_ZOOM_MIN = 0.25;
export const DOC_ZOOM_MAX = 2;

export type DocFitMode = "width" | "page";

export const clampScale = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function fitScale(opts: {
  /** Ширина области просмотра, px. */
  boxW: number;
  /** Высота области просмотра, px. */
  boxH: number;
  /** Высота листа (может быть больше A4, если страниц несколько), px. */
  sheetH?: number;
  /** Ширина листа, px. */
  sheetW?: number;
  /** Внутренние отступы области, px. */
  pad?: number;
  mode?: DocFitMode;
  /** Пользовательский множитель поверх «вписать». */
  zoom?: number;
  /** Потолок для «вписать» (без учёта ручного зума): 1 — не увеличивать лист. */
  maxBase?: number;
}): { base: number; scale: number } {
  const {
    boxW,
    boxH,
    sheetH = DOC_PAGE_H,
    sheetW = DOC_PAGE_W,
    pad = 32,
    mode = "width",
    zoom = 1,
    maxBase = Number.POSITIVE_INFINITY,
  } = opts;
  const fitW = Math.max(0.15, (boxW - pad * 2) / Math.max(1, sheetW));
  const fitP = Math.min(fitW, Math.max(0.15, (boxH - pad * 2) / Math.max(1, sheetH)));
  const base = Math.min(mode === "page" ? fitP : fitW, maxBase);
  return { base, scale: clampScale(base * zoom, 0.1, 4) };
}

/**
 * Фактически видимая ширина элемента: `clientWidth` может быть больше того,
 * что реально видно (элемент вылез за родителя с `overflow:hidden` или за
 * границу окна). Берём минимум, иначе масштаб превью завышается и лист
 * обрезается справа.
 */
export function visibleWidth(opts: {
  /** Собственная ширина элемента (clientWidth), px. */
  clientWidth: number;
  /** Координаты элемента (getBoundingClientRect). */
  left: number;
  right: number;
  /** Ширина окна, px. */
  viewportWidth: number;
  /** Границы ближайшего обрезающего родителя, px (если известны). */
  clipLeft?: number;
  clipRight?: number;
}): number {
  const { clientWidth, left, right, viewportWidth } = opts;
  const clipL = Math.max(0, opts.clipLeft ?? 0);
  const clipR = Math.min(viewportWidth, opts.clipRight ?? viewportWidth);
  const visible = Math.min(right, clipR, viewportWidth) - Math.max(left, clipL, 0);
  const candidates = [clientWidth, visible].filter((n) => Number.isFinite(n) && n > 0);
  return candidates.length ? Math.min(...candidates) : Math.max(0, clientWidth);
}

