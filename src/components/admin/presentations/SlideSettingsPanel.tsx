// Правая панель редактора: настройки выбранного слайда.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedUrl } from "@/components/StorageMedia";
import {
  SLIDE_TYPE_LABELS, type PresentationSlide, type SlideContent, type SlideType,
} from "@/lib/presentations/model";

export function SlideSettingsPanel({
  slide,
  onChange,
}: {
  slide: PresentationSlide;
  onChange: (patch: Partial<PresentationSlide>) => void;
}) {
  const c = slide.content;
  const setContent = (patch: Partial<SlideContent>) => onChange({ content: { ...c, ...patch } });
  const isProduct = slide.type === "product";
  const showText = slide.type !== "contacts";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Тип слайда</Label>
        <Select value={slide.type} onValueChange={(v) => onChange({ type: v as SlideType })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SLIDE_TYPE_LABELS) as SlideType[]).map((t) => (
              <SelectItem key={t} value={t}>{SLIDE_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Заголовок</Label>
        <Input value={slide.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Подзаголовок</Label>
        <Input value={slide.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>

      {showText && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Описание</Label>
            <Toggle checked={c.showDescription} onChange={(v) => setContent({ showDescription: v })} />
          </div>
          <Textarea
            rows={5}
            value={c.description}
            onChange={(e) => setContent({ description: e.target.value })}
            placeholder="Текст слайда"
          />
        </div>
      )}

      {showText && (
        <ListEditor
          label="Что входит"
          items={c.includes}
          enabled={c.showIncludes}
          onToggle={(v) => setContent({ showIncludes: v })}
          onChange={(items) => setContent({ includes: items })}
          placeholder="Пункт списка"
        />
      )}

      {isProduct && (
        <>
          <SpecsEditor
            specs={c.specs}
            enabled={c.showSpecs}
            onToggle={(v) => setContent({ showSpecs: v })}
            onChange={(specs) => setContent({ specs })}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Цена</Label>
              <Toggle checked={c.showPrice} onChange={(v) => setContent({ showPrice: v })} />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={c.price ?? ""}
                onChange={(e) => setContent({ price: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="0.00"
              />
              <Input
                className="w-24"
                value={c.priceUnit}
                onChange={(e) => setContent({ priceUnit: e.target.value })}
                placeholder="шт."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Артикул</Label>
            <Input value={c.sku} onChange={(e) => setContent({ sku: e.target.value })} />
          </div>
        </>
      )}

      {slide.type !== "contacts" && slide.type !== "section" && (
        <ImageField
          value={slide.image_url}
          enabled={c.showImage}
          onToggle={(v) => setContent({ showImage: v })}
          onChange={(url) => onChange({ image_url: url })}
        />
      )}

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <div className="text-sm font-medium">Показывать слайд</div>
          <div className="text-xs text-muted-foreground">Скрытые слайды не попадают в экспорт</div>
        </div>
        <Switch checked={slide.is_visible} onCheckedChange={(v) => onChange({ is_visible: v })} />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={checked} onCheckedChange={onChange} />;
}

function ListEditor({
  label, items, enabled, onToggle, onChange, placeholder,
}: {
  label: string;
  items: string[];
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={it}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((v, k) => (k === i ? e.target.value : v)))}
            />
            <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, k) => k !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1.5 h-4 w-4" />Добавить
        </Button>
      </div>
    </div>
  );
}

function SpecsEditor({
  specs, enabled, onToggle, onChange,
}: {
  specs: { label: string; value: string }[];
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onChange: (specs: { label: string; value: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Характеристики</Label>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {specs.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="w-1/2"
            placeholder="Параметр"
            value={s.label}
            onChange={(e) => onChange(specs.map((v, k) => (k === i ? { ...v, label: e.target.value } : v)))}
          />
          <Input
            placeholder="Значение"
            value={s.value}
            onChange={(e) => onChange(specs.map((v, k) => (k === i ? { ...v, value: e.target.value } : v)))}
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(specs.filter((_, k) => k !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...specs, { label: "", value: "" }])}>
        <Plus className="mr-1.5 h-4 w-4" />Добавить характеристику
      </Button>
    </div>
  );
}

function ImageField({
  value, enabled, onToggle, onChange,
}: {
  value: string | null;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const preview = useResolvedUrl(value);

  const upload = async (file: File) => {
    if (file.size > 12 * 1024 * 1024) { toast.error("Файл больше 12 МБ"); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `presentations/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("catalog-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("catalog-media").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Изображение загружено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Изображение</Label>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {preview && (
        <div className="relative overflow-hidden rounded-lg border border-border/60">
          <img src={preview} alt="" className="h-32 w-full object-cover" />
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          placeholder="URL изображения"
          onChange={(e) => onChange(e.target.value || null)}
        />
        <Button variant="outline" size="icon" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
