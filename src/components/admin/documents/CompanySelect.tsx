// Выбор компании (юрлица) для конкретного документа. Все реквизиты, логотип,
// подпись, печать и НДС подставляются автоматически из выбранного профиля.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCompanyProfiles } from "@/lib/company-profiles.functions";
import type { CompanyProfile } from "@/lib/documents/company-profile";

const NONE = "__default__";

export function useCompanyProfiles() {
  const listFn = useServerFn(listCompanyProfiles);
  return useQuery({
    queryKey: ["company-profiles"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
}

export function CompanySelect({
  value,
  onChange,
  label = "Компания (от кого документ)",
  hint,
}: {
  value: string | null;
  onChange: (companyId: string | null, profile: CompanyProfile | null) => void;
  label?: string;
  hint?: string;
}) {
  const { data: companies } = useCompanyProfiles();
  const list = companies ?? [];
  const active = list.find((c) => c.id === value) ?? null;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        {label}
      </Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => {
          if (v === NONE) return onChange(null, null);
          onChange(v, list.find((c) => c.id === v) ?? null);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Основная компания" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Общие настройки документов</SelectItem>
          {list.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              {c.is_default ? " · основная" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {active
          ? `${active.company_legal_name || active.name}${active.company_unp ? ` · УНП ${active.company_unp}` : ""}`
          : (hint ?? "Реквизиты, логотип, подпись и НДС подставятся автоматически.")}{" "}
        <Link to="/admin/settings/documents" className="underline underline-offset-2">
          Управление компаниями
        </Link>
      </p>
    </div>
  );
}
