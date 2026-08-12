// Умные направляющие и магнитная привязка при перетаскивании блока слайда —
// как в Canva: центр холста, поля, края и центры соседних блоков.
import { GRID, SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";

export type Guide = { axis: "x" | "y"; at: number };

export type SnapResult = { x: number; y: number; guides: Guide[] };

/** Расстояние в координатах холста, на котором срабатывает магнит. */
export const SNAP_TOLERANCE = 10;

/** Опорные линии холста: поля, центры, края. */
export function canvasLines(): { xs: number[]; ys: number[] } {
  return {
    xs: [0, GRID.marginX, SLIDE_W / 2, SLIDE_W - GRID.marginX, SLIDE_W],
    ys: [0, GRID.marginTop, SLIDE_H / 2, SLIDE_H - GRID.footerH, SLIDE_H],
  };
}

function linesOf(rects: Rect[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rects) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w);
    ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { xs, ys };
}

/** Ближайшая линия к одному из «краёв» блока; null — магнита нет. */
function best(
  edges: number[],
  lines: number[],
  tol: number,
): { delta: number; at: number } | null {
  let out: { delta: number; at: number } | null = null;
  for (const line of lines) {
    for (const edge of edges) {
      const delta = line - edge;
      if (Math.abs(delta) > tol) continue;
      if (!out || Math.abs(delta) < Math.abs(out.delta)) out = { delta, at: line };
    }
  }
  return out;
}

/**
 * Притягивает прямоугольник к направляющим холста и соседних блоков.
 * Возвращает скорректированные координаты и линии, которые надо подсветить.
 */
export function snapRect(
  rect: Rect,
  neighbors: Rect[] = [],
  tolerance = SNAP_TOLERANCE,
): SnapResult {
  const canvas = canvasLines();
  const near = linesOf(neighbors);
  const xs = [...canvas.xs, ...near.xs];
  const ys = [...canvas.ys, ...near.ys];

  const hx = best([rect.x, rect.x + rect.w / 2, rect.x + rect.w], xs, tolerance);
  const hy = best([rect.y, rect.y + rect.h / 2, rect.y + rect.h], ys, tolerance);

  const guides: Guide[] = [];
  if (hx) guides.push({ axis: "x", at: hx.at });
  if (hy) guides.push({ axis: "y", at: hy.at });

  return {
    x: rect.x + (hx?.delta ?? 0),
    y: rect.y + (hy?.delta ?? 0),
    guides,
  };
}
