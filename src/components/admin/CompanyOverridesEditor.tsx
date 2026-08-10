import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { COMPANY_OVERRIDE_FIELDS, type CompanyOverrides } from "@/lib/documents/company";
import type { DocumentSettings } from "@/lib/document-settings.functions";

/**
 * Блок «Реквизиты этого документа»: любое поле можно переопределить
 * для конкретного КП; пустое = значение из общих настроек документов.
 */
export function CompanyOverridesEditor({
  value,
  onChange,
  settings,
  title = "Реквизиты этого КП",
}: {
  value: CompanyOverrides;
  onChange: (next: CompanyOverrides) => void;
  settings: DocumentSettings;
  title?: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {COMPANY_OVERRIDE_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <Input
              placeholder={String(settings[key] ?? "")}
              value={value[key] ?? ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Пустые поля берутся из общих настроек документов.
        </p>
        <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => onChange({})}>
          Сбросить к общим настройкам
        </Button>
      </div>
    </div>
  );
}
