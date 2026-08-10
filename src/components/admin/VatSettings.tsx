import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Percent } from "lucide-react";
import { useState } from "react";
import { VAT_MODE_LABELS, type VatMode } from "@/lib/documents/vat";

export type VatSettingsValue = {
  mode: VatMode;
  rate: number;
  asLine: boolean;
};

/** Единый раскрывающийся блок настроек НДС для всех типов документов. */
export function VatSettings({
  value,
  onChange,
  hint,
}: {
  value: VatSettingsValue;
  onChange: (patch: Partial<VatSettingsValue>) => void;
  hint?: string;
}) {
  const enabled = value.mode !== "none";
  const [open, setOpen] = useState(enabled);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Percent className="h-4 w-4 text-muted-foreground" />
          НДС
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {enabled ? `${VAT_MODE_LABELS[value.mode]} · ${value.rate}%` : "не начисляется"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="vat-enabled" className="text-sm font-normal">
            Начислять НДС в документе
          </Label>
          <Switch
            id="vat-enabled"
            checked={enabled}
            onCheckedChange={(v) => onChange({ mode: v ? "add" : "none" })}
          />
        </div>

        {enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Способ расчёта</Label>
              <Select value={value.mode} onValueChange={(v) => onChange({ mode: v as VatMode })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">{VAT_MODE_LABELS.add}</SelectItem>
                  <SelectItem value="included">{VAT_MODE_LABELS.included}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ставка, %</Label>
              <Input
                type="number"
                min={0}
                max={30}
                step="0.1"
                value={value.rate}
                onChange={(e) => onChange({ rate: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <Label htmlFor="vat-as-line" className="text-sm font-normal">
                Показывать НДС отдельной позицией в таблице
              </Label>
              <Switch id="vat-as-line" checked={value.asLine} onCheckedChange={(v) => onChange({ asLine: v })} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {hint ??
            (value.mode === "included"
              ? "Цены позиций уже включают НДС — он выделяется из итога."
              : value.mode === "add"
                ? "НДС начисляется сверх суммы позиций и увеличивает итог."
                : "В документе будет указано примечание «без НДС».")}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
