/**
 * Единая модель размещения логотипа в шапке документов (КП, КП‑промо, счёт,
 * договор, акт).
 *
 * Один источник правды для:
 *  - PDF (`pdf.server.ts`) — координаты в pt страницы A4;
 *  - HTML‑превью и интерактивного предпросмотра в админке (`LogoHeaderDesigner`).
 */
import { DOC_LAYOUT } from "./brand";

export type LogoAlign = "left" | "center" | "right";

export type LogoLayout = {
  /** «auto» — размеры подбираются автоматически, «manual» — ползунками. */
  mode: "auto" | "manual";
  /** Горизонтальное выравнивание логотипа в шапке. */
  align: LogoAlign;
  /** Максимальная ширина бокса логотипа, pt. */
  maxW: number;
  /** Максимальная высота бокса логотипа, pt. */
  maxH: number;
  /** Сдвиг по горизонтали от рассчитанной позиции, pt (может быть отрицательным). */
  offsetX: number;
  /** Сдвиг вниз от верхнего поля, pt. */
  offsetY: number;
  /** Отступ между логотипом и текстом бренда (для выравнивания слева), pt. */
  gap: number;
};

export const DEFAULT_LOGO_LAYOUT: LogoLayout = {
  mode: "auto",
  align: "left",
  maxW: 150,
  maxH: 34,
  offsetX: 0,
  offsetY: 0,
  gap: 12,
};


export const LOGO_LAYOUT_LIMITS = {
  maxW: { min: 40, max: 320, step: 2 },
  maxH: { min: 16, max: 110, step: 1 },
  offsetX: { min: -80, max: 80, step: 1 },
  offsetY: { min: -20, max: 60, step: 1 },
  gap: { min: 0, max: 48, step: 1 },
} as const;

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

/** Приводит произвольное значение из БД к валидному LogoLayout. */
export function normalizeLogoLayout(value: unknown): LogoLayout {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof LogoLayout, unknown>>;
  const L = LOGO_LAYOUT_LIMITS;
  const align = raw.align === "center" || raw.align === "right" ? raw.align : "left";
  // Старые записи (без mode) сохраняют ручные размеры, новые — авто.
  const mode = raw.mode === "manual" ? "manual" : raw.mode === "auto" ? "auto" : hasManualValues(raw) ? "manual" : "auto";
  return {
    mode,
    align,

    maxW: clamp(raw.maxW, L.maxW.min, L.maxW.max, DEFAULT_LOGO_LAYOUT.maxW),
    maxH: clamp(raw.maxH, L.maxH.min, L.maxH.max, DEFAULT_LOGO_LAYOUT.maxH),
    offsetX: clamp(raw.offsetX, L.offsetX.min, L.offsetX.max, 0),
    offsetY: clamp(raw.offsetY, L.offsetY.min, L.offsetY.max, 0),
    gap: clamp(raw.gap, L.gap.min, L.gap.max, DEFAULT_LOGO_LAYOUT.gap),
  };
}

/** True, если настройки отличаются от значений по умолчанию. */
export function isDefaultLogoLayout(l: LogoLayout): boolean {
  return (Object.keys(DEFAULT_LOGO_LAYOUT) as (keyof LogoLayout)[]).every(
    (k) => l[k] === DEFAULT_LOGO_LAYOUT[k],
  );
}

export type LogoPlacement = {
  /** Ширина/высота отрисованного логотипа, pt. */
  w: number;
  h: number;
  /** Левый край, pt от левого края страницы. */
  x: number;
  /** Отступ верхнего края логотипа от верхнего поля страницы, pt (вниз). */
  top: number;
  /** X, с которого начинается текст бренда/реквизитов (левый край текстового блока). */
  textX: number;
  /** Правая граница текстового блока, pt от левого края страницы. */
  textRight: number;
  /** Горизонтальное выравнивание текстового блока (совпадает с логотипом). */
  textAlign: LogoAlign;
  /** Отступ верха текстового блока от верхнего поля страницы, pt (вниз). */
  textTop: number;
  /** Высота, которую шапка должна зарезервировать под логотип, pt. */
  reserve: number;
};

/**
 * Считает геометрию логотипа в шапке.
 * Реквизиты (бренд/юрлицо/адрес) всегда располагаются ПОД логотипом
 * и выравниваются по горизонтали так же, как логотип.
 * @param aspect отношение ширины к высоте исходного изображения (w/h)
 */
export function computeLogoPlacement(layout: LogoLayout, aspect: number): LogoPlacement {
  const { pageWidthPt, marginXPt } = DOC_LAYOUT;
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 3;
  const contentW = pageWidthPt - marginXPt * 2;
  const boxW = Math.min(layout.maxW, contentW);
  const k = Math.min(boxW / a, layout.maxH);
  const h = Math.max(1, k);
  const w = Math.max(1, h * a);

  let x: number;
  if (layout.align === "center") x = (pageWidthPt - w) / 2;
  else if (layout.align === "right") x = pageWidthPt - marginXPt - w;
  else x = marginXPt;
  x = Math.min(Math.max(x + layout.offsetX, 4), pageWidthPt - w - 4);

  const top = Math.max(0, layout.offsetY);
  // Текст всегда под логотипом: gap — вертикальный отступ.
  const textTop = top + h + layout.gap * 0.5;
  const textX = marginXPt;
  const textRight = pageWidthPt - marginXPt;

  return { w, h, x, top, textX, textRight, textAlign: layout.align, textTop, reserve: textTop };
}


/** Коэффициент перевода pt страницы в «пиксели макета» HTML-превью. */
export const LOGO_PT_TO_PX = 1.48;

/** inline-стиль для <img> логотипа в HTML-превью документа. */
export function logoImgStyle(layout: LogoLayout): string {
  const px = (v: number) => `${Math.round(v * LOGO_PT_TO_PX * 10) / 10}px`;
  return [
    "display:inline-block",
    "position:relative",
    "width:auto",
    "height:auto",
    `max-width:${px(layout.maxW)}`,
    `max-height:${px(layout.maxH)}`,
    `left:${px(layout.offsetX)}`,
    `top:${px(layout.offsetY)}`,
    `margin-bottom:${px(layout.gap * 0.5)}`,
  ].join(";");
}

/** inline-стиль обёртки логотипа (выравнивание по горизонтали). */
export function logoWrapStyle(layout: LogoLayout): string {
  const align = layout.align === "center" ? "center" : layout.align === "right" ? "right" : "left";
  return `text-align:${align}`;
}
