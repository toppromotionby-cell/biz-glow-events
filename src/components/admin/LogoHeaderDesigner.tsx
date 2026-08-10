// LogoHeaderDesigner — загрузка логотипа + интерактивный предпросмотр шапки PDF.
// Показывает, как логотип будет обрезан, масштабирован и размещён в шапке
// документа, и позволяет настроить позицию, размер и отступы.
import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LogoUploader } from "@/components/admin/LogoUploader";
import { DOC_LAYOUT } from "@/lib/documents/brand";
import {
  DEFAULT_LOGO_LAYOUT,
  LOGO_LAYOUT_LIMITS,
  computeLogoPlacement,
  isDefaultLogoLayout,
  type LogoAlign,
  type LogoLayout,
} from "@/lib/documents/logo-layout";
import { cn } from "@/lib/utils";

/** Высота отображаемой области шапки, pt. */
const HEAD_PT = 130;
const { pageWidthPt: PAGE_W, marginXPt: MARGIN_X, marginTopPt: MARGIN_TOP } = DOC_LAYOUT;

const pctX = (pt: number) => `${(pt / PAGE_W) * 100}%`;
const pctY = (pt: number) => `${(pt / HEAD_PT) * 100}%`;
/** Кегль в превью задаём в cqw — масштабируется вместе с шириной листа. */
const fs = (pt: number) => `${(pt / PAGE_W) * 100}cqw`;

function useAspect(url: string | null): number {
  const [aspect, setAspect] = useState(3);
  useEffect(() => {
    if (!url) { setAspect(3); return; }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive && img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
    };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  return aspect;
}

const ALIGNS: { value: LogoAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Слева", Icon: AlignLeft },
  { value: "center", label: "По центру", Icon: AlignCenter },
  { value: "right", label: "Справа", Icon: AlignRight },
];

function SliderRow({
  label, unit = "pt", value, onChange, limits,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  limits: { min: number; max: number; step: number };
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)} {unit}</span>
      </div>
      <Slider
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

export function LogoHeaderPreview({
  logoUrl,
  layout,
  brand,
  legalLine,
  docKind = "Коммерческое предложение",
  docNum = "000",
  docDate = "01.01.2026",
  accent = "#FF7500",
  className,
}: {
  logoUrl: string | null;
  layout: LogoLayout;
  brand: string;
  legalLine: string;
  docKind?: string;
  docNum?: string;
  docDate?: string;
  accent?: string;
  className?: string;
}) {
  const aspect = useAspect(logoUrl);
  const place = logoUrl ? computeLogoPlacement(layout, aspect) : null;
  // Текст бренда и реквизиты — всегда под логотипом, выравнивание как у логотипа.
  const textTop = place ? place.textTop : 2;
  const textAlign = place ? place.textAlign : "left";
  // Есть логотип — текст бренда в шапке не печатается.
  const hideBrand = Boolean(logoUrl);


  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border/70 bg-white shadow-sm",
        className,
      )}
      style={{ aspectRatio: `${PAGE_W} / ${HEAD_PT}`, containerType: "inline-size" }}
      aria-label="Предпросмотр шапки документа"
    >
      {/* акцентная полоса сверху */}
      <div className="absolute inset-x-0 top-0" style={{ height: pctY(4), background: accent }} />

      {/* границы полей */}
      <div
        className="pointer-events-none absolute border-x border-dashed"
        style={{
          left: pctX(MARGIN_X),
          right: pctX(MARGIN_X),
          top: 0,
          bottom: 0,
          borderColor: "rgba(0,0,0,.12)",
        }}
      />
      <div
        className="pointer-events-none absolute border-t border-dashed"
        style={{ left: 0, right: 0, top: pctY(MARGIN_TOP), borderColor: "rgba(0,0,0,.12)" }}
      />

      {/* логотип */}
      {logoUrl && place && (
        <>
          <img
            src={logoUrl}
            alt="Логотип в шапке"
            className="absolute object-contain"
            style={{
              left: pctX(place.x),
              top: pctY(MARGIN_TOP + place.top),
              width: pctX(place.w),
              height: pctY(place.h),
            }}
          />
          <div
            className="pointer-events-none absolute rounded-[2px] border border-dashed"
            style={{
              left: pctX(place.x),
              top: pctY(MARGIN_TOP + place.top),
              width: pctX(place.w),
              height: pctY(place.h),
              borderColor: `${accent}66`,
            }}
          />
        </>
      )}

      {/* бренд и реквизиты — под логотипом */}
      <div
        className="absolute"
        style={{
          left: pctX(MARGIN_X),
          right: pctX(MARGIN_X),
          top: pctY(MARGIN_TOP + textTop),
          textAlign,
        }}
      >
        {!hideBrand && (
          <div className="font-semibold leading-none text-[#111827]" style={{ fontSize: fs(20) }}>
            {brand || "Бренд"}
          </div>
        )}
        <div
          className="leading-tight text-[#6b7280]"
          style={{ fontSize: fs(10), marginTop: pctY(hideBrand ? 2 : 10) }}
        >
          {legalLine}
        </div>
      </div>


      {/* правая колонка */}
      <div
        className="absolute text-right"
        style={{ right: pctX(MARGIN_X), top: pctY(MARGIN_TOP), width: pctX(PAGE_W / 2.4) }}
      >
        <div className="font-semibold uppercase leading-none tracking-[0.14em]" style={{ fontSize: fs(8.5), color: accent }}>
          {docKind}
        </div>
        <div className="font-bold leading-none text-[#111827]" style={{ fontSize: fs(17), marginTop: pctY(8) }}>
          № {docNum}
        </div>
        <div className="leading-none text-[#6b7280]" style={{ fontSize: fs(10), marginTop: pctY(6) }}>
          от {docDate}
        </div>
      </div>

      {/* разделитель — как в PDF */}
      <div
        className="absolute"
        style={{
          left: pctX(MARGIN_X),
          right: pctX(MARGIN_X),
          top: pctY(MARGIN_TOP + Math.max(58, (place?.reserve ?? 0) + 14)),
          height: 1,
          background: "#e5e7eb",
        }}
      />
    </div>
  );
}

