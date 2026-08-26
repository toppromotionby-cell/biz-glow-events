// Поле себестоимости позиции: сумма за единицу или процент от цены.
// Внутренние данные — в клиентские документы не попадают.
import { NumField } from "@/components/admin/field-kit";
import { Button } from "@/components/ui/button";
import { costInputValue, costModePatch, costValuePatch, normalizeCostMode } from "@/lib/documents/economics";

type CostItem = { price?: number | null; cost?: number | null; cost_mode?: string | null; cost_input?: number | null };

export function CostField({
  item,
  onChange,
  className = "",
}: {
  item: CostItem;
  onChange: (patch: Record<string, unknown>) => void;
  className?: string;
}) {
  const mode = normalizeCostMode(item.cost_mode);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <NumField
        value={costInputValue(item)}
        step="0.01"
        aria-label={mode === "percent" ? "Себестоимость, % от цены" : "Себестоимость за единицу"}
        className="h-8 text-center tabular-nums"
        onChange={(v) => onChange(costValuePatch(item, v))}
      />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-9 shrink-0 px-0 text-[11px] font-semibold"
            title={
              mode === "percent"
                ? "Себестоимость в % от цены — пересчитывается при смене цены. Нажмите, чтобы ввести сумму."
                : "Себестоимость суммой за единицу. Нажмите, чтобы задать в % от цены."
            }
            onClick={() => onChange(costModePatch(item, mode === "percent" ? "amount" : "percent"))}
          >
            {mode === "percent" ? "%" : "BYN"}
          </Button>
    </div>
  );
}
