// Рабочая область редактора документов: серый фон, лист по центру, зум.
// Лист всегда рисуется в натуральной ширине A4 и масштабируется трансформом —
// так превью в редакторе совпадает с PDF.
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Ширина листа A4 при 96 dpi. */
export const DOC_PAGE_W = 794;
export const DOC_ZOOM_MIN = 0.4;
export const DOC_ZOOM_MAX = 2;

export function DocCanvasStage({
  zoom,
  children,
  onBackgroundClick,
}: {
  /** Множитель к масштабу «вписать по ширине». */
  zoom: number;
  children: (ctx: { width: number; height: number; scale: number }) => ReactNode;
  onBackgroundClick?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 640 });
  const [sheetH, setSheetH] = useState(1123);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetH(Math.max(200, el.scrollHeight)));
    ro.observe(el);
    setSheetH(Math.max(200, el.scrollHeight));
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(0.2, Math.min(1.4, (box.w - 64) / DOC_PAGE_W));
  const scale = fit * zoom;
  const viewH = Math.max(320, box.h - 64);

  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-8"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
    >
      <div className="mx-auto" style={{ width: DOC_PAGE_W * scale, height: sheetH * scale }}>
        <div
          ref={sheetRef}
          className="rounded-lg bg-background shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)] ring-1 ring-border/60"
          style={{ width: DOC_PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children({ width: DOC_PAGE_W, height: viewH / scale, scale })}
        </div>
      </div>
    </div>
  );
}
