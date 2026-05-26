// Editor for "Что входит" — array of strings.
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X, GripVertical, Check } from "lucide-react";

export function FeaturesEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const items: string[] = Array.isArray(value) ? value.map((v) => String(v ?? "")) : [];

  const update = (i: number, v: string) => {
    const next = items.slice();
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Что входит</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Пункт</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Добавьте пункты, которые входят в стоимость позиции.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <button type="button" onClick={() => move(i, -1)} aria-label="Вверх" className="h-9 w-7 inline-flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </button>
              <Input value={v} onChange={(e) => update(i, e.target.value)} placeholder={`Пункт ${i + 1}`} />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} aria-label="Удалить"><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
