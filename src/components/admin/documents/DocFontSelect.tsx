// Выбор шрифта документа: фирменный или Ubuntu. Используется в КП, промо-КП,
// презентациях и в общих настройках документов.
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DOC_FONTS,
  DOC_FONT_LABELS,
  DOC_FONT_CHOICE_LABELS,
  type DocFont,
  type DocFontChoice,
} from "@/lib/documents/doc-font";

export function DocFontSelect({
  value,
  onChange,
  allowInherit = true,
  label = "Шрифт документа",
  hint,
}: {
  value: DocFontChoice;
  onChange: (v: DocFontChoice) => void;
  allowInherit?: boolean;
  label?: string;
  hint?: string;
}) {
  const options: DocFontChoice[] = allowInherit ? ["inherit", ...DOC_FONTS] : [...DOC_FONTS];
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as DocFontChoice)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {allowInherit ? DOC_FONT_CHOICE_LABELS[o] : DOC_FONT_LABELS[o as DocFont]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-tight text-muted-foreground">
        {hint ?? "Применяется ко всему документу — и в превью, и в PDF."}
      </p>
    </div>
  );
}
