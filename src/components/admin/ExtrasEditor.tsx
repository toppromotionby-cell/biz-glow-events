// Editor for "Дополнительно" — array of {label, value} pairs (specs / extras).
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X, Info } from "lucide-react";

export type ExtraRow = { label: string; value: string };

export function ExtrasEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: ExtraRow[]) => void;
}) {
  const items: ExtraRow[] = Array.isArray(value)
    ? value.map((r) => ({
        label: String((r as ExtraRow)?.label ?? ""),
        value: String((r as ExtraRow)?.value ?? ""),
      }))
    : [];

  const update = (i: number, patch: Partial<ExtraRow>) => {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...items, { label: "", value: "" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Дополнительно</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Строка</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Характеристики, опции, условия — отображаются в карточке отдельным блоком.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-1.5 items-center">
              <Input value={row.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Параметр" />
              <Input value={row.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="Значение" />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} aria-label="Удалить"><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