export function LogoHeaderDesigner({
  label = "Логотип в шапке",
  hint,
  logoUrl,
  onLogoChange,
  layout,
  onLayoutChange,
  brand,
  legalLine,
  accent,
  docKind,
  docNum,
  docDate,
  className,
}: {
  label?: string;
  hint?: string;
  logoUrl: string | null;
  onLogoChange: (url: string | null) => void;
  layout: LogoLayout;
  onLayoutChange: (l: LogoLayout) => void;
  brand: string;
  legalLine: string;
  accent?: string;
  docKind?: string;
  docNum?: string;
  docDate?: string;
  className?: string;
}) {
  const set = (patch: Partial<LogoLayout>) => onLayoutChange({ ...layout, ...patch });
  const L = LOGO_LAYOUT_LIMITS;

  return (
    <div className={cn("space-y-3", className)}>
      <LogoUploader label={label} hint={hint} value={logoUrl} onChange={onLogoChange} />

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Предпросмотр шапки PDF</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isDefaultLogoLayout(layout)}
            onClick={() => onLayoutChange({ ...DEFAULT_LOGO_LAYOUT })}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Сбросить
          </Button>
        </div>

        <LogoHeaderPreview
          logoUrl={logoUrl}
          layout={layout}
          brand={brand}
          legalLine={legalLine}
          accent={accent}
          docKind={docKind}
          docNum={docNum}
          docDate={docDate}
        />

        <div className="flex flex-wrap gap-1.5 pt-1">
          {ALIGNS.map(({ value, label: l, Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={layout.align === value ? "default" : "outline"}
              onClick={() => set({ align: value })}
            >
              <Icon className="mr-1 h-3.5 w-3.5" /> {l}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <SliderRow label="Макс. ширина" value={layout.maxW} limits={L.maxW} onChange={(v) => set({ maxW: v })} />
          <SliderRow label="Макс. высота" value={layout.maxH} limits={L.maxH} onChange={(v) => set({ maxH: v })} />
          <SliderRow label="Сдвиг по горизонтали" value={layout.offsetX} limits={L.offsetX} onChange={(v) => set({ offsetX: v })} />
          <SliderRow label="Отступ сверху" value={layout.offsetY} limits={L.offsetY} onChange={(v) => set({ offsetY: v })} />
          {layout.align === "left" && (
            <SliderRow label="Отступ до текста" value={layout.gap} limits={L.gap} onChange={(v) => set({ gap: v })} />
          )}
        </div>

        <p className="pt-1 text-xs text-muted-foreground">
          Пока логотип загружен, текстовое название бренда в шапке не печатается — остаётся только
          строка с юр. названием и адресом.
        </p>
      </div>
    </div>
  );
}
