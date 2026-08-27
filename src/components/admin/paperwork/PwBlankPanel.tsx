// Настройки фирменного бланка компании: шапка, поля, шрифт, подложка.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextAreaField } from "@/components/admin/field-kit";
import { Save } from "lucide-react";
import type { PwBlank } from "@/lib/paperwork/model";
import { LOGO_LAYOUT_LIMITS } from "@/lib/documents/logo-layout";

const HEADERS: { key: PwBlank["headerLayout"]; label: string }[] = [
  { key: "logo-left", label: "Логотип слева" },
  { key: "logo-center", label: "Логотип по центру" },
  { key: "logo-right", label: "Логотип справа" },
  { key: "none", label: "Без шапки" },
];

export function PwBlankPanel({
  blank,
  onChange,
  onSave,
  saving,
  companyName,
  hasCompanies,
  clientLogoUrl,
  onClientLogoUrlChange,
}: {
  blank: PwBlank;
  onChange: (next: PwBlank) => void;
  onSave: () => void;
  saving: boolean;
  companyName: string | null;
  hasCompanies: boolean;
  clientLogoUrl: string;
  onClientLogoUrlChange: (value: string) => void;
}) {
  const set = <K extends keyof PwBlank>(k: K, v: PwBlank[K]) => onChange({ ...blank, [k]: v });

  if (!companyName) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {hasCompanies ? (
          <p>Выберите компанию в верхней панели редактора — настройки бланка сохраняются для её профиля.</p>
        ) : (
          <>
            <p>Пока нет ни одной компании: создайте профиль, чтобы настроить фирменный бланк.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/settings/documents">Настройки компаний</Link>
            </Button>
          </>
        )}
      </div>
    );
  }


  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Шапка документа</Label>
          <Select value={blank.headerLayout} onValueChange={(v) => set("headerLayout", v as PwBlank["headerLayout"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {HEADERS.map((h) => <SelectItem key={h.key} value={h.key}>{h.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Шрифт</Label>
          <Select value={blank.font} onValueChange={(v) => set("font", v as PwBlank["font"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brand">Фирменный (Inter / Space Grotesk)</SelectItem>
              <SelectItem value="ubuntu">Ubuntu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={blank.headerRequisites} onCheckedChange={(v) => set("headerRequisites", v)} />
          Реквизиты в шапке
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={blank.clientLogo}
            onCheckedChange={(v) => set("clientLogo", v)}
          />
          Логотип клиента (переменная client_logo)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={blank.accentBar} onCheckedChange={(v) => set("accentBar", v)} />
          Фирменная полоса сверху
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={blank.footer} onCheckedChange={(v) => set("footer", v)} />
          Подвал с контактами
        </label>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Акцентный цвет</Label>
          <input
            type="color"
            value={blank.accentColor}
            onChange={(e) => set("accentColor", e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
        </div>
      </div>

      {blank.footer && (
        <div className="space-y-1">
          <Label className="text-xs">Текст подвала (пусто — реквизиты компании)</Label>
          <TextAreaField value={blank.footerText} onChange={(v) => set("footerText", v)} minRows={1} />
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={blank.logoLayout.mode === "auto"}
            onCheckedChange={(v) =>
              set("logoLayout", { ...blank.logoLayout, mode: v ? "auto" : "manual" })
            }
          />
          Автоподбор размера логотипа
        </label>
        {blank.logoLayout.mode !== "auto" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Макс. ширина: {blank.logoLayout.maxW} pt</Label>
              <Slider
                value={[blank.logoLayout.maxW]}
                min={LOGO_LAYOUT_LIMITS.maxW.min}
                max={LOGO_LAYOUT_LIMITS.maxW.max}
                step={LOGO_LAYOUT_LIMITS.maxW.step}
                onValueChange={([v]) => set("logoLayout", { ...blank.logoLayout, maxW: v })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Макс. высота: {blank.logoLayout.maxH} pt</Label>
              <Slider
                value={[blank.logoLayout.maxH]}
                min={LOGO_LAYOUT_LIMITS.maxH.min}
                max={LOGO_LAYOUT_LIMITS.maxH.max}
                step={LOGO_LAYOUT_LIMITS.maxH.step}
                onValueChange={([v]) => set("logoLayout", { ...blank.logoLayout, maxH: v })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Кегль основного текста: {blank.fontSizePt} пт</Label>
          <Slider value={[blank.fontSizePt]} min={8} max={16} step={0.5} onValueChange={([v]) => set("fontSizePt", v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Боковые поля: {blank.marginXMm} мм</Label>
          <Slider value={[blank.marginXMm]} min={8} max={40} step={1} onValueChange={([v]) => set("marginXMm", v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Верхнее поле: {blank.marginTopMm} мм</Label>
          <Slider value={[blank.marginTopMm]} min={8} max={60} step={1} onValueChange={([v]) => set("marginTopMm", v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Нижнее поле: {blank.marginBottomMm} мм</Label>
          <Slider value={[blank.marginBottomMm]} min={8} max={40} step={1} onValueChange={([v]) => set("marginBottomMm", v)} />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <Label className="text-xs">Подложка (URL изображения)</Label>
        <Input
          value={blank.backgroundUrl ?? ""}
          placeholder="https://…/blank.png"
          onChange={(e) => set("backgroundUrl", e.target.value.trim() || null)}
        />
        {blank.backgroundUrl && (
          <div className="space-y-1">
            <Label className="text-xs">Прозрачность: {Math.round(blank.backgroundOpacity * 100)}%</Label>
            <Slider
              value={[blank.backgroundOpacity]}
              min={0.02}
              max={1}
              step={0.02}
              onValueChange={([v]) => set("backgroundOpacity", v)}
            />
          </div>
        )}
      </div>

      <Button onClick={onSave} disabled={saving}>
        <Save className="mr-1 h-4 w-4" /> Сохранить бланк компании
      </Button>
    </div>
  );
}
