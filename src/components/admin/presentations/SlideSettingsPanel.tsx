// Правая панель редактора: настройки выбранного слайда.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
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
import { VariantPicker } from "@/components/admin/presentations/VariantPicker";
import {
  DEFAULT_LAYOUT_OVERRIDES, DEFAULT_SLIDE_BACKGROUND, IMAGE_LAYOUT_LABELS, MAX_IMAGES,
  SLIDE_TYPE_LABELS, slideVariantId, isAutoLayout, normalizeHexColor,
  type PresentationSlide, type SlideBackground, type SlideContent, type SlideImageLayout,
  type SlideLayoutOverrides, type SlideType,
} from "@/lib/presentations/model";
import { BACKGROUND_PRESETS, isDarkBackground } from "@/lib/presentations/design";
import {
  PHOTO_ANCHOR_LABELS, PHOTO_ANCHORS, PHOTO_FIT_LABELS, PHOTO_FITS,
  type PhotoAnchor, type PhotoFit,
} from "@/lib/presentations/photo-fit";

export function SlideSettingsPanel({
  slide,
  onChange,
  onApplyBackgroundToAll,
}: {
  slide: PresentationSlide;
  onChange: (patch: Partial<PresentationSlide>) => void;
  /** Применить текущий фон слайда ко всем слайдам презентации. */
  onApplyBackgroundToAll?: (background: SlideBackground) => void;
}) {
  const c = slide.content;
  const setContent = (patch: Partial<SlideContent>) => onChange({ content: { ...c, ...patch } });
  const isProduct = slide.type === "product";
  const showText = slide.type !== "contacts";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Тип слайда</Label>
        <Select value={slide.type} onValueChange={(v) => onChange({
            type: v as SlideType,
            content: { ...c, variant: slideVariantId(v as SlideType, c.variant) },
          })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SLIDE_TYPE_LABELS) as SlideType[]).map((t) => (
              <SelectItem key={t} value={t}>{SLIDE_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Оформление слайда</Label>
        <VariantPicker
          type={slide.type}
          value={slideVariantId(slide.type, c.variant)}
          onChange={(v) => setContent({ variant: v })}
        />
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
        <GalleryField
          images={c.images}
          layout={c.imageLayout}
          enabled={c.showImage}
          fit={c.photoFit}
          anchor={c.photoAnchor}
          priority={c.photoPriority ?? []}
          onToggle={(v) => setContent({ showImage: v })}
          onChange={(images) => setContent({
            images,
            photoPriority: (c.photoPriority ?? []).filter((u) => images.includes(u)),
          })}
          onLayout={(imageLayout) => setContent({ imageLayout })}
          onFit={(photoFit) => setContent({ photoFit })}
          onAnchor={(photoAnchor) => setContent({ photoAnchor })}
          onPriority={(photoPriority) => setContent({ photoPriority })}
          onAspect={(url, ratio) => {
            const cur = c.photoAspect ?? {};
            if (Math.abs((cur[url] ?? 0) - ratio) < 0.01) return;
            setContent({ photoAspect: { ...cur, [url]: ratio } });
          }}
        />
      )}

      {!isAutoLayout(c.layout) && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Раскладка настроена вручную</div>
            <div className="text-xs text-muted-foreground">
              Зоны и размеры заданы перетаскиванием на слайде
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setContent({ layout: DEFAULT_LAYOUT_OVERRIDES })}
          >
            Сбросить раскладку
          </Button>
        </div>

      )}

      <BackgroundField
        value={c.background}
        onChange={(background) => setContent({ background })}
        onApplyToAll={onApplyBackgroundToAll}
      />

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

