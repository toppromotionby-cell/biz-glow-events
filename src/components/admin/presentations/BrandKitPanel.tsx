// Бренд-наборы презентации: цвета фона, акцент, шрифт и стиль рамки.
// Набор применяется ко всем слайдам и ко всем вариантам оформления шаблона.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DocFontSelect } from "@/components/admin/documents/DocFontSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteBrandKit, listBrandKits, saveBrandKit } from "@/lib/presentations.functions";
import {
  BRAND_FRAME_LABELS, BRAND_KIT_PRESETS, brandKitBackground,
  type BrandFrame, type BrandKit,
} from "@/lib/presentations/brand-kit";

function Swatch({ kit, active, onClick }: { kit: BrandKit; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={kit.name}
      className={`relative h-14 rounded-lg border text-left transition ${
        active ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/60"
      }`}
      style={{ background: brandKitBackground(kit) }}
    >
      <span
        className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium"
        style={{ color: kit.accent }}
      >
        {kit.name}
      </span>
      {active && <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" aria-hidden />}
    </button>
  );
}

export function BrandKitPanel({
  value, onChange,
}: {
  value: BrandKit | null;
  onChange: (kit: BrandKit | null) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrandKits);
  const saveFn = useServerFn(saveBrandKit);
  const delFn = useServerFn(deleteBrandKit);
  const [name, setName] = useState("");

  const kits = useQuery({ queryKey: ["presentation-brand-kits"], queryFn: () => listFn({}) });

  const save = useMutation({
    mutationFn: async () => {
      if (!value) throw new Error("Сначала выберите или настройте набор");
      return await saveFn({
        data: {
          id: null,
          name: (name.trim() || value.name || "Мой набор").slice(0, 80),
          stops: value.stops,
          angle: value.angle,
          accent: value.accent,
          font: value.font,
          logoUrl: value.logoUrl,
          frame: value.frame,
          isDefault: false,
        },
      });
    },
    onSuccess: () => {
      setName("");
      toast.success("Набор сохранён");
      void qc.invalidateQueries({ queryKey: ["presentation-brand-kits"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => await delFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["presentation-brand-kits"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const patch = (p: Partial<BrandKit>) => {
    const base = value ?? BRAND_KIT_PRESETS[0]!;
    onChange({ ...base, ...p });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Бренд-набор</Label>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Сбросить</Button>
        )}
      </div>

      <div className="grid-fields">
        {BRAND_KIT_PRESETS.map((k) => (
          <Swatch key={k.id} kit={k} active={value?.id === k.id} onClick={() => onChange(k)} />
        ))}
      </div>

      {!!kits.data?.length && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Сохранённые наборы</p>
          <div className="grid-fields">
            {kits.data.map((k) => (
              <div key={k.id} className="relative">
                <Swatch kit={k} active={value?.id === k.id} onClick={() => onChange(k)} />
                <button
                  type="button"
                  aria-label={`Удалить набор ${k.name}`}
                  className="absolute right-1 top-1 rounded bg-background/85 p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(k.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {value && (
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="bk-accent">Акцент</Label>
            <div className="flex items-center gap-2">
              <input
                id="bk-accent"
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-border/60 bg-transparent"
                value={value.accent}
                onChange={(e) => patch({ accent: e.target.value })}
              />
              <Input value={value.accent} onChange={(e) => patch({ accent: e.target.value })} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Фон</Label>
            <div className="flex items-center gap-2">
              {value.stops.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  aria-label={`Цвет фона ${i + 1}`}
                  className="h-9 w-12 cursor-pointer rounded border border-border/60 bg-transparent"
                  value={c}
                  onChange={(e) => {
                    const stops = [...value.stops];
                    stops[i] = e.target.value;
                    patch({ stops });
                  }}
                />
              ))}
              {value.stops.length < 3 && (
                <Button variant="outline" size="icon" aria-label="Добавить цвет"
                  onClick={() => patch({ stops: [...value.stops, value.accent] })}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {value.stops.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Убрать цвет"
                  onClick={() => patch({ stops: value.stops.slice(0, -1) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Рамка</Label>
            <Select value={value.frame} onValueChange={(v) => patch({ frame: v as BrandFrame })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(BRAND_FRAME_LABELS) as BrandFrame[]).map((f) => (
                  <SelectItem key={f} value={f}>{BRAND_FRAME_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DocFontSelect
            value={value.font}
            onChange={(font) => patch({ font })}
            hint="Шрифт набора применяется вместе с цветами."
          />

          <div className="flex items-center gap-2">
            <Input
              placeholder="Название набора"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Сохранить</Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Набор перекрывает цвета шаблона на всех слайдах, где не задан собственный фон.
      </p>
    </div>
  );
}
