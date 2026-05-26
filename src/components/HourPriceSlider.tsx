// Hour-based price slider with live total.
// Used in catalog quick view & detail when item pricing is hour-tiered.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { PriceTableView } from "@/components/PriceTable";
import { formatBYNTotal, pluralizeUnit, priceForHours, type HourPricing } from "@/lib/pricing";

export function HourPriceSlider({
  pricing,
  hours,
  onChange,
  rawPricing,
}: {
  pricing: HourPricing;
  hours: number;
  onChange: (h: number) => void;
  rawPricing: unknown;
}) {
  const { minHours, maxHours, popularHours, points } = pricing;
  const total = useMemo(() => priceForHours(pricing, hours), [pricing, hours]);
  const [showTable, setShowTable] = useState(false);

  // Keep value within bounds when pricing changes
  useEffect(() => {
    if (hours < minHours) onChange(minHours);
    else if (hours > maxHours) onChange(maxHours);
  }, [minHours, maxHours, hours, onChange]);

  const clamp = (n: number) => Math.max(minHours, Math.min(maxHours, n));
  const isPopular = popularHours !== null && hours === popularHours;

  // Build tick marks (start, popular, last tier, max)
  const ticks = useMemo(() => {
    const set = new Set<number>();
    set.add(minHours);
    if (popularHours) set.add(popularHours);
    if (points.length > 0) set.add(points[points.length - 1].hours);
    set.add(maxHours);
    return Array.from(set).sort((a, b) => a - b);
  }, [minHours, maxHours, popularHours, points]);

  return (
    <div className="space-y-3">
      {/* Total + breakdown */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-display font-bold tabular-nums leading-none">
            {formatBYNTotal(total)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {hours} {pluralizeUnit("hour", hours)}
          </div>
        </div>
        {isPopular && (
          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
            Популярный
          </span>
        )}
      </div>

      {/* Slider + steppers */}
      {minHours !== maxHours && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(clamp(hours - 1))}
              disabled={hours <= minHours}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Уменьшить"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1 px-1">
              <Slider
                value={[hours]}
                min={minHours}
                max={maxHours}
                step={1}
                onValueChange={(v) => onChange(clamp(v[0] ?? minHours))}
                aria-label="Количество часов"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(clamp(hours + 1))}
              disabled={hours >= maxHours}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Увеличить"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative h-4 px-1 text-[10px] text-muted-foreground select-none">
            {ticks.map((t) => {
              const pct = ((t - minHours) / (maxHours - minHours)) * 100;
              const isP = t === popularHours;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange(t)}
                  className={`absolute -translate-x-1/2 hover:text-foreground transition ${isP ? "text-accent font-semibold" : ""} ${hours === t ? "text-foreground font-semibold" : ""}`}
                  style={{ left: `${pct}%` }}
                >
                  {t}ч
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible price table */}
      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showTable ? "rotate-180" : ""}`} />
        {showTable ? "Скрыть тарифную сетку" : "Подробная тарифная сетка"}
      </button>
      {showTable && <PriceTableView pricing={rawPricing} />}
    </div>
  );
}