/** Фон слайда: наследуется от шаблона либо задаётся вручную. */
function BackgroundField({
  value,
  onChange,
  onApplyToAll,
}: {
  value: SlideBackground;
  onChange: (v: SlideBackground) => void;
  onApplyToAll?: (v: SlideBackground) => void;
}) {
  const stops = value.stops.length ? value.stops : ["#000000", "#1c2028"];
  const css = (list: string[], angle: number) =>
    list.length < 2 ? list[0] : `linear-gradient(${angle}deg, ${list.join(", ")})`;

  const setStop = (i: number, hex: string) => {
    const next = [...stops];
    next[i] = normalizeHexColor(hex, next[i] ?? "#000000");
    onChange({ ...value, stops: value.mode === "solid" ? [next[0]] : next.slice(0, 2) });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label>Фон слайда</Label>
        {value.mode !== "template" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange({ ...DEFAULT_SLIDE_BACKGROUND })}
          >
            Сбросить
          </Button>
        )}
      </div>

      <Select
        value={value.mode}
        onValueChange={(mode) => {
          if (mode === "template") return onChange({ ...DEFAULT_SLIDE_BACKGROUND });
          if (mode === "solid") return onChange({ mode: "solid", stops: [stops[0]], angle: value.angle });
          onChange({ mode: "gradient", stops: [stops[0], stops[1] ?? stops[0]], angle: value.angle || 135 });
        }}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="template">Как в шаблоне</SelectItem>
          <SelectItem value="solid">Свой цвет</SelectItem>
          <SelectItem value="gradient">Градиент</SelectItem>
        </SelectContent>
      </Select>

      {value.mode !== "template" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Цвет фона"
              className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
              value={stops[0]}
              onChange={(e) => setStop(0, e.target.value)}
            />
            {value.mode === "gradient" && (
              <>
                <input
                  type="color"
                  aria-label="Второй цвет градиента"
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                  value={stops[1] ?? stops[0]}
                  onChange={(e) => setStop(1, e.target.value)}
                />
                <Input
                  type="number"
                  className="w-20"
                  value={value.angle}
                  onChange={(e) => onChange({ ...value, angle: Number(e.target.value) || 0 })}
                  aria-label="Угол градиента"
                />
                <span className="text-xs text-muted-foreground">угол</span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Цвет текста, линий и плашек подбирается автоматически —
            {isDarkBackground(stops) ? " светлый набор" : " тёмный набор"}.
          </div>
        </div>
      )}

      <div className="grid-tiles">
        {BACKGROUND_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.label}
            aria-label={p.label}
            className="h-8 rounded border border-border/70 transition hover:ring-2 hover:ring-primary/50"
            style={{ background: css(p.stops, p.angle) }}
            onClick={() =>
              onChange({
                mode: p.stops.length > 1 ? "gradient" : "solid",
                stops: p.stops.slice(0, 2),
                angle: p.angle,
              })
            }
          />
        ))}
      </div>

      {onApplyToAll && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onApplyToAll(value);
            toast.success(
              value.mode === "template"
                ? "Все слайды снова наследуют фон шаблона"
                : "Фон применён ко всем слайдам",
            );
          }}
        >
          Применить фон ко всем слайдам
        </Button>
      )}
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

