// Управляемый −/число/+ степпер. Используется в корзине и быстром просмотре.
import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Подпись для aria-label, например "для VR-зоны". */
  label?: string;
}

export function QtyStepper({ value, onChange, min = 1, max = 99, label }: Props) {
  const suffix = label ? ` для ${label}` : "";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Уменьшить количество${suffix}`}
        className="btn-icon-soft h-7 w-7"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Увеличить количество${suffix}`}
        className="btn-icon-soft h-7 w-7"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
