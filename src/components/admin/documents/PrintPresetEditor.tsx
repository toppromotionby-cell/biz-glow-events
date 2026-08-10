// Редактор настроек печати документа: поля страницы, межстрочный интервал,
// плотность блоков и таблицы. Используется в настройках документов (по шаблонам)
// и в редакторе конкретного КП (переопределения).
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  PRINT_PRESET_FIELDS,
  type DocPrintPreset,
} from "@/lib/documents/print-preset";

type Props = {
  value: DocPrintPreset;
  onChange: (next: DocPrintPreset) => void;
  /** Значения, к которым возвращает кнопка «Сбросить». */
  baseline?: DocPrintPreset;
  resetLabel?: string;
  onReset?: () => void;
  hint?: string;
};

const fmt = (key: keyof DocPrintPreset, v: number) =>
  key === "maxPages" ? String(v) : String(Math.round(v * 100) / 100);

export function PrintPresetEditor({ value, onChange, baseline, resetLabel = "Сбросить", onReset, hint }: Props) {
  const isDirty = baseline
    ? PRINT_PRESET_FIELDS.some(({ key }) => value[key] !== baseline[key])
    : false;

  return (
    <div className="space-y-3">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {PRINT_PRESET_FIELDS.map(({ key, limit }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{limit.label}</span>
              <span className="font-medium tabular-nums">
                {fmt(key, value[key])}
                {limit.unit ? ` ${limit.unit}` : ""}
              </span>
            </div>
            <Slider
              value={[value[key]]}
              min={limit.min}
              max={limit.max}
              step={limit.step}
              onValueChange={([v]) => onChange({ ...value, [key]: v })}
              aria-label={limit.label}
            />
          </div>
        ))}
      </div>
      {(onReset || baseline) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!onReset && !isDirty}
          onClick={() => (onReset ? onReset() : baseline && onChange({ ...baseline }))}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
