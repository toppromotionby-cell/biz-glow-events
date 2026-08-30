// Подгонка корпоративного документа под один лист A4.
//
// Логика одна на все три рендера (превью, PDF, DOCX): по содержимому блоков
// оценивается высота документа в пунктах, и если он «почти влезает» на одну
// страницу — кегль и вертикальные поля слегка ужимаются. Сильнее MIN_FIT_K
// и ниже MIN_FONT_PT не жмём: лучше честная вторая страница, чем нечитаемый
// документ.
import type { PwBlank, PwBlock } from "./model";

/** Высота листа A4 в пунктах. */
export const PAGE_H_PT = 841.89;
/** Ширина листа A4 в пунктах. */
export const PAGE_W_PT = 595.28;
const MM = 2.834645669;

/** Минимальный коэффициент сжатия (не более ~15%). */
export const MIN_FIT_K = 0.85;
/** Минимальный кегль после сжатия. */
export const MIN_FONT_PT = 8;
/** Минимальное вертикальное поле после сжатия, мм. */
export const MIN_MARGIN_MM = 10;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Размер листа в пунктах с учётом ориентации. */
export function pageSizePt(landscape = false): { w: number; h: number } {
  return landscape ? { w: PAGE_H_PT, h: PAGE_W_PT } : { w: PAGE_W_PT, h: PAGE_H_PT };
}

export function contentWidthPt(blank: PwBlank, landscape = false): number {
  return pageSizePt(landscape).w - blank.marginXMm * 2 * MM;
}

/** Сколько строк займёт текст указанным кеглем в колонке шириной widthPt. */
function lineCount(text: string, sizePt: number, widthPt: number): number {
  const perLine = Math.max(8, Math.floor(widthPt / (sizePt * 0.5)));
  return (text || "")
    .split("\n")
    .reduce((acc, l) => acc + Math.max(1, Math.ceil(l.trim().length / perLine)), 0);
}

/** Приблизительная высота шапки (лого, реквизиты, номер и дата). */
export function headerReservePt(blank: PwBlank): number {
  const head = blank.headerLayout === "none" ? 8 : blank.headerRequisites ? 74 : 46;
  return head + blank.fontSizePt * 2.2 + 8;
}

/** Оценка высоты содержимого документа в пунктах. */
export function estimateContentHeightPt(blocks: PwBlock[], blank: PwBlank, landscape = false): number {
  const w = contentWidthPt(blank, landscape);
  const base = blank.fontSizePt;
  let h = headerReservePt(blank);
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        h += 10 + lineCount(b.text, base + 2.5, w) * (base + 2.5) * 1.45 + 4;
        break;
      case "recipient":
        h += lineCount(b.text, base - 0.5, w) * (base - 0.5) * 1.45 + 8;
        break;
      case "note":
        h += lineCount(b.text, base - 1.5, w - 16) * Math.max(8, base - 1.5) * 1.4 + 20;
        break;
      case "list":
        h += b.items.reduce((a, it) => a + lineCount(it, base, w - 24) * base * 1.42, 0) + 6;
        break;
      case "table": {
        const cols = Math.max(1, b.header.length || (b.rows[0]?.length ?? 1));
        const cw = w / cols;
        const size = Math.max(8, base - 1);
        const rowH = (cells: string[]) =>
          Math.max(...cells.map((c) => lineCount(String(c ?? ""), size, cw - 12))) * size * 1.35 + 8;
        h += (b.header.length ? rowH(b.header) : 0) + b.rows.reduce((a, r) => a + rowH(r), 0) + 12;
        break;
      }
      case "lineitems": {
        const size = Math.max(8, base - 1);
        h += (b.lines.length + 1) * (size * 1.35 + 8) + 12;
        h += (b.vatPct > 0 ? 3 : 2) * Math.max(8, base - 0.5) * 1.5;
        if (b.totalWords) h += Math.max(8, base - 1) * 1.6;
        h += 6;
        break;
      }
      case "parties": {
        const size = Math.max(8, base - 1);
        const colW = (w - 8 * MM) / 2;
        const left = lineCount(`${b.leftTitle}\n${b.leftText}`, size, colW);
        const right = lineCount(`${b.rightTitle}\n${b.rightText}`, size, colW);
        h += Math.max(left, right) * size * 1.4 + 8;
        break;
      }
      case "signature":
        h += base * 1.6 + 22;
        break;
      case "spacer":
        h += b.size;
        break;
      default:
        h += lineCount(b.text, base, w) * base * 1.45 + 12;
    }
  }
  return h;
}

/** Свободная высота одной страницы под содержимое. */
export function availableHeightPt(blank: PwBlank, landscape = false): number {
  return pageSizePt(landscape).h - (blank.marginTopMm + blank.marginBottomMm) * MM;
}

/**
 * Коэффициент подгонки: 1 — без сжатия. Возвращает < 1 только когда документ
 * реально помещается на один лист после допустимого сжатия.
 */
export function pickFitFactor(blocks: PwBlock[], blank: PwBlank, landscape = false): number {
  if (blank.fitOnePage === false) return 1;
  const need = estimateContentHeightPt(blocks, blank, landscape);
  const avail = availableHeightPt(blank, landscape);
  if (need <= avail) return 1;
  const raw = avail / need;
  const floorByFont = MIN_FONT_PT / blank.fontSizePt;
  const limit = Math.max(MIN_FIT_K, floorByFont);
  if (raw < limit) return 1; // всё равно не влезет — верстаем на несколько страниц
  // небольшой запас, чтобы оценка не промахнулась в плюс
  return Math.max(limit, round1(raw * 100 - 2) / 100);
}

/** Бланк со сжатым кеглем и полями. */
export function shrinkBlank(blank: PwBlank, k: number): PwBlank {
  if (k >= 1) return blank;
  return {
    ...blank,
    fontSizePt: Math.max(MIN_FONT_PT, round1(blank.fontSizePt * k)),
    marginTopMm: Math.max(MIN_MARGIN_MM, round1(blank.marginTopMm * k)),
    marginBottomMm: Math.max(MIN_MARGIN_MM, round1(blank.marginBottomMm * k)),
  };
}

/** Готовый бланк для рендера: сразу с подгонкой под один лист. */
export function fittedBlank(blocks: PwBlock[], blank: PwBlank, landscape = false): PwBlank {
  return shrinkBlank(blank, pickFitFactor(blocks, blank, landscape));
}

/** Шаги дополнительного сжатия для PDF, если реальная вёрстка не влезла. */
export const PDF_FIT_STEPS = [0.97, 0.94, 0.91, 0.88, MIN_FIT_K] as const;
