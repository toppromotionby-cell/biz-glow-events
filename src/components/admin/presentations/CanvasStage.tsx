// Сцена холста: серый фон вокруг листа, масштаб (зум) и прокрутка при
// увеличении. Слайд всегда по центру, как в Canva.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SLIDE_H, SLIDE_W } from "@/lib/presentations/design";

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export function CanvasStage({
  zoom,
  onFitScale,
  onZoom,
  children,
  onBackgroundClick,
}: {
  /** Множитель к масштабу «вписать в окно». */
  zoom: number;
  onFitScale?: (scale: number) => void;
  /** Зум колесом с Ctrl/Cmd и пинчем — с якорем под курсором. */
  onZoom?: (v: number) => void;
  children: (width: number) => ReactNode;
  onBackgroundClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 960, h: 560 });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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

  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cb = onZoomRef.current;
      if (!cb) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * Math.exp(-dy * 0.0015)));
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / zoomRef.current;
      el.scrollLeft = (el.scrollLeft + px) * k - px;
      el.scrollTop = (el.scrollTop + py) * k - py;
      cb(Number(next.toFixed(3)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const width = SLIDE_W * fit * zoom;

  return (
    <div
      ref={ref}
      className="scroll-visible relative min-h-0 flex-1 overflow-auto bg-muted/40 p-4 sm:p-9"
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
