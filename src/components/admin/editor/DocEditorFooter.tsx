// Нижняя строка редактора документа: зум, подсказка и дополнительные кнопки.
import type { ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DOC_ZOOM_MAX, DOC_ZOOM_MIN } from "@/components/admin/editor/DocCanvasStage";

export function DocEditorFooter({
  zoom,
  onZoom,
  hint,
  left,
}: {
  zoom: number;
  onZoom: (v: number) => void;
  hint?: string;
  left?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background px-3 py-2">
      <div className="flex items-center gap-2">{left}</div>

      {hint && <p className="hidden text-xs text-muted-foreground lg:block">{hint}</p>}

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost" size="icon" className="h-8 w-8" aria-label="Уменьшить"
          onClick={() => onZoom(Math.max(DOC_ZOOM_MIN, Number((zoom - 0.1).toFixed(2))))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="w-28">
          <Slider
            value={[zoom]} min={DOC_ZOOM_MIN} max={DOC_ZOOM_MAX} step={0.05}
            onValueChange={([v]) => onZoom(v)} aria-label="Масштаб"
          />
        </div>
        <Button
          variant="ghost" size="icon" className="h-8 w-8" aria-label="Увеличить"
          onClick={() => onZoom(Math.min(DOC_ZOOM_MAX, Number((zoom + 0.1).toFixed(2))))}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onZoom(1)}>
          <Maximize className="mr-1.5 h-4 w-4" />Вписать
        </Button>
      </div>
    </div>
  );
}
