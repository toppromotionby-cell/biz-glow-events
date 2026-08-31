// Редактор карточки каталога: общий для zones / tech_equipment / services / production_items.
// Автосохранение (debounce 1.2s) + резервный черновик в localStorage.
// Действия (открыть на сайте / дублировать / переместить / удалить) — в kebab-меню.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronDown, Copy, ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { AdminEditorShell } from "@/components/admin/AdminEditorShell";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { Field } from "@/components/admin/Field";
import { catalogItemSchema } from "@/lib/admin/schemas";
import { mapServerError, zodFieldErrors, type FieldErrors } from "@/lib/admin/form-errors";
import { CategoryCombobox } from "@/components/admin/CategoryCombobox";
import { FeaturesEditor } from "@/components/admin/FeaturesEditor";
import { ExtrasEditor } from "@/components/admin/ExtrasEditor";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { PriceTableEditor, minPriceFromTiers, getTiers, type PricingValue } from "@/components/PriceTable";
import { fmtCurrency } from "@/lib/formatters";
import { slugify } from "@/lib/utils";
import type { SaveState } from "@/components/admin/SaveStatus";
import {
  CATALOG_TABLES, CATALOG_LABELS,
  type CatalogTable, type CatalogInsert, type CatalogUpdate,
} from "@/lib/admin/catalog-types";
import type { Json } from "@/integrations/supabase/types";
import { asArray, type ExtraItem, type FeatureItem, type Row } from "./shared";

type FormState = Partial<Row>;



