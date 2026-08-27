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
}): { base: number; scale: number } {
  const {
    boxW,
    boxH,
    sheetH = DOC_PAGE_H,
    sheetW = DOC_PAGE_W,
    pad = 32,
    mode = "width",
    zoom = 1,
  } = opts;
  const fitW = Math.max(0.15, (boxW - pad * 2) / Math.max(1, sheetW));
  const fitP = Math.min(fitW, Math.max(0.15, (boxH - pad * 2) / Math.max(1, sheetH)));
  const base = mode === "page" ? fitP : fitW;
  return { base, scale: clampScale(base * zoom, 0.1, 4) };
}
