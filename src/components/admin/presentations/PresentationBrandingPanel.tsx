// Брендинг презентации: логотип компании + логотип клиента, правила их
// автоматического наложения на слайды и масштаб.
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LogoUploader } from "@/components/admin/LogoUploader";
import {
  LOGO_PLACEMENT_LABELS,
  type LogoPlacement,
  type PresentationLogoLayout,
} from "@/lib/presentations/model";

function PlacementSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LogoPlacement;
  onChange: (v: LogoPlacement) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as LogoPlacement)}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(LOGO_PLACEMENT_LABELS) as LogoPlacement[]).map((p) => (
            <SelectItem key={p} value={p}>{LOGO_PLACEMENT_LABELS[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PresentationBrandingPanel({
  logoUrl,
  clientLogoUrl,
  layout,
  onChange,
}: {
  logoUrl: string | null;
  clientLogoUrl: string | null;
  layout: PresentationLogoLayout;
  onChange: (patch: {
    logo_url?: string | null;
    client_logo_url?: string | null;
    logo_layout?: PresentationLogoLayout;
  }) => void;
}) {
  return (
    <div className="space-y-4">
      <LogoUploader
        label="Логотип компании"
        hint="Если не загружен — берётся логотип выбранной компании."
        value={logoUrl}
        onChange={(url) => onChange({ logo_url: url })}
      />
      <LogoUploader
        label="Логотип клиента"
        hint="Накладывается на слайды автоматически там, где есть свободное место."
        value={clientLogoUrl}
        onChange={(url) => onChange({ client_logo_url: url })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <PlacementSelect
          label="Наш логотип на слайдах"
          value={layout.brand}
          onChange={(brand) => onChange({ logo_layout: { ...layout, brand } })}
        />
        <PlacementSelect
          label="Логотип клиента на слайдах"
          value={layout.client}
          onChange={(client) => onChange({ logo_layout: { ...layout, client } })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Размер логотипов · {Math.round(layout.scale * 100)}%
        </Label>
        <Slider
          value={[layout.scale]}
          min={0.6}
          max={1.6}
          step={0.05}
          onValueChange={([scale]) => onChange({ logo_layout: { ...layout, scale } })}
        />
        <p className="text-[11px] leading-tight text-muted-foreground">
          В режиме «Авто» логотип ставится только там, где он не перекроет фото и текст.
        </p>
      </div>
    </div>
  );
}
