/**
 * Единая спецификация оформления документов (КП, КП промо, счёт, договор, акт).
 *
 * Один источник правды для HTML-превью (`quote-html.ts`, `promo-quote-html.ts`)
 * и для PDF (`pdf.server.ts`), чтобы превью и итоговый файл выглядели одинаково.
 * Размеры заданы в «пикселях макета» (как в HTML) и автоматически переводятся
 * в pt для PDF — так шкалы не могут разъехаться.
 */

/** Фирменная палитра сайта для документов (КП, счёт, договор, акт). */
export const BRAND_ACCENT = "#FF7500";

export const BRAND_ACCENTS: { label: string; hex: string }[] = [
  { label: "Фирменный оранжевый", hex: "#FF7500" },
  { label: "Янтарный", hex: "#FF9400" },
  { label: "Графит", hex: "#111827" },
];

/** Нейтральные цвета документа (HEX, как в HTML-превью). */
export const DOC_COLORS = {
  ink: "#111827",
  body: "#374151",
  muted: "#6b7280",
  line: "#e5e7eb",
  surface: "#fafafa",
  white: "#ffffff",
} as const;

/** Кегли в «пикселях макета» (значения HTML-превью). */
export const DOC_FONT_PX = {
  brand: 17,
  docKind: 8.5,
  docNum: 15,
  docDate: 9.5,
  coverTitle: 17,
  section: 10.5,
  cardLabel: 8,
  cardTitle: 11.5,
  body: 10.5,
  small: 9.5,
  micro: 8.5,
  total: 13,
  footer: 9,
} as const;

/** Коэффициент перевода «пикселей макета» в pt страницы A4. */
export const DOC_PX_TO_PT = 0.92;

type FontScale = Record<keyof typeof DOC_FONT_PX, number>;

/** Те же кегли в pt для pdf-lib. */
export const DOC_FONT_PT: FontScale = Object.fromEntries(
  Object.entries(DOC_FONT_PX).map(([k, v]) => [k, Math.round(v * DOC_PX_TO_PT * 10) / 10]),
) as FontScale;

/** Геометрия страницы и блоков. */
export const DOC_LAYOUT = {
  pageWidthPt: 595.28,
  pageHeightPt: 841.89,
  marginXPt: 34,
  marginTopPt: 34,
  marginBottomPt: 34,
  accentBarPt: 4,
  radiusPx: 10,
  cardPaddingPt: 9,
  qtyColumnPx: 70,
  lineHeight: 1.3,
} as const;

/** #RRGGBB → компоненты 0..1 для pdf-lib. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const int = m ? parseInt(m[1], 16) : 0;
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

/** Смешать цвет с белым: 0 = белый, 1 = исходный цвет. */
export function mixWithWhite(hex: string, ratio: number): { r: number; g: number; b: number } {
  const c = hexToRgb01(hex);
  const k = Math.min(Math.max(ratio, 0), 1);
  return {
    r: c.r * k + (1 - k),
    g: c.g * k + (1 - k),
    b: c.b * k + (1 - k),
  };
}

/** CSS-переменные документа для HTML-превью и HTML-версии файла. */
export function docCssVars(accent: string): string {
  const f = DOC_FONT_PX;
  return [
    `--accent:${accent}`,
    `--ink:${DOC_COLORS.ink}`,
    `--body:${DOC_COLORS.body}`,
    `--muted:${DOC_COLORS.muted}`,
    `--line:${DOC_COLORS.line}`,
    `--surface:${DOC_COLORS.surface}`,
    `--fs-brand:${f.brand}px`,
    `--fs-doc-kind:${f.docKind}px`,
    `--fs-doc-num:${f.docNum}px`,
    `--fs-doc-date:${f.docDate}px`,
    `--fs-cover:${f.coverTitle}px`,
    `--fs-section:${f.section}px`,
    `--fs-card-label:${f.cardLabel}px`,
    `--fs-card-title:${f.cardTitle}px`,
    `--fs-body:${f.body}px`,
    `--fs-small:${f.small}px`,
    `--fs-micro:${f.micro}px`,
    `--fs-total:${f.total}px`,
    `--fs-footer:${f.footer}px`,
    `--qty-col:${DOC_LAYOUT.qtyColumnPx}px`,
  ].join("; ");
}
