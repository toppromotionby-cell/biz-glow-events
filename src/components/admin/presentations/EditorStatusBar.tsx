// Нижняя строка редактора: навигация по слайдам, зум и обзор сеткой.
import { ChevronLeft, ChevronRight, Grid3X3, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZOOM_MAX, ZOOM_MIN } from "@/components/admin/presentations/CanvasStage";

export function EditorStatusBar({
  index,
  total,
  zoom,
  onZoom,
  onPrev,
  onNext,
  onGrid,
  hint,
}: {
  index: number;
  total: number;
  zoom: number;
  onZoom: (v: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onGrid: () => void;
  hint?: string;
}) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background px-3 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Предыдущий слайд" disabled={index <= 0} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[74px] text-center text-xs tabular-nums text-muted-foreground">
          {total ? `${index + 1} / ${total}` : "нет слайдов"}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Следующий слайд" disabled={index >= total - 1} onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onGrid}>
          <Grid3X3 className="mr-1.5 h-4 w-4" />Сетка
        </Button>
      </div>

      {hint && <p className="hidden text-xs text-muted-foreground lg:block">{hint}</p>}

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost" size="icon" className="h-8 w-8" aria-label="Уменьшить"
          onClick={() => onZoom(Math.max(ZOOM_MIN, Number((zoom - 0.1).toFixed(2))))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="w-28">
          <Slider
            value={[zoom]}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            onValueChange={([v]) => onZoom(v)}
            aria-label="Масштаб"
          />
        </div>
        <Button
          variant="ghost" size="icon" className="h-8 w-8" aria-label="Увеличить"
          onClick={() => onZoom(Math.min(ZOOM_MAX, Number((zoom + 0.1).toFixed(2))))}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onZoom(1)}>
          <Maximize className="mr-1.5 h-4 w-4" />Вписать
        </Button>
      </div>
    </div>
  );
}