function GalleryField({
  images, layout, enabled, fit, anchor, priority,
  onToggle, onChange, onLayout, onFit, onAnchor, onPriority, onAspect,
}: {
  images: string[];
  layout: SlideImageLayout;
  enabled: boolean;
  fit: PhotoFit;
  anchor: PhotoAnchor;
  priority: string[];
  onToggle: (v: boolean) => void;
  onChange: (images: string[]) => void;
  onLayout: (v: SlideImageLayout) => void;
  onFit: (v: PhotoFit) => void;
  onAnchor: (v: PhotoAnchor) => void;
  onPriority: (v: string[]) => void;
  onAspect: (url: string, ratio: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const full = images.length >= MAX_IMAGES;

  const add = (next: string[]) => {
    const merged = Array.from(new Set([...images, ...next].map((v) => v.trim()).filter(Boolean)));
    if (merged.length > MAX_IMAGES) toast.info(`На слайд помещается не более ${MAX_IMAGES} фото`);
    onChange(merged.slice(0, MAX_IMAGES));
    // Добавили фото — сразу показываем их на слайде: иначе снимки «пропадают».
    if (merged.length && !enabled) onToggle(true);
  };

  const upload = async (files: File[]) => {
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) { toast.info(`Уже добавлено ${MAX_IMAGES} фото`); return; }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, slots)) {
        if (file.size > 12 * 1024 * 1024) { toast.error(`${file.name}: больше 12 МБ`); continue; }
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `presentations/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
        const { error } = await supabase.storage
          .from("catalog-media")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw new Error(error.message);
        urls.push(supabase.storage.from("catalog-media").getPublicUrl(path).data.publicUrl);
      }
      if (urls.length) { add(urls); toast.success(`Загружено фото: ${urls.length}`); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Фотографии ({images.length}/{MAX_IMAGES})</Label>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>

      {images.length > 0 && !enabled && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5">
          <div className="min-w-0 text-xs">
            <div className="font-medium">Фото не отображаются на слайде</div>
            <div className="text-muted-foreground">Показ фото выключен — снимки не попадут в превью и PDF</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onToggle(true)}>Показать</Button>
        </div>
      )}

      {images.length > 0 && (
        <div className={`grid grid-cols-2 gap-2 ${enabled ? "" : "opacity-50"}`}>
          {images.map((src, i) => (
            <GalleryThumb
              key={`${src}-${i}`}
              src={src}
              index={i}
              count={images.length}
              starred={priority.includes(src)}
              onStar={() => {
                if (priority.includes(src)) {
                  onPriority(priority.filter((u) => u !== src));
                  return;
                }
                if (priority.length >= 3) { toast.info("Главными можно отметить до 3 фото"); return; }
                onPriority([...priority, src]);
              }}
              onAspect={(ratio) => onAspect(src, ratio)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => onChange(images.filter((_, k) => k !== i))}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={url}
          placeholder="URL изображения"
          disabled={full}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) { add([url]); setUrl(""); }
          }}
        />
        <Button
          variant="outline"
          size="icon"
          disabled={busy || full}
          aria-label="Загрузить фото"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void upload(files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Раскладка фото</Label>
        <Select value={layout} onValueChange={(v) => onLayout(v as SlideImageLayout)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(IMAGE_LAYOUT_LABELS) as SlideImageLayout[]).map((v) => (
              <SelectItem key={v} value={v}>{IMAGE_LAYOUT_LABELS[v]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          «Авто» подбирает сетку под количество фото, их пропорции и объём текста.
          Отмеченные звёздочкой фото попадают в самые заметные кадры.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Кадрирование</Label>
          <Select value={fit} onValueChange={(v) => onFit(v as PhotoFit)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHOTO_FITS.map((v) => (
                <SelectItem key={v} value={v}>{PHOTO_FIT_LABELS[v]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Привязка кадра</Label>
          <Select
            value={anchor}
            disabled={fit === "contain"}
            onValueChange={(v) => onAnchor(v as PhotoAnchor)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHOTO_ANCHORS.map((v) => (
                <SelectItem key={v} value={v}>{PHOTO_ANCHOR_LABELS[v]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Настройки кадрирования одинаково применяются в превью и PDF.
      </p>
    </div>
  );
}

function GalleryThumb({
  src, index, count, starred, onStar, onAspect, onMove, onRemove,
}: {
  src: string;
  index: number;
  count: number;
  starred: boolean;
  onStar: () => void;
  onAspect: (ratio: number) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const preview = useResolvedUrl(src);
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60">
      {preview ? (
        <img
          src={preview}
          alt=""
          className="h-24 w-full object-cover"
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth && el.naturalHeight) onAspect(el.naturalWidth / el.naturalHeight);
          }}
        />
      ) : (
        <div className="h-24 w-full bg-muted/40" />
      )}
      <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 text-[11px] font-medium">
        {index + 1}
      </span>
      <Button
        variant={starred ? "default" : "secondary"}
        size="icon"
        className="absolute bottom-1 left-1 h-6 w-6"
        aria-label={starred ? "Снять отметку «главное»" : "Отметить как главное"}
        title="Главное фото — попадает в самый заметный кадр"
        onClick={onStar}
      >
        <Star className={`h-3.5 w-3.5 ${starred ? "fill-current" : ""}`} />
      </Button>
      <div className="absolute right-1 top-1 flex gap-1">
        <Button
          variant="secondary" size="icon" className="h-6 w-6"
          aria-label="Левее" disabled={index === 0} onClick={() => onMove(-1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary" size="icon" className="h-6 w-6"
          aria-label="Правее" disabled={index === count - 1} onClick={() => onMove(1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-6 w-6" aria-label="Удалить" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

