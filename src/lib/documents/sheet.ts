/**
 * Лист A4 — единый физический носитель для всех превью и выгрузок документов.
 *
 * Превью рисуется на листе 210 × 297 мм с полями из пресета печати, поэтому
 * ширина контента на экране совпадает с шириной контента в PDF, а разрывы
 * страниц в превью попадают туда же, куда и при печати.
 */
import { BASE_PRINT_PRESET, type DocPrintPreset } from "@/lib/documents/print-preset";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const MM_TO_PX = 96 / 25.4;

/** Ширина/высота области контента листа (мм) с учётом полей пресета. */
export function sheetContentMm(p: DocPrintPreset = BASE_PRINT_PRESET) {
  return {
    width: A4_WIDTH_MM - 2 * p.marginXMm,
    height: A4_HEIGHT_MM - p.marginTopMm - p.marginBottomMm,
  };
}

export const A4_WIDTH_PX = Math.round(A4_WIDTH_MM * MM_TO_PX);
export const A4_HEIGHT_PX = Math.round(A4_HEIGHT_MM * MM_TO_PX);

/**
 * CSS листа: фиксированная ширина A4, поля из пресета, пропорциональное
 * уменьшение целиком на узком экране (вместо «резиновой» вёрстки).
 */
export function sheetCss(p: DocPrintPreset = BASE_PRINT_PRESET): string {
  return `
  html, body { background:#eceef1; }
  body { padding: 16px 0; }
  .sheet {
    width: ${A4_WIDTH_MM}mm;
    min-height: ${A4_HEIGHT_MM}mm;
    margin: 0 auto;
    padding: ${p.marginTopMm}mm ${p.marginXMm}mm ${p.marginBottomMm}mm;
    background: #fff;
    box-shadow: 0 4px 24px rgba(0,0,0,.10);
    hyphens: manual;
    -webkit-hyphens: manual;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .sheet img { max-width: 100%; height: auto; }
  .sheet table { width: 100%; max-width: 100%; table-layout: fixed; }
  .sheet td, .sheet th { min-width: 0; overflow-wrap: break-word; hyphens: manual; -webkit-hyphens: manual; }
  @media screen {
    body { zoom: min(1, calc((100vw - 24px) / ${A4_WIDTH_PX}px)); }
  }
  @media print {
    html, body { background:#fff; }
    body { padding: 0; zoom: 1; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }`;
}