export function CatalogEditor({
  table,
  item,
  onSaved,
  onDelete,
  onDuplicate,
}: {
  table: CatalogTable;
  item: Row;
  onSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const draftKey = `catalog-draft:${table}:${item.id}`;
  const [form, setForm] = useState<FormState>(() => {
    if (typeof window === "undefined") return { ...item };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt: number; data: FormState };
        if (cached?.data && cached.savedAt > new Date(item.updated_at ?? 0).getTime()) {
          return { ...item, ...cached.data };
        }
      }
    } catch { /* ignore */ }
    return { ...item };
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dirtyRef = useRef(false);
  const skipNextAutosaveRef = useRef(true);
  const { guardDialog } = useUnsavedGuard(dirty);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  // Валидация ключевых полей: пустой заголовок или кривой slug не улетают в автосейв.
  const validation = useMemo(() => {
    const r = catalogItemSchema.safeParse({
      title: form.title ?? "",
      slug: form.slug ?? "",
      seo_title: form.seo_title ?? "",
      seo_description: form.seo_description ?? "",
    });
    return r.success ? { ok: true as const, errors: {} as FieldErrors } : { ok: false as const, errors: zodFieldErrors(r.error) };
  }, [form.title, form.slug, form.seo_title, form.seo_description]);
  const validationRef = useRef(validation);
  validationRef.current = validation;
  const errors: FieldErrors = { ...validation.errors, ...serverErrors };



  const buildPatch = (state: FormState): CatalogUpdate => ({
    title: state.title, slug: state.slug, category: state.category,
    description: state.description,
    requirements: state.requirements, seo_title: state.seo_title, seo_description: state.seo_description,
    published: state.published, photo_urls: state.photo_urls ?? [], video_urls: state.video_urls ?? [],
    pricing: state.pricing ?? {}, features: state.features ?? [], extras: state.extras ?? [], faq: state.faq ?? [],
  });

  // Актуальные данные для дозаписи при размонтировании (смена карточки/уход из раздела).
  const flushRef = useRef<{ form: FormState; patch: (s: FormState) => CatalogUpdate }>({ form, patch: buildPatch });
  flushRef.current = { form, patch: buildPatch };

  // Автосохранение: debounce 1.2с после изменения формы.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setDirty(true);
    setSaveState("dirty");
    // Локальный черновик — мгновенно (страховка).
    try {
      localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), data: form }));
    } catch { /* quota */ }

    const t = setTimeout(async () => {
      // Невалидные поля не отправляем: показываем ошибки и ждём правок.
      if (!validationRef.current.ok) {
        setSaveState("error");
        setErrorMessage("Исправьте ошибки в форме — изменения не сохраняются");
        return;
      }
      setSaveState("saving");
      const { error } = await supabase.from(table).update(buildPatch(form)).eq("id", item.id);
      if (error) {
        const mapped = mapServerError(error);
        if (mapped.field) setServerErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
        setSaveState("error");
        setErrorMessage(mapped.message);
        return;
      }
      setServerErrors({});
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      dirtyRef.current = false;
      setDirty(false);
      setErrorMessage(null);
      setDraftSavedAt(new Date());
      setSaveState("saved");
      onSaved();
    }, 1200);


    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Сброс «Сохранено» через 2с до idle.
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  // Правки, не успевшие уйти по дебаунсу, дописываем при размонтировании.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      const { form: last, patch } = flushRef.current;
      void supabase.from(table).update(patch(last)).eq("id", item.id).then(({ error }) => {
        if (!error) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, table]);


  const onTitleChange = (value: string) => {
    setForm((prev) => {
      const next: FormState = { ...prev, title: value };
      // Авто-slug, только если slug по умолчанию или пуст.
      const currentSlug = prev.slug ?? "";
      const isAutoSlug = !currentSlug || currentSlug.startsWith("new-");
      if (isAutoSlug) {
        const generated = slugify(value).slice(0, 80);
        if (generated) next.slug = generated;
      }
      return next;
    });
  };

  const moveTo = async (target: CatalogTable) => {
    if (target === table) return;
    setMoving(true);
    try {
      const patch = buildPatch(form);
      const payload: CatalogInsert = {
        ...patch,
        title: patch.title ?? "Без названия",
        slug: patch.slug ?? `moved-${Date.now()}`,
      };
      const { data: existing } = await supabase.from(target).select("id").eq("slug", payload.slug).maybeSingle();
      if (existing) payload.slug = `${payload.slug}-${Date.now().toString(36).slice(-4)}`;

      const { error: insErr } = await supabase.from(target).insert(payload);
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from(table).delete().eq("id", item.id);
      if (delErr) throw delErr;

      toast.success(`Перемещено в «${CATALOG_LABELS[target]}»`);
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      qc.invalidateQueries({ queryKey: ["catalog", target] });
      navigate({ to: "/admin/catalog/$type", params: { type: target } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось переместить");
    } finally {
      setMoving(false);
    }
  };

  const otherTables = CATALOG_TABLES.filter((t) => t !== table);
  const featuresValue = asArray<FeatureItem>(form.features);
  const extrasValue = asArray<ExtraItem>(form.extras);
  const minPrice = minPriceFromTiers(getTiers(form.pricing));
  const publicHref = useMemo(() => {
    return publicHrefFor(table, { slug: form.slug as string | null, published: !!form.published });
  }, [form.published, form.slug, table]);

  return (
    <AdminEditorShell
      saveState={saveState}
      draftSavedAt={draftSavedAt}
      errorMessage={errorMessage}
      switches={
        <>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            {form.published ? "Опубликовано" : "Черновик"}
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Действия" disabled={moving}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!publicHref}
                onClick={() => openInNewTab(publicHref)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть на сайте
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />Дублировать
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ChevronDown className="h-4 w-4 mr-2 -rotate-90" />Переместить в…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {otherTables.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => moveTo(t)}>
                      {CATALOG_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {/* === Основное === */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Заголовок" required error={errors["title"]}>
          <Input value={form.title ?? ""} onChange={(e) => onTitleChange(e.target.value)} />
        </Field>
        <Field label="Категория">
          <CategoryCombobox entityType={table} value={form.category ?? null} onChange={(v) => setForm({ ...form, category: v })} />
        </Field>
      </div>

      <PriceTableEditor
        value={(form.pricing as PricingValue | null | undefined) ?? {}}
        onChange={(next) => setForm({ ...form, pricing: next as unknown as Json })}
      />
      <div className="text-xs text-muted-foreground -mt-1">
        Цена «от» автоматически: {minPrice !== null ? fmtCurrency(minPrice) : "по запросу"}
      </div>

      <Field label="Описание">
        <Textarea
          rows={6}
          className="border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>

      <div>
        <Label className="mb-2 block">Медиа</Label>
        <UniversalMediaUploader
          entity={table}
          slug={form.slug || item.id}
          photoUrls={form.photo_urls ?? []}
          videoUrls={form.video_urls ?? []}
          onChange={({ photoUrls, videoUrls }) => setForm({ ...form, photo_urls: photoUrls, video_urls: videoUrls })}
        />
      </div>

      {/* === Доп. поля === */}
      <CollapsibleSection title="Доп. поля">
        <Field label="Требования">
          <Textarea rows={3} value={form.requirements ?? ""} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
        </Field>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-4">
            <FeaturesEditor value={featuresValue} onChange={(next) => setForm({ ...form, features: next as Json })} />
          </div>
          <div className="glass rounded-xl p-4">
            <ExtrasEditor value={extrasValue} onChange={(next) => setForm({ ...form, extras: next as Json })} />
          </div>
        </div>
      </CollapsibleSection>

      {/* === SEO и URL === */}
      <CollapsibleSection title="SEO и URL">
        <Field label="Slug (URL)" required error={errors["slug"]} hint="Строчная латиница, цифры и дефис">
          <Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="SEO title" error={errors["seo_title"]}>
            <Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
          </Field>
          <Field label="SEO description" error={errors["seo_description"]}>
            <Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
          </Field>
        </div>
      </CollapsibleSection>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Запись будет удалена без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {guardDialog}
    </AdminEditorShell>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border/50 rounded-xl">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 rounded-xl">
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
