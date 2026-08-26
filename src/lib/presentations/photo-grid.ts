// Автоматические фотораскладки слайда: от 1 до 15 кадров.
//
// Один источник правды для превью, PDF и PPTX: чистая функция получает
// прямоугольник фотоблока и число снимков, а возвращает готовые рамки.
// Паттерны — герой, асимметричный split, bento-сетка, мозаика и контактный
// лист — выбираются автоматически по количеству фото и пропорциям области.
import type { Rect } from "@/lib/presentations/design";

/** Минимальный «живой» размер кадра: мельче — уже визуальный мусор. */
export const MIN_FRAME_W = 96;
export const MIN_FRAME_H = 72;

export type PhotoGridOptions = { gap?: number };

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/**
 * Равномерная сетка с добором последнего ряда: оставшиеся кадры
 * растягиваются на всю ширину, поэтому дыр в композиции не бывает.
 */
function uniformGrid(box: Rect, count: number, cols: number, g: number): Rect[] {
  const rows = Math.ceil(count / cols);
  const h = (box.h - g * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, count - row * cols);
    const w = (box.w - g * (inRow - 1)) / inRow;
    for (let i = 0; i < inRow; i++) {
      out.push(r(box.x + i * (w + g), box.y + row * (h + g), w, h));
    }
  }
  return out;
}

/** Bento: крупный кадр 2×2 в углу, остальные — модулями вокруг него. */
function bentoGrid(box: Rect, count: number, cols: number, g: number): Rect[] | null {
  const rows = Math.ceil((count + 3) / cols);
  if (rows < 2 || cols < 3) return null;
  // Свободные ячейки должны ровно совпасть с числом оставшихся фото.
  if (cols * rows - 4 !== count - 1) return null;
  const cw = (box.w - g * (cols - 1)) / cols;
  const ch = (box.h - g * (rows - 1)) / rows;
  const cell = (c: number, row: number) => r(box.x + c * (cw + g), box.y + row * (ch + g), cw, ch);
  const hero = r(box.x, box.y, cw * 2 + g, ch * 2 + g);
  const rest: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      if (row < 2 && c < 2) continue;
      rest.push(cell(c, row));
    }
  }
  return [hero, ...rest];
}

/** Оценка качества: чем крупнее самый мелкий кадр, тем лучше композиция. */
const score = (frames: Rect[]): number =>
  Math.min(...frames.map((f) => Math.min(f.w / MIN_FRAME_W, f.h / MIN_FRAME_H)));

/** Фиксированные «авторские» раскладки для 2–5 кадров (историческое поведение). */
function classic(box: Rect, count: number, g: number): Rect[] | null {
  const portrait = box.h >= box.w;
  if (count === 2) {
    if (portrait) {
      const h = (box.h - g) / 2;
      return [r(box.x, box.y, box.w, h), r(box.x, box.y + h + g, box.w, h)];
    }
    const w = (box.w - g) / 2;
    return [r(box.x, box.y, w, box.h), r(box.x + w + g, box.y, w, box.h)];
  }
  if (count === 3) {
    if (portrait) {
      const hero = (box.h - g) * 0.6;
      const rest = box.h - g - hero;
      const w = (box.w - g) / 2;
      return [
        r(box.x, box.y, box.w, hero),
        r(box.x, box.y + hero + g, w, rest),
        r(box.x + w + g, box.y + hero + g, w, rest),
      ];
    }
    const hero = (box.w - g) * 0.58;
    const rest = box.w - g - hero;
    const h = (box.h - g) / 2;
    return [
      r(box.x, box.y, hero, box.h),
      r(box.x + hero + g, box.y, rest, h),
      r(box.x + hero + g, box.y + h + g, rest, h),
    ];
  }
  if (count === 4) {
    const w = (box.w - g) / 2;
    const h = (box.h - g) / 2;
    return [
      r(box.x, box.y, w, h),
      r(box.x + w + g, box.y, w, h),
      r(box.x, box.y + h + g, w, h),
      r(box.x + w + g, box.y + h + g, w, h),
    ];
  }
  if (count === 5) {
    if (portrait) {
      const hero = (box.h - g) * 0.62;
      const rest = box.h - g - hero;
      const w = (box.w - g * 3) / 4;
      return [
        r(box.x, box.y, box.w, hero),
        ...[0, 1, 2, 3].map((i) => r(box.x + i * (w + g), box.y + hero + g, w, rest)),
      ];
    }
    const hero = (box.w - g) * 0.6;
    const rest = box.w - g - hero;
    const h = (box.h - g * 3) / 4;
    return [
      r(box.x, box.y, hero, box.h),
      ...[0, 1, 2, 3].map((i) => r(box.x + hero + g, box.y + i * (h + g), rest, h)),
    ];
  }
  return null;
}

/**
 * Рамки под `count` фотографий внутри области `box`.
 * Всегда возвращает ровно `count` прямоугольников, не выходящих за границы.
 */
export function photoFrames(box: Rect, count: number, opts: PhotoGridOptions = {}): Rect[] {
  const g = opts.gap ?? 16;
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  if (n === 1) return [box];

  const fixed = classic(box, n, g);
  if (fixed) return fixed;

  const portrait = box.h >= box.w;
  // Кандидаты: узкая колонка тяготеет к 2 столбцам, широкая — к 3–5.
  const candidates = portrait ? [2, 3, 1] : [3, 4, 5, 2];
  let best: Rect[] | null = null;
  let bestScore = -Infinity;
  for (const cols of candidates) {
    if (cols > n) continue;
    for (const frames of [bentoGrid(box, n, cols, g), uniformGrid(box, n, cols, g)]) {
      if (!frames) continue;
      const s = score(frames);
      // Bento при равном качестве выигрывает: он идёт первым в списке.
      if (s > bestScore + 0.0001) {
        bestScore = s;
        best = frames;
      }
    }
  }
  return best ?? uniformGrid(box, n, Math.min(n, portrait ? 2 : 4), g);
}
