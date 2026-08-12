// Лист холста в браузере: один и тот же компонент для редактора, миниатюр и
// полноэкранного показа. Масштаб задаётся одним CSS-трансформом, поэтому
// координаты внутри всегда «настоящие» (A4 794×1123 или слайд 1280×720).
import { useMemo } from "react";
import type { CanvasPage as CanvasPageModel } from "@/lib/canvas/model";
import { pageOps } from "@/lib/canvas/ops";
import { CanvasElementView } from "./CanvasElementView";

type Props = {
  page: CanvasPageModel;
  /** Масштаб отображения (1 = 100%). */
  scale?: number;
  className?: string;
};

export function CanvasPage({ page, scale = 1, className }: Props) {
  const ops = useMemo(() => pageOps(page), [page]);
  const { w, h } = page.format;

  return (
    <div
      className={className}
      style={{ width: w * scale, height: h * scale, position: "relative" }}
    >
      <div
        style={{
          width: w,
          height: h,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: page.background ?? "transparent",
          overflow: "hidden",
        }}
      >
        {ops.map((op, i) => (
          <CanvasElementView key={i} op={op} />
        ))}
      </div>
    </div>
  );
}
