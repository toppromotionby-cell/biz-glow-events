// Редактор карточки каталога: общий для zones / tech_equipment / services / production_items.
// Авто-сохранение черновика в localStorage, перенос карточки между типами, save через supabase.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { AdminEditorShell } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { CategoryCombobox } from "@/components/admin/CategoryCombobox";
import { FeaturesEditor } from "@/components/admin/FeaturesEditor";
import { ExtrasEditor } from "@/components/admin/ExtrasEditor";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { PriceTableEditor, minPriceFromTiers, getTiers, type PricingValue } from "@/components/PriceTable";
import { fmtCurrency } from "@/lib/formatters";
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
}: {
  table: CatalogTable;
  item: Row;
  onSaved: () => void;
  onDelete: () => void;
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
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [moveTarget, setMoveTarget] = useState<CatalogTable | "">("");
  const [moving, setMoving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Автосохранение черновика (debounce 500ms).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), data: form }));
        setHasDraft(true);
      } catch { /* quota */ }
    }, 500);
    return () => clearTimeout(t);
  }, [form, draftKey]);

  const buildPatch = (): CatalogUpdate => ({
    title: form.title, slug: form.slug, category: form.category,
    short_description: form.short_description, description: form.description,
    requirements: form.requirements, seo_title: form.seo_title, seo_description: form.seo_description,
    published: form.published, photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
    pricing: form.pricing ?? {}, features: form.features ?? [], extras: form.extras ?? [], faq: form.faq ?? [],
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from(table).update(buildPatch()).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setHasDraft(false);
    toast.success("Сохранено");
    onSaved();
  };

  const moveTo = async (target: CatalogTable) => {
    if (target === table) return;
    setMoving(true);
    try {
      const patch = buildPatch();
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
      setMoveTarget("");
    }
  };

  const otherTables = CATALOG_TABLES.filter((t) => t !== table);
  const featuresValue = asArray<FeatureItem>(form.features);
  const extrasValue = asArray<ExtraItem>(form.extras);
  const minPrice = minPriceFromTiers(getTiers(form.pricing));

  return (
    <AdminEditorShell
      switches={
        <>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            {form.published ? "Опубликовано" : "Черновик"}
          </label>
          {hasDraft && (
            <span className="text-xs text-amber-300/90 inline-flex items-center gap-1" title="Есть несохранённые изменения, восстановятся после перезагрузки">
              <AlertTriangle className="h-3 w-3" />черновик не сохранён</span>
          )}
          <div className="flex items-center gap-1">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <Select value={moveTarget} onValueChange={(v) => { const next = v as CatalogTable; setMoveTarget(next); moveTo(next); }} disabled={moving}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder={moving ? "Перемещение..." : "Переместить в..."} /></SelectTrigger>
              <SelectContent>
                {otherTables.map((t) => <SelectItem key={t} value={t}>{CATALOG_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </>
      }
      onDelete={onDelete}
      onSave={save}
      saving={saving}
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Заголовок"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Slug"><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Категория"><CategoryCombobox entityType={table} value={form.category ?? null} onChange={(v) => setForm({ ...form, category: v })} /></Field>
      </div>

      <PriceTableEditor
        value={(form.pricing as PricingValue | null | undefined) ?? {}}
        onChange={(next) => setForm({ ...form, pricing: next as unknown as Json })}
      />
      <div className="text-xs text-muted-foreground -mt-1">
        Цена «от» автоматически: {minPrice !== null ? fmtCurrency(minPrice) : "по запросу"}
      </div>

      <Field label="Краткое описание"><Textarea rows={2} className="border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30" value={form.short_description ?? ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></Field>
      <Field label="Описание"><Textarea rows={6} className="border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Требования"><Textarea rows={3} value={form.requirements ?? ""} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></Field>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <FeaturesEditor value={featuresValue} onChange={(next) => setForm({ ...form, features: next as Json })} />
        </div>
        <div className="glass rounded-xl p-4">
          <ExtrasEditor value={extrasValue} onChange={(next) => setForm({ ...form, extras: next as Json })} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="SEO title"><Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></Field>
        <Field label="SEO description"><Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></Field>
      </div>

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
    </AdminEditorShell>
  );
}
