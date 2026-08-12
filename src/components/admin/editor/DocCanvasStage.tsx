// Рабочая область редактора документов: серый фон, лист по центру, зум.
// Лист всегда рисуется в натуральной ширине A4 и масштабируется трансформом —
// так превью в редакторе совпадает с PDF. Масштаб «вписать» пересчитывается
// от реальных размеров области, поэтому лист сам подстраивается под экран
// устройства (десктоп, планшет, телефон, поворот).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Ширина листа A4 при 96 dpi. */
export const DOC_PAGE_W = 794;
export const DOC_ZOOM_MIN = 0.25;
export const DOC_ZOOM_MAX = 2;
/** Как вписывать лист: по ширине области или страницу целиком. */
export type DocFitMode = "width" | "page";

const PAD = 32;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function DocCanvasStage({
  zoom,
  fitMode = "width",
  onZoom,
  children,
  onBackgroundClick,
}: {
  /** Множитель к масштабу «вписать». */
  zoom: number;
  fitMode?: DocFitMode;
  /** Нужен для зума колесом/пинчем с якорем под курсором. */
  onZoom?: (v: number) => void;
  children: (ctx: { width: number; height: number; scale: number }) => ReactNode;
  onBackgroundClick?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 640 });
  const [sheetH, setSheetH] = useState(1123);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    window.addEventListener("orientationchange", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSheetH(Math.max(200, el.scrollHeight)));
    ro.observe(el);
    setSheetH(Math.max(200, el.scrollHeight));
    return () => ro.disconnect();
  }, []);

  const fitWidth = Math.max(0.15, (box.w - PAD * 2) / DOC_PAGE_W);
  const fitPage = Math.min(fitWidth, Math.max(0.15, (box.h - PAD * 2) / sheetH));
  const base = fitMode === "page" ? fitPage : fitWidth;
  const scale = clamp(base * zoom, 0.1, 4);
  const viewH = Math.max(320, box.h - PAD * 2);

  // Зум колесом (Ctrl/Cmd) и пинчем на тачпаде — с якорем под курсором.
  const stateRef = useRef({ scale, base, zoom });
  stateRef.current = { scale, base, zoom };
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const el = boxRef.current;
      if (!el || !onZoom) return;
      const s = stateRef.current;
      const next = clamp(s.zoom * factor, DOC_ZOOM_MIN, DOC_ZOOM_MAX);
      if (next === s.zoom) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const k = (s.base * next) / s.scale;
      el.scrollLeft = (el.scrollLeft + px) * k - px;
      el.scrollTop = (el.scrollTop + py) * k - py;
      onZoom(Number(next.toFixed(3)));
    },
    [onZoom],
  );
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // обычное колесо — прокрутка
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAtRef.current(Math.exp(-dy * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={boxRef}
      className="scroll-visible relative min-h-0 flex-1 overflow-auto bg-muted/40 p-4 sm:p-8"
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
