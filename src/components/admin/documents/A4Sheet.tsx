// Лист A4 в интерфейсе админки: содержимое всегда рисуется в натуральном
// размере страницы 210 × 297 мм с полями документа. Масштабированием
// занимается сцена редактора (`DocCanvasStage`) — собственного зума у листа
// нет, иначе масштаб накладывается дважды и попадания мышью «съезжают».
import { forwardRef, type ReactNode } from "react";
import { A4_HEIGHT_MM, A4_WIDTH_MM, MM_TO_PX } from "@/lib/documents/sheet";
import { BASE_PRINT_PRESET, type DocPrintPreset } from "@/lib/documents/print-preset";

export const A4Sheet = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    preset?: DocPrintPreset;
    onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  }
>(function A4Sheet({ children, preset = BASE_PRINT_PRESET, onDoubleClick }, ref) {
  return (
    <div
      ref={ref}
      onDoubleClick={onDoubleClick}
      style={{
        width: `${A4_WIDTH_MM}mm`,
        minHeight: `${A4_HEIGHT_MM}mm`,
        padding: `${preset.marginTopMm}mm ${preset.marginXMm}mm ${preset.marginBottomMm}mm`,
        margin: "0 auto",
        background: "#fff",
        overflowWrap: "anywhere",
        // «Разлиновка» листов A4 — как в превью документа.
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${A4_HEIGHT_MM * MM_TO_PX}px - 1px), #e2e5ea calc(${A4_HEIGHT_MM * MM_TO_PX}px - 1px), #e2e5ea ${A4_HEIGHT_MM * MM_TO_PX}px)`,
      }}
    >
      {children}
    </div>
  );
});
