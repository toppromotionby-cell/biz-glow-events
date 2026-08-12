// Описание «умных зон» слайда: куда можно поставить фото, текст, блок цены и
// логотипы, и как по точке на холсте выбрать ближайшую допустимую зону.
// Общий модуль для drag-логики в редакторе и для тестов.
import { GRID, SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { LogoZone, PhotoZone, PriceZone, TextZone } from "@/lib/presentations/model";

export type ZoneDef<T extends string> = { id: T; label: string; rect: Rect };

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Квадрат расстояния от точки до прямоугольника (0 — точка внутри). */
function distToRect(r: Rect, p: { x: number; y: number }): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return dx * dx + dy * dy;
}

/**
 * Ближайшая зона к точке. Сначала попадание внутрь зоны (крупная «мишень»),
 * при равенстве — та, чей центр ближе. Так промахнуться почти невозможно.
 */
export function nearestZone<T extends string>(
  zones: ZoneDef<T>[],
  point: { x: number; y: number },
): ZoneDef<T> {
  let best = zones[0];
  let bestD = Number.POSITIVE_INFINITY;
  let bestC = Number.POSITIVE_INFINITY;
  for (const z of zones) {
    const d = distToRect(z.rect, point);
    const c = center(z.rect);
    const cd = (c.x - point.x) ** 2 + (c.y - point.y) ** 2;
    if (d < bestD || (d === bestD && cd < bestC)) {
      bestD = d;
      bestC = cd;
      best = z;
    }
  }
  return best;
}


export function photoZones(): ZoneDef<Exclude<PhotoZone, "auto">>[] {
  const half = SLIDE_W * 0.42;
  return [
    { id: "left", label: "Фото слева", rect: { x: 0, y: 0, w: half, h: SLIDE_H } },
    { id: "right", label: "Фото справа", rect: { x: SLIDE_W - half, y: 0, w: half, h: SLIDE_H } },
    { id: "top", label: "Фото сверху", rect: { x: GRID.marginX, y: 0, w: SLIDE_W - GRID.marginX * 2, h: 280 } },
    { id: "full", label: "Фото на весь слайд", rect: { x: SLIDE_W * 0.3, y: SLIDE_H * 0.42, w: SLIDE_W * 0.4, h: SLIDE_H * 0.3 } },
  ];
}

export function textZones(): ZoneDef<Exclude<TextZone, "auto">>[] {
  const top = GRID.marginTop;
  const h = (SLIDE_H - GRID.marginTop - GRID.footerH) / 3;
  return [
    { id: "top", label: "Текст сверху", rect: { x: 0, y: top, w: SLIDE_W, h } },
    { id: "center", label: "Текст по центру", rect: { x: 0, y: top + h, w: SLIDE_W, h } },
    { id: "bottom", label: "Текст снизу", rect: { x: 0, y: top + h * 2, w: SLIDE_W, h } },
  ];
}

export function priceZones(): ZoneDef<Exclude<PriceZone, "auto">>[] {
  return [
    { id: "under-text", label: "Под текстом", rect: { x: GRID.marginX, y: SLIDE_H * 0.5, w: 320, h: 90 } },
    { id: "corner", label: "В правом нижнем углу", rect: { x: SLIDE_W - 360, y: SLIDE_H - 200, w: 300, h: 90 } },
    { id: "beside-photo", label: "Правый верхний угол", rect: { x: SLIDE_W - 360, y: GRID.marginTop, w: 300, h: 90 } },
  ];
}

export function logoZones(): ZoneDef<Exclude<LogoZone, "auto" | "hero">>[] {
  const w = 260;
  const h = 120;
  return [
    { id: "tl", label: "Верх слева", rect: { x: 0, y: 0, w, h } },
    { id: "tr", label: "Верх справа", rect: { x: SLIDE_W - w, y: 0, w, h } },
    { id: "bl", label: "Низ слева", rect: { x: 0, y: SLIDE_H - h - 60, w, h } },
    { id: "br", label: "Низ справа", rect: { x: SLIDE_W - w, y: SLIDE_H - h - 60, w, h } },
    { id: "footer", label: "Футер", rect: { x: SLIDE_W / 2 - w / 2, y: SLIDE_H - 60, w, h: 60 } },
  ];
}
