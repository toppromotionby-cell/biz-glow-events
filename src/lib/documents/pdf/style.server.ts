// Единая шкала PDF-документов: цвета, размеры листа и метрики (кегли,
// интервалы, поля). Метрики изменяемые — их пересчитывает `applyDensity`
// перед сборкой документа, поэтому все модули читают их через объект `M`.
import { rgb } from "pdf-lib";
import { BRAND_ACCENT, DOC_COLORS, DOC_FONT_PT, DOC_LAYOUT, hexToRgb01, mixWithWhite } from "@/lib/documents/brand";
import { BASE_PRINT_PRESET, mmToPt, type DocPrintPreset } from "@/lib/documents/print-preset";
import { DOC_DENSITY_SCALE, type DocDensity } from "@/lib/documents/density";

export const c01 = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);

export const ACCENT = c01(hexToRgb01(BRAND_ACCENT));
export const ACCENT_SOFT = c01(mixWithWhite(BRAND_ACCENT, 0.12));   // фон шапки таблицы / итога
export const ACCENT_BORDER = c01(mixWithWhite(BRAND_ACCENT, 0.4));  // рамка блока итогов
export const TEXT = c01(hexToRgb01(DOC_COLORS.ink));
export const MUTED = c01(hexToRgb01(DOC_COLORS.muted));
export const LINE = c01(hexToRgb01(DOC_COLORS.line));
export const SURFACE = c01(hexToRgb01(DOC_COLORS.surface));

// A4 в pt (72 dpi)
export const PAGE_W = DOC_LAYOUT.pageWidthPt;
export const PAGE_H = DOC_LAYOUT.pageHeightPt;

/** Изменяемые метрики документа (поля, интервалы, кегли). */
export const M = {
  MARGIN_X: DOC_LAYOUT.marginXPt,
  MARGIN_TOP: DOC_LAYOUT.marginTopPt,
  MARGIN_BOTTOM: DOC_LAYOUT.marginBottomPt,

  // Межстрочные интервалы и множители отступов — задаются пресетом печати.
  LH: DOC_LAYOUT.lineHeight,                     // базовый интервал (таблица, плотный текст)
  LH_TEXT: DOC_LAYOUT.lineHeight + 0.05,         // обычный текст
  LH_LOOSE: DOC_LAYOUT.lineHeight + 0.15,        // абзацы / карточки
  LH_TOTAL: DOC_LAYOUT.lineHeight + 0.2,         // строки блока «итого»
  LH_TIGHT: Math.max(1.05, DOC_LAYOUT.lineHeight - 0.1), // крупные заголовки
  GAP_K: 1,                                      // множитель отступов между блоками
  ROW_K: 1,                                      // множитель высоты строк таблицы
  FONT_K: 1,                                     // множитель кеглей
  /** Текущий множитель плотности (отступы, высоты строк). */
  D: 1,

  F11: DOC_FONT_PT.small,
  F12: DOC_FONT_PT.body,
  F13: DOC_FONT_PT.section,
  F16: DOC_FONT_PT.total,
  F22: DOC_FONT_PT.brand,
  F_COVER: DOC_FONT_PT.coverTitle,
  F_DOC_KIND: DOC_FONT_PT.docKind,
  F_DOC_NUM: DOC_FONT_PT.docNum,
  F_DOC_DATE: DOC_FONT_PT.docDate,
  F_LABEL: DOC_FONT_PT.cardLabel,
  F_FOOTER: DOC_FONT_PT.footer,
};

/** Пересчитать шкалу кеглей и отступов под выбранную плотность. */
export function applyDensity(density: DocDensity, preset: DocPrintPreset = BASE_PRINT_PRESET) {
  const k = DOC_DENSITY_SCALE[density];
  M.D = k;
  M.MARGIN_X = mmToPt(preset.marginXMm);
  M.MARGIN_TOP = mmToPt(preset.marginTopMm);
  M.MARGIN_BOTTOM = mmToPt(preset.marginBottomMm);
  M.LH = preset.lineHeight;
  M.LH_TEXT = M.LH + 0.05;
  M.LH_LOOSE = M.LH + 0.15;
  M.LH_TOTAL = M.LH + 0.2;
  M.LH_TIGHT = Math.max(1.05, M.LH - 0.1);
  M.GAP_K = preset.blockGap;
  M.ROW_K = preset.rowGap;
  M.FONT_K = preset.fontScale;
  const s = (v: number) => Math.round(v * (0.5 + k / 2) * M.FONT_K * 10) / 10; // кегли ужимаем мягче отступов
  M.F11 = s(DOC_FONT_PT.small);
  M.F12 = s(DOC_FONT_PT.body);
  M.F13 = s(DOC_FONT_PT.section);
  M.F16 = s(DOC_FONT_PT.total);
  M.F22 = s(DOC_FONT_PT.brand);
  M.F_COVER = s(DOC_FONT_PT.coverTitle);
  M.F_DOC_KIND = s(DOC_FONT_PT.docKind);
  M.F_DOC_NUM = s(DOC_FONT_PT.docNum);
  M.F_DOC_DATE = s(DOC_FONT_PT.docDate);
  M.F_LABEL = s(DOC_FONT_PT.cardLabel);
  M.F_FOOTER = s(DOC_FONT_PT.footer);
}
