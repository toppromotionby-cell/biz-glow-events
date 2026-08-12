// Лист A4 в интерфейсе админки: содержимое всегда рисуется на странице
// 210 × 297 мм с полями документа и пропорционально уменьшается под ширину
// панели, поэтому превью в редакторе совпадает с превью в окне и с PDF.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { A4_HEIGHT_MM, A4_WIDTH_MM, A4_WIDTH_PX, MM_TO_PX } from "@/lib/documents/sheet";
import { BASE_PRINT_PRESET, type DocPrintPreset } from "@/lib/documents/print-preset";

export function A4Sheet({
  children,
  preset = BASE_PRINT_PRESET,
  onDoubleClick,
}: {
  children: ReactNode;
  preset?: DocPrintPreset;
  onDoubleClick?: (e: React.MouseEvent) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / A4_WIDTH_PX));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        onDoubleClick={onDoubleClick}
        style={{
          zoom: scale,
          width: `${A4_WIDTH_MM}mm`,
          minHeight: `${A4_HEIGHT_MM}mm`,
          padding: `${preset.marginTopMm}mm ${preset.marginXMm}mm ${preset.marginBottomMm}mm`,
          margin: "0 auto",
          background: "#fff",
          boxShadow: "0 2px 14px rgba(0,0,0,.10)",
          overflowWrap: "anywhere",
          // «Разлиновка» листов A4 — как в превью документа.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${A4_HEIGHT_MM * MM_TO_PX}px - 1px), #e2e5ea calc(${A4_HEIGHT_MM * MM_TO_PX}px - 1px), #e2e5ea ${A4_HEIGHT_MM * MM_TO_PX}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
