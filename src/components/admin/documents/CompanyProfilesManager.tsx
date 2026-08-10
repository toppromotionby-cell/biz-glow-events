// Справочник компаний (несколько юрлиц) для документов: карточки-компании,
// редактирование реквизитов, логотипа, подписи, печати и НДС.
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, Trash2, Star, StarOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/notify";
import { BRAND_ACCENTS } from "@/lib/documents/brand";
import { VatSettings } from "@/components/admin/VatSettings";
import { LogoHeaderDesigner } from "@/components/admin/LogoHeaderDesigner";
import { LogoUploader } from "@/components/admin/LogoUploader";
import {
  listCompanyProfiles,
  saveCompanyProfile,
  deleteCompanyProfile,
} from "@/lib/company-profiles.functions";
import {
  emptyCompanyProfile,
  type CompanyProfile,
  type CompanyProfileInput,
} from "@/lib/documents/company-profile";

export function CompanyProfilesManager() {
  const listFn = useServerFn(listCompanyProfiles);
  const saveFn = useServerFn(saveCompanyProfile);
  const delFn = useServerFn(deleteCompanyProfile);
  const qc = useQueryClient();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["company-profiles"],
    queryFn: () => listFn(),
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyProfileInput | null>(null);
  // "new" — открыт черновик новой компании: авто-выбор существующей его не затирает.
  const [mode, setMode] = useState<"view" | "new">("view");
  const initialized = useRef(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!companies) return;
    // Авто-выбор только при первой загрузке списка.
    if (!initialized.current) {
      initialized.current = true;
      if (companies.length) {
        const first = companies.find((c) => c.is_default) ?? companies[0];
        setActiveId(first.id);
        setDraft({ ...first });
      }
      return;
    }
    // Выбранная компания исчезла (удалили) — сбрасываем, но не мешаем созданию новой.
    if (mode === "view" && activeId && !companies.some((c) => c.id === activeId)) {
      setActiveId(null);
      setDraft(null);
    }
  }, [companies, activeId, mode]);

  const pick = (c: CompanyProfile) => {
    setMode("view");
    setActiveId(c.id);
    setDraft({ ...c });
  };

  const addNew = () => {
    setMode("new");
    setActiveId(null);
    setDraft({
      ...emptyCompanyProfile(),
      name: "Новая компания",
      is_default: !companies?.length,
    });
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const cancelNew = () => {
    setMode("view");
    const first = companies?.find((c) => c.is_default) ?? companies?.[0] ?? null;
    setActiveId(first?.id ?? null);
    setDraft(first ? { ...first } : null);
  };

  const save = useMutation({
    mutationFn: async (input: CompanyProfileInput) => saveFn({ data: input }),
    onSuccess: (row) => {
      notify.success("Компания сохранена");
      setMode("view");
      setActiveId(row.id);
      setDraft({ ...row });
      qc.invalidateQueries({ queryKey: ["company-profiles"] });
    },
    onError: (e: Error) => notify.error(e.message || "Не удалось сохранить компанию"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      notify.success("Компания удалена");
      setMode("view");
      setActiveId(null);
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["company-profiles"] });
    },
    onError: (e: Error) => notify.error(e.message || "Не удалось удалить компанию"),
  });

  const saveError = save.error instanceof Error ? save.error.message : null;

  const set = <K extends keyof CompanyProfileInput>(key: K, value: CompanyProfileInput[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));


  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  const noDefault = (companies ?? []).length > 0 && !(companies ?? []).some((c) => c.is_default);

  return (
    <div className="space-y-3">
      {noDefault && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Ни одна компания не отмечена как основная. Её реквизиты подставляются в документы,
          где компания не выбрана, — откройте нужную компанию и нажмите «Сделать основной».
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Список компаний */}

      <div className="space-y-2">
        {(companies ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              c.id === activeId
                ? "border-primary/60 bg-primary/5"
                : "border-border/60 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{c.name}</span>
              {c.is_default && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  основная
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {c.company_legal_name || "Реквизиты не заполнены"}
            </p>
          </button>
        ))}
        {mode === "new" && (
          <div className="rounded-xl border border-dashed border-primary/60 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{draft?.name || "Новая компания"}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                черновик
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Заполните и сохраните</p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addNew}
          disabled={mode === "new"}
        >
          <Plus className="mr-1 h-4 w-4" />
          Добавить компанию
        </Button>
        {!companies?.length && mode !== "new" && (
          <p className="text-xs text-muted-foreground">
            Пока нет ни одной компании — добавьте первую, она станет основной.
          </p>
        )}
      </div>

      {/* Редактор */}
      {!draft ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Выберите компанию слева или добавьте новую.
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border border-border/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {mode === "new" ? "Новая компания" : draft.name || "Компания"}
            </h3>
            {mode === "new" && (
              <Button type="button" variant="ghost" size="sm" onClick={cancelNew}>
                Отмена
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F
              label="Название профиля (видно только вам)"
              value={draft.name}
              onChange={(v) => set("name", v)}
              inputRef={nameRef}
            />

            <F
              label="Юр. название"
              value={draft.company_legal_name}
              onChange={(v) => set("company_legal_name", v)}
            />
            <F
              label="Бренд (для шапки)"
              value={draft.company_brand}
              onChange={(v) => set("company_brand", v)}
            />
            <F label="УНП" value={draft.company_unp} onChange={(v) => set("company_unp", v)} />
            <F
              label="Юридический адрес"
              value={draft.company_address}
              onChange={(v) => set("company_address", v)}
            />
            <F
              label="Телефон"
              value={draft.company_phone}
              onChange={(v) => set("company_phone", v)}
            />
            <F
              label="E-mail"
              value={draft.company_email}
              onChange={(v) => set("company_email", v)}
            />
            <F
              label="Сайт"
              value={draft.company_website}
              onChange={(v) => set("company_website", v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <F label="Банк" value={draft.bank_name} onChange={(v) => set("bank_name", v)} />
            <F label="БИК" value={draft.bank_bic} onChange={(v) => set("bank_bic", v)} />
            <F
              label="Расчётный счёт (IBAN)"
              value={draft.bank_account}
              onChange={(v) => set("bank_account", v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <F
              label="Подписант"
              value={draft.signer_name}
              onChange={(v) => set("signer_name", v)}
            />
            <F
              label="Должность"
              value={draft.signer_title}
              onChange={(v) => set("signer_title", v)}
            />
            <F
              label="Действует на основании"
              value={draft.signer_basis}
              onChange={(v) => set("signer_basis", v)}
            />
          </div>

          <LogoHeaderDesigner
            label="Логотип компании"
            hint="Подставляется в шапку всех документов этой компании."
            logoUrl={draft.logo_url}
            onLogoChange={(v) => set("logo_url", v)}
            layout={draft.logo_layout}
            onLayoutChange={(l) => set("logo_layout", l)}
            brand={draft.company_brand}
            legalLine={`${draft.company_legal_name} · ${draft.company_address}`}
            accent={draft.accent_color}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <LogoUploader
              label="Подпись"
              value={draft.signature_url}
              onChange={(v) => set("signature_url", v)}
            />
            <LogoUploader
              label="Печать"
              value={draft.stamp_url}
              onChange={(v) => set("stamp_url", v)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Акцентный цвет</Label>
            <div className="flex items-center gap-2">
              <Input
                value={draft.accent_color}
                onChange={(e) => set("accent_color", e.target.value)}
                placeholder="#FF7500"
              />
              <div className="flex items-center gap-1.5">
                <div
                  className="h-9 w-9 rounded-md border border-border/60"
                  style={{ background: draft.accent_color }}
                  aria-hidden
                />
                {BRAND_ACCENTS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={`${c.label} ${c.hex}`}
                    onClick={() => set("accent_color", c.hex)}
                    className="h-6 w-6 rounded-full border border-border/60 transition hover:scale-110"
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          <VatSettings
            value={{ mode: draft.vat_mode, rate: draft.vat_rate, asLine: draft.vat_as_line }}
            onChange={(v) => {
              if (v.mode !== undefined) set("vat_mode", v.mode);
              if (v.rate !== undefined) set("vat_rate", v.rate);
              if (v.asLine !== undefined) set("vat_as_line", v.asLine);
            }}
            hint="Настройка НДС применяется к документам этой компании."
          />
          <F
            label="Примечание об НДС"
            value={draft.vat_note}
            onChange={(v) => set("vat_note", v)}
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              onClick={() => draft && save.mutate({ ...draft, id: activeId ?? undefined })}
              disabled={save.isPending}
            >
              {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Сохранить
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                draft &&
                save.mutate({ ...draft, id: activeId ?? undefined, is_default: !draft.is_default })
              }
              disabled={save.isPending}
            >
              {draft.is_default ? (
                <StarOff className="mr-1 h-4 w-4" />
              ) : (
                <Star className="mr-1 h-4 w-4" />
              )}
              {draft.is_default ? "Снять «основная»" : "Сделать основной"}
            </Button>
            {activeId && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Удалить компанию? Документы с ней вернутся к общим настройкам."))
                    remove.mutate(activeId);
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Удалить
              </Button>
            )}
          </div>
          {saveError && (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );

}

function F({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} />

    </div>
  );
}
