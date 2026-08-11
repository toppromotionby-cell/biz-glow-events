// Общий блок «Оформление» для КП и промо-КП: переключатели видимости, шрифт,
// акцентный цвет, печать, логотипы, компания и реквизиты. Один компонент вместо двух копий.
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/admin/Field";
import { BRAND_ACCENTS } from "@/lib/documents/brand";
import { DocFontSelect } from "@/components/admin/documents/DocFontSelect";
import { LogoHeaderDesigner } from "@/components/admin/LogoHeaderDesigner";
import { LogoUploader } from "@/components/admin/LogoUploader";
import { CompanySelect } from "@/components/admin/documents/CompanySelect";
import { CompanyOverridesEditor } from "@/components/admin/CompanyOverridesEditor";
import { PrintPresetEditor } from "@/components/admin/documents/PrintPresetEditor";
import type { PrintPreset } from "@/lib/documents/print-preset";

export interface DocToggle {
  key: string;
  label: string;
  hint?: ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
}

interface DocAppearanceSectionProps {
  toggles?: DocToggle[];
  fontFamily: string | null;
  onFontChange: (v: string | null) => void;
  accent: string;
  accentPlaceholder?: string;
  onAccentChange: (v: string) => void;
  print?: {
    value: PrintPreset;
    onChange: (v: Parameters<typeof PrintPresetEditor>[0]["value"]) => void;
    onReset: () => void;
  };
  logo: {
    label?: string;
    hint?: string;
    url: string | null;
    onChange: (v: string | null) => void;
    layout: Parameters<typeof LogoHeaderDesigner>[0]["layout"];
    onLayoutChange: Parameters<typeof LogoHeaderDesigner>[0]["onLayoutChange"];
    brand: string;
    legalLine: string;
    docNum: string;
  };
  clientLogo?: { url: string | null; onChange: (v: string | null) => void };
  companyId: string | null;
  onCompanyChange: (v: string | null) => void;
  overrides: Parameters<typeof CompanyOverridesEditor>[0]["value"];
  onOverridesChange: Parameters<typeof CompanyOverridesEditor>[0]["onChange"];
  settings: Parameters<typeof CompanyOverridesEditor>[0]["settings"];
  /** Дополнительные поля конкретного типа документа (подпись, печать, примечание). */
  extra?: ReactNode;
}

export function DocAppearanceSection({
  toggles, fontFamily, onFontChange, accent, accentPlaceholder, onAccentChange,
  print, logo, clientLogo, companyId, onCompanyChange, overrides, onOverridesChange, settings, extra,
}: DocAppearanceSectionProps) {
  return (
    <div className="space-y-4">
      {!!toggles?.length && (
        <div className="grid gap-2 sm:grid-cols-2">
          {toggles.map((t) => (
            <label key={t.key} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <span className="flex items-center gap-1">{t.label}{t.hint}</span>
              <Switch checked={t.value} onCheckedChange={t.onChange} />
            </label>
          ))}
        </div>
      )}

      <DocFontSelect value={fontFamily} onChange={onFontChange} />

      <Field label="Акцентный цвет (HEX)">
        <div className="flex items-center gap-2">
          <Input placeholder={accentPlaceholder} value={accent} onChange={(e) => onAccentChange(e.target.value)} />
          <div className="flex shrink-0 items-center gap-1.5">
            {BRAND_ACCENTS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={`${c.label} ${c.hex}`}
                onClick={() => onAccentChange(c.hex)}
                className="h-7 w-7 rounded-full border border-border/60 transition hover:scale-110"
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>
      </Field>

      {print && (
        <div className="rounded-xl border border-border/60 p-3">
          <p className="mb-2 text-sm font-medium">Печать: поля и интервалы</p>
          <PrintPresetEditor
            value={print.value}
            hint="Значения по умолчанию берутся из шаблона в настройках документов. Здесь — только для этого документа."
            resetLabel="Вернуть настройки шаблона"
            onReset={print.onReset}
            onChange={print.onChange}
          />
        </div>
      )}

      <LogoHeaderDesigner
        label={logo.label ?? "Логотип"}
        hint={logo.hint}
        logoUrl={logo.url}
        onLogoChange={logo.onChange}
        layout={logo.layout}
        onLayoutChange={logo.onLayoutChange}
        brand={logo.brand}
        legalLine={logo.legalLine}
        accent={accent || accentPlaceholder || ""}
        docNum={logo.docNum}
      />

      {clientLogo && (
        <LogoUploader label="Логотип клиента" value={clientLogo.url} onChange={clientLogo.onChange} />
      )}

      {extra}

      <Separator />

      <CompanySelect value={companyId} onChange={onCompanyChange} />
      <CompanyOverridesEditor value={overrides} onChange={onOverridesChange} settings={settings} />
    </div>
  );
}
