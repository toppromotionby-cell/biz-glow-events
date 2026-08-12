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

/** Были ли в записи размеры/сдвиги — признак старой ручной настройки. */
function hasManualValues(raw: Partial<Record<keyof LogoLayout, unknown>>): boolean {
  return (["maxW", "maxH", "offsetX", "offsetY", "gap"] as const).some((k) => raw[k] !== undefined);
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

/** Ширина, зарезервированная под правую колонку (тип/номер/дата), pt. */
const RIGHT_BLOCK_PT = 190;

/** Доступная ширина левой колонки шапки (логотип + реквизиты), pt. */
export function headerColumnWidthPt(): number {
  const { pageWidthPt, marginXPt } = DOC_LAYOUT;
  return pageWidthPt - marginXPt * 2 - RIGHT_BLOCK_PT;
}

/**
 * Авто-режим: подбирает размеры бокса логотипа под свободное место шапки
 * с учётом пропорций изображения — широкие логотипы ограничены по ширине,
 * высокие/квадратные — по высоте.
 */
export function autoLogoBox(aspect: number, align: LogoAlign): { maxW: number; maxH: number; gap: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 3;
  const contentW = DOC_LAYOUT.pageWidthPt - DOC_LAYOUT.marginXPt * 2;
  // По центру логотип может занять почти всю ширину, слева/справа — только свою колонку.
  const availW = align === "center" ? contentW * 0.6 : Math.min(headerColumnWidthPt(), 240);
  // Чем «квадратнее» логотип, тем ниже допустимая высота, чтобы шапка не разрасталась.
  const maxH = a >= 3.5 ? 40 : a >= 2 ? 46 : a >= 1 ? 52 : 58;
  const maxW = Math.min(availW, maxH * a);
  return { maxW: Math.round(maxW), maxH, gap: 12 };
}

/** Возвращает раскладку с фактическими размерами (в авто-режиме — рассчитанными). */
export function resolveLogoLayout(layout: LogoLayout, aspect: number): LogoLayout {
  if (layout.mode !== "auto") return layout;
  const box = autoLogoBox(aspect, layout.align);
  return { ...layout, ...box, offsetX: 0, offsetY: 0 };
}

/**
 * Считает геометрию логотипа в шапке.
 * Реквизиты (бренд/юрлицо/адрес) всегда располагаются ПОД логотипом
 * и выравниваются по горизонтали так же, как логотип.
 * @param aspect отношение ширины к высоте исходного изображения (w/h)
 */
export function computeLogoPlacement(rawLayout: LogoLayout, aspect: number): LogoPlacement {
  const layout = resolveLogoLayout(rawLayout, aspect);
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

/**
 * Кегль реквизитов, подобранный под объём текста и ширину колонки.
 * @param basePt базовый кегль (DOC_FONT_PT.small)
 * @param text строка реквизитов целиком
 * @param widthPt ширина колонки, pt
 */
export function requisitesFontPt(basePt: number, text: string, widthPt = headerColumnWidthPt()): number {
  const chars = (text || "").trim().length;
  if (!chars) return basePt;
  // Приблизительно 0.5·кегля на символ — оцениваем число строк.
  const perLine = Math.max(10, widthPt / (basePt * 0.5));
  const lines = Math.ceil(chars / perLine);
  const scale = lines <= 2 ? 1 : lines === 3 ? 0.92 : 0.85;
  return Math.max(7.5, Math.round(basePt * scale * 10) / 10);
}

/** Коэффициент перевода pt страницы в «пиксели макета» HTML-превью. */
export const LOGO_PT_TO_PX = 1.48;

/** inline-стиль для <img> логотипа в HTML-превью документа. */
export function logoImgStyle(rawLayout: LogoLayout, aspect = 3): string {
  const layout = resolveLogoLayout(rawLayout, aspect);
  const px = (v: number) => `${Math.round(v * LOGO_PT_TO_PX * 10) / 10}px`;
  return [
    "display:inline-block",
    "position:relative",
    "width:auto",
    "height:auto",
    `max-width:min(100%, ${px(layout.maxW)})`,
    `max-height:${px(layout.maxH)}`,
    "object-fit:contain",
    `left:${px(layout.offsetX)}`,
    `top:${px(layout.offsetY)}`,
    `margin-bottom:${px(layout.gap * 0.5)}`,
  ].join(";");
}

/** inline-стиль блока реквизитов под логотипом в HTML-превью. */
export function requisitesStyle(text: string, basePt = 10): string {
  const size = requisitesFontPt(basePt, text);
  return [
    `font-size:${Math.round(size * 10) / 10}px`,
    "line-height:1.35",
    `max-width:${Math.round(headerColumnWidthPt() * LOGO_PT_TO_PX)}px`,
    "overflow-wrap:anywhere",
  ].join(";");
}


/** inline-стиль обёртки логотипа (выравнивание по горизонтали). */
export function logoWrapStyle(layout: LogoLayout): string {
  const align = layout.align === "center" ? "center" : layout.align === "right" ? "right" : "left";
  return `text-align:${align}`;
}
