// Сцена холста: серый фон вокруг листа, масштаб (зум) и прокрутка при
// увеличении. Слайд всегда по центру, как в Canva.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SLIDE_H, SLIDE_W } from "@/lib/presentations/design";

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export function CanvasStage({
  zoom,
  onFitScale,
  children,
  onBackgroundClick,
}: {
  /** Множитель к масштабу «вписать в окно». */
  zoom: number;
  onFitScale?: (scale: number) => void;
  children: (width: number) => ReactNode;
  onBackgroundClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 960, h: 560 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(
    0.1,
    Math.min((box.w - 72) / SLIDE_W, (box.h - 72) / SLIDE_H),
  );
  useEffect(() => { onFitScale?.(fit); }, [fit, onFitScale]);

  const width = SLIDE_W * fit * zoom;

  return (
    <div
      ref={ref}
      className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-9"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
    >
      <div className="flex min-h-full min-w-full items-center justify-center">
        <div
          className="rounded-xl bg-background shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)] ring-1 ring-border/60"
          style={{ width, height: (SLIDE_H / SLIDE_W) * width }}
        >
          {children(width)}
        </div>
      </div>
    </div>
  );
}
