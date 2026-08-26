// Единые правила кадрирования фотографий слайда.
//
// Один и тот же расчёт использует превью (CSS object-fit/object-position),
// PDF (pdf-lib) и любой будущий экспорт, поэтому кроп не расходится.
import type { Rect } from "@/lib/presentations/design";

/** Как фото заполняет рамку. */
export type PhotoFit = "cover" | "contain";
/** Куда «прижимается» кадр при обрезке. */
export type PhotoAnchor = "center" | "top" | "faces" | "bottom";

export const PHOTO_FITS: PhotoFit[] = ["cover", "contain"];
export const PHOTO_ANCHORS: PhotoAnchor[] = ["center", "top", "faces", "bottom"];

export const PHOTO_FIT_LABELS: Record<PhotoFit, string> = {
  cover: "Заполнить (обрезать)",
  contain: "Вписать целиком",
};

export const PHOTO_ANCHOR_LABELS: Record<PhotoAnchor, string> = {
  center: "По центру",
  top: "По верхнему краю",
  faces: "По лицам (верхняя треть)",
  bottom: "По нижнему краю",
};

/** Доля кадра по вертикали, вокруг которой центрируем обрезку. */
export function anchorRatio(anchor: PhotoAnchor): number {
  return anchor === "top" ? 0 : anchor === "faces" ? 0.28 : anchor === "bottom" ? 1 : 0.5;
}

/** CSS object-position для превью — то же правило, что и в PDF. */
export function cssObjectPosition(anchor: PhotoAnchor): string {
  return `50% ${Math.round(anchorRatio(anchor) * 100)}%`;
}

/**
 * Прямоугольник отрисовки изображения внутри рамки (в координатах холста,
 * ось Y вниз). При `cover` лишнее обрезается рамкой, при `contain` кадр
 * вписывается целиком и центрируется.
 */
export function photoDrawRect(
  frame: Rect,
  imgW: number,
  imgH: number,
  fit: PhotoFit = "cover",
  anchor: PhotoAnchor = "center",
): Rect {
  if (!(imgW > 0) || !(imgH > 0)) return frame;
  const k = fit === "contain"
    ? Math.min(frame.w / imgW, frame.h / imgH)
    : Math.max(frame.w / imgW, frame.h / imgH);
  const w = imgW * k;
  const h = imgH * k;
  const x = frame.x + (frame.w - w) / 2;
  const y = fit === "contain"
    ? frame.y + (frame.h - h) / 2
    : frame.y + (frame.h - h) * anchorRatio(anchor);
  return { x, y, w, h };
}
