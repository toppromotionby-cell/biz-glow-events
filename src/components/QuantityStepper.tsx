// Compact qty stepper with − [N unit] + controls. Matches site glass aesthetic.
import { Minus, Plus } from "lucide-react";
import { pluralizeUnit, type QuantityKind } from "@/lib/pricing";

export function QuantityStepper({
  value,
  onChange,
  kind,
  min = 1,
  max = 24,
  label = "Количество",
}: {
  value: number;
  onChange: (n: number) => void;
  kind: QuantityKind;
  min?: number;
  max?: number;
  label?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n) || min));
  const unitLabel = pluralizeUnit(kind, value);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label="Уменьшить"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border/40 text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = e.target.value === "" ? min : Number(e.target.value);
            onChange(clamp(v));
          }}
          className="h-8 w-12 text-center bg-transparent border border-border/40 rounded-md text-sm font-medium tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-primary/60"
        />
        <button
          type="button"
          aria-label="Увеличить"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border/40 text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {unitLabel && (
          <span className="ml-1.5 text-sm text-muted-foreground tabular-nums min-w-[3.5rem]">{unitLabel}</span>
        )}
      </div>
    </div>
  );
}
