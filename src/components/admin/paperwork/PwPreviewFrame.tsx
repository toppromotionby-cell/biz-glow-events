// Превью корпоративного документа: лист всегда рисуется в натуральную ширину
// A4 (794 px при 96 dpi) и масштабируется трансформом под ширину панели — так
// он никогда не обрезается и совпадает с PDF. Масштаб пересчитывается при
// изменении размеров панели и повороте экрана.
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DOC_PAGE_H, DOC_PAGE_W, fitScale, type DocFitMode } from "@/lib/documents/fit-scale";

const PAD = 16;

export function PwPreviewFrame({ html, className }: { html: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ w: 640, h: 720 });
  const [sheet, setSheet] = useState({ w: DOC_PAGE_W, h: DOC_PAGE_H });
  const [mode, setMode] = useState<DocFitMode>("width");
  const [zoom, setZoom] = useState(1);

  // Ширину меряем по абсолютному «щупу», а не по самому контейнеру: лист
  // никогда не может раздуть измерение и загнать масштаб в петлю.
  useEffect(() => {
    const el = gaugeRef.current;
    const boxEl = boxRef.current;
    if (!el || !boxEl || typeof ResizeObserver === "undefined") return;
    const read = () => setBox({ w: el.clientWidth, h: boxEl.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    ro.observe(boxEl);
    read();
    window.addEventListener("orientationchange", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  // Реальные размеры содержимого листа: высота — чтобы «страница целиком» и
  // прокрутка считались от документа, ширина — чтобы широкое содержимое
  // (длинные таблицы, подписи) уменьшалось, а не обрезалось справа.
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);
    const w = Math.max(
      doc.body.scrollWidth,
      doc.documentElement?.scrollWidth ?? 0,
      ...Array.from(doc.querySelectorAll<HTMLElement>(".sheet")).map((el) => el.scrollWidth),
    );
    setSheet((prev) => {
      const next = { w: Math.max(DOC_PAGE_W, w || 0), h: Math.max(DOC_PAGE_H, h || 0) };
      return next.w === prev.w && next.h === prev.h ? prev : next;
    });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(measure, 300);
    return () => window.clearTimeout(t);
  }, [html, measure]);

  const { scale } = fitScale({
    boxW: box.w,
    boxH: box.h,
    sheetW: sheet.w,
    sheetH: sheet.h,
    pad: PAD,
    mode,
    zoom,
  });


  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">Превью A4</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Мельче"
            onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Крупнее"
            onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={mode === "width" ? "secondary" : "ghost"}
            className="h-7 w-7"
            title="Вписать по ширине"
            onClick={() => {
              setMode("width");
              setZoom(1);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={mode === "page" ? "secondary" : "ghost"}
            className="h-7 w-7"
            title="Страница целиком"
            onClick={() => {
              setMode("page");
              setZoom(1);
            }}
          >
            <Scan className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div ref={boxRef} className="h-[75vh] overflow-auto bg-muted/40" style={{ padding: PAD }}>
        <div
          style={{
            width: DOC_PAGE_W * scale,
            height: sheetH * scale,
            margin: "0 auto",
          }}
        >
          <iframe
            ref={frameRef}
            title="Превью документа"
            srcDoc={html}
            onLoad={measure}
            sandbox="allow-same-origin"
            style={{
              width: DOC_PAGE_W,
              height: sheetH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
              background: "#fff",
              boxShadow: "0 2px 12px rgba(0,0,0,.12)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
