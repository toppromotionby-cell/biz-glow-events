// Превью корпоративного документа: лист всегда рисуется в натуральную ширину
// A4 (794 px при 96 dpi) и масштабируется трансформом под ширину панели — так
// он никогда не обрезается и совпадает с PDF. Масштаб пересчитывается при
// изменении размеров панели и повороте экрана.
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DOC_PAGE_H, DOC_PAGE_W, fitScale, visibleWidth, type DocFitMode } from "@/lib/documents/fit-scale";

const PAD = 16;

export function PwPreviewFrame({ html, className }: { html: string; className?: string }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ w: 640, h: 720 });
  const [sheetH, setSheetH] = useState(DOC_PAGE_H);
  const [mode, setMode] = useState<DocFitMode>("width");
  const [zoom, setZoom] = useState(1);

  // Ширину меряем по внешней (непрокручиваемой) обёртке и дополнительно
  // ограничиваем реально видимой областью: обёртка может быть шире того, что
  // видно (родитель с overflow:hidden, узкое окно) — тогда масштаб завышается
  // и лист обрезается справа.
  useEffect(() => {
    const shell = shellRef.current;
    const boxEl = boxRef.current;
    if (!shell || !boxEl || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const rect = shell.getBoundingClientRect();
      const parent = shell.parentElement?.getBoundingClientRect();
      const w = visibleWidth({
        clientWidth: Math.min(shell.clientWidth, boxEl.clientWidth || shell.clientWidth),
        left: rect.left,
        right: rect.right,
        viewportWidth: window.innerWidth || rect.width,
        clipLeft: parent?.left,
        clipRight: parent?.right,
      });
      setBox({ w: Math.max(220, w), h: boxEl.clientHeight });
    };
    const ro = new ResizeObserver(read);
    ro.observe(shell);
    ro.observe(boxEl);
    read();
    window.addEventListener("orientationchange", read);
    window.addEventListener("resize", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  // Ширина листа всегда A4: HTML-лист жёстко ограничен 210 мм, поэтому из
  // документа читаем только реальную высоту (многостраничные документы и
  // режим «страница целиком»).
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);
    setSheetH((prev) => {
      const next = Math.max(DOC_PAGE_H, h || 0);
      return Math.abs(next - prev) < 2 ? prev : next;
    });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(measure, 300);
    return () => window.clearTimeout(t);
  }, [html, measure]);

  const sheet = { w: DOC_PAGE_W, h: sheetH };

  const { scale } = fitScale({
    boxW: box.w,
    boxH: box.h,
    sheetW: sheet.w,
    sheetH: sheet.h,
    pad: PAD,
    mode,
    zoom,
    maxBase: 1,
  });



  return (
    <div ref={shellRef} className={className}>
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
      <div ref={boxRef} className="relative h-[75vh] overflow-auto bg-muted/40" style={{ padding: PAD }}>

        <div
          style={{
            width: sheet.w * scale,
            height: sheet.h * scale,
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
              width: sheet.w,
              height: sheet.h,
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
