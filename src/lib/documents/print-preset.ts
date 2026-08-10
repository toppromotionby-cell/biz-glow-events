/**
 * Настройки печати документов (поля страницы, межстрочный интервал, плотность).
 *
 * Один источник правды для HTML-превью и PDF: пресет задаётся на уровне шаблона
 * (в настройках документов) и может быть переопределён для конкретного КП
 * через `quote.design` (ключи с префиксом `print_`).
 */
import { QUOTE_TEMPLATES, type QuoteTemplate } from "@/lib/quote-blocks";

export type DocPrintPreset = {
  /** Верхнее поле страницы, мм. */
  marginTopMm: number;
  /** Нижнее поле страницы, мм. */
  marginBottomMm: number;
  /** Боковые поля страницы, мм. */
  marginXMm: number;
  /** Межстрочный интервал (как line-height в CSS). */
  lineHeight: number;
  /** Множитель вертикальных отступов между блоками. */
  blockGap: number;
  /** Множитель высоты строк таблицы. */
  rowGap: number;
  /** Множитель кеглей. */
  fontScale: number;
  /** Целевое число листов для автоподбора плотности PDF. */
  maxPages: number;
};

type Limit = { min: number; max: number; step: number; label: string; unit: string; hint?: string };

export const PRINT_PRESET_FIELDS: { key: keyof DocPrintPreset; limit: Limit }[] = [
  { key: "marginTopMm", limit: { min: 5, max: 30, step: 0.5, label: "Верхнее поле", unit: "мм" } },
  { key: "marginBottomMm", limit: { min: 5, max: 30, step: 0.5, label: "Нижнее поле", unit: "мм" } },
  { key: "marginXMm", limit: { min: 5, max: 30, step: 0.5, label: "Боковые поля", unit: "мм" } },
  { key: "lineHeight", limit: { min: 1.05, max: 1.8, step: 0.01, label: "Межстрочный интервал", unit: "" } },
  { key: "blockGap", limit: { min: 0.6, max: 1.6, step: 0.05, label: "Отступы между блоками", unit: "×" } },
  { key: "rowGap", limit: { min: 0.6, max: 1.6, step: 0.05, label: "Высота строк таблицы", unit: "×" } },
  { key: "fontScale", limit: { min: 0.8, max: 1.25, step: 0.01, label: "Масштаб шрифта", unit: "×" } },
  { key: "maxPages", limit: { min: 1, max: 6, step: 1, label: "Цель по листам", unit: "стр." } },
];

const LIMITS = Object.fromEntries(PRINT_PRESET_FIELDS.map((f) => [f.key, f.limit])) as Record<
  keyof DocPrintPreset,
  Limit
>;

export const BASE_PRINT_PRESET: DocPrintPreset = {
  marginTopMm: 12,
  marginBottomMm: 12,
  marginXMm: 12,
  lineHeight: 1.3,
  blockGap: 1,
  rowGap: 1,
  fontScale: 1,
  maxPages: 1,
};

export const DEFAULT_PRINT_PRESETS: Record<QuoteTemplate, DocPrintPreset> = {
  classic: { ...BASE_PRINT_PRESET },
  minimal: { ...BASE_PRINT_PRESET, marginTopMm: 10, marginBottomMm: 10, marginXMm: 10, lineHeight: 1.25, blockGap: 0.9, rowGap: 0.9, fontScale: 0.96 },
  premium: { ...BASE_PRINT_PRESET, marginTopMm: 14, marginBottomMm: 13, marginXMm: 14, lineHeight: 1.36, blockGap: 1.1, rowGap: 1.05, fontScale: 1.02, maxPages: 2 },
};

export const MM_TO_PT = 72 / 25.4;
export const mmToPt = (mm: number) => mm * MM_TO_PT;

function clampField(key: keyof DocPrintPreset, value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const l = LIMITS[key];
  const clamped = Math.min(Math.max(n, l.min), l.max);
  return key === "maxPages" ? Math.round(clamped) : Math.round(clamped * 100) / 100;
}

/** Привести произвольный объект к валидному пресету (недостающее — из base). */
export function normalizePrintPreset(raw: unknown, base: DocPrintPreset = BASE_PRINT_PRESET): DocPrintPreset {
  const src = (raw ?? {}) as Partial<Record<keyof DocPrintPreset, unknown>>;
  const out = { ...base };
  for (const { key } of PRINT_PRESET_FIELDS) {
    if (src[key] != null && src[key] !== "") out[key] = clampField(key, src[key], base[key]);
  }
  return out;
}

/** Пресеты по всем шаблонам (для настроек документов). */
export function normalizePrintPresets(raw: unknown): Record<QuoteTemplate, DocPrintPreset> {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<QuoteTemplate, DocPrintPreset>;
  for (const tpl of QUOTE_TEMPLATES) {
    out[tpl] = normalizePrintPreset(src[tpl], DEFAULT_PRINT_PRESETS[tpl]);
  }
  return out;
}

/** Ключи в `quote.design`, которыми КП переопределяет пресет шаблона. */
export const PRINT_DESIGN_KEYS: Record<keyof DocPrintPreset, string> = {
  marginTopMm: "print_margin_top_mm",
  marginBottomMm: "print_margin_bottom_mm",
  marginXMm: "print_margin_x_mm",
  lineHeight: "print_line_height",
  blockGap: "print_block_gap",
  rowGap: "print_row_gap",
  fontScale: "print_font_scale",
  maxPages: "print_max_pages",
};

type DesignLike = Record<string, unknown> | null | undefined;

/** Есть ли у документа собственные настройки печати. */
export function hasPrintOverrides(design: DesignLike): boolean {
  if (!design) return false;
  return Object.values(PRINT_DESIGN_KEYS).some((k) => design[k] != null && design[k] !== "");
}

/** Частичный пресет из `quote.design`. */
export function printOverridesFromDesign(design: DesignLike): Partial<DocPrintPreset> {
  const out: Partial<DocPrintPreset> = {};
  if (!design) return out;
  for (const { key } of PRINT_PRESET_FIELDS) {
    const v = design[PRINT_DESIGN_KEYS[key]];
    if (v != null && v !== "") out[key] = clampField(key, v, BASE_PRINT_PRESET[key]);
  }
  return out;
}

/** Записать пресет в поля `design` (или очистить их значением null). */
export function printOverridesToDesign(preset: DocPrintPreset | null): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const { key } of PRINT_PRESET_FIELDS) {
    out[PRINT_DESIGN_KEYS[key]] = preset ? preset[key] : undefined;
  }
  return out;
}

/** Итоговый пресет: шаблон → настройки документов → переопределения КП. */
export function resolvePrintPreset(
  template: QuoteTemplate | string | null | undefined,
  presets?: Partial<Record<string, unknown>> | null,
  design?: DesignLike,
): DocPrintPreset {
  const tpl = (QUOTE_TEMPLATES as readonly string[]).includes(String(template))
    ? (template as QuoteTemplate)
    : "classic";
  const base = normalizePrintPreset(presets?.[tpl], DEFAULT_PRINT_PRESETS[tpl]);
  return normalizePrintPreset({ ...base, ...printOverridesFromDesign(design) }, base);
}

/** CSS-строка полей для `@page` (в мм). */
export function printPageMarginCss(p: DocPrintPreset): string {
  return `${p.marginTopMm}mm ${p.marginXMm}mm ${p.marginBottomMm}mm`;
}
