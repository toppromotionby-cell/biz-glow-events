// Админка кейсов: список, создание, редактирование, публикация, featured.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { toast } from "sonner";
import { Plus, Star, Sparkles } from "lucide-react";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { caseSchema } from "@/lib/admin/schemas";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { useEditorHotkeys } from "@/lib/admin/use-editor-hotkeys";
import { generateSeoDescription } from "@/lib/admin/seo";
import type { SaveState } from "@/components/admin/SaveStatus";

export const Route = createFileRoute("/admin/cases")({
  component: CasesAdmin,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CaseRow = any;

function CasesAdmin() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CaseRow | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-cases"],
    queryFn: async () => (await supabase.from("cases").select("*").order("sort_order", { ascending: true }).order("event_date", { ascending: false, nullsFirst: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const slug = `case-${Date.now()}`;
      const { data, error } = await supabase.from("cases")
        .insert({ title: "Новый кейс", slug, published: false })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["admin-cases"] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cases"] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Кейсы"
        subtitle={`${items.length} записей`}
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <AdminListPanel
          items={items as CaseRow[]}
          isLoading={isLoading}
          onReorder={async (ids) => {
            try { await persistSortOrder("cases", ids); qc.invalidateQueries({ queryKey: ["admin-cases"] }); }
            catch (e) { toast.error((e as Error).message); throw e; }
          }}
          renderItem={(it, handle) => (
            <div className={`flex items-center gap-1 rounded-lg ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
              {handle}
              <button onClick={() => setSelected(it)} className="flex-1 text-left p-3 text-sm min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {it.featured && <Star className="h-3 w-3 fill-current shrink-0" />}
                  <span className="truncate">{it.title}</span>
                </div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <span>{it.event_date ?? "—"}</span>
                  <StatusPill tone={it.published ? "success" : "muted"}>
                    {it.published ? "опубликовано" : "черновик"}
                  </StatusPill>
                </div>
              </button>
            </div>
          )}
        />

        <div>
          {selected ? (
            <Editor key={selected.id} item={selected}
              onDelete={() => remove.mutate(selected.id)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-cases"] })}
            />
          ) : (
            <AdminEmptyEditor
              title="Кейс не выбран"
              description="Выберите кейс из списка слева для редактирования или создайте новый."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ item, onSaved, onDelete }: { item: CaseRow; onSaved: () => void; onDelete: () => void }) {
  const [form, setForm] = useState<CaseRow>({ ...item });
  const [saving, setSaving] = useState(false);
  const [servicesInput, setServicesInput] = useState((item.services_used ?? []).join(", "));
  const [metricsInput, setMetricsInput] = useState(JSON.stringify(item.metrics ?? {}, null, 2));

  const save = async () => {
    setSaving(true);
    let metrics: Record<string, unknown> = {};
    try { metrics = JSON.parse(metricsInput || "{}") as Record<string, unknown>; }
    catch { setSaving(false); return toast.error("Метрики: невалидный JSON"); }

    const services_used = servicesInput.split(",").map((s: string) => s.trim()).filter(Boolean);
    const patch = {
      title: form.title, slug: form.slug, client: form.client, event_type: form.event_type,
      event_date: form.event_date || null, location: form.location,
      guests_count: form.guests_count ? Number(form.guests_count) : null,
      summary: form.summary, description: form.description,
      cover_url: form.cover_url ?? (form.photo_urls?.[0] ?? null),
      photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
      services_used, metrics,
      seo_title: form.seo_title, seo_description: form.seo_description,
      published: !!form.published, featured: !!form.featured,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const { error } = await supabase.from("cases").update(patch).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onSaved();
  };

  return (
    <AdminEditorShell
      switches={
        <>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            {form.published ? "Опубликовано" : "Черновик"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            <Star className="h-3.5 w-3.5" /> На главную
          </label>
        </>
      }
      onDelete={onDelete}
      onSave={save}
      saving={saving}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Заголовок"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Slug"><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Клиент"><Input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
        <Field label="Тип события"><Input value={form.event_type ?? ""} onChange={(e) => setForm({ ...form, event_type: e.target.value })} placeholder="Корпоратив / Конференция / Фестиваль" /></Field>
        <Field label="Дата"><Input type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
        <Field label="Локация"><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Число гостей"><Input type="number" value={form.guests_count ?? ""} onChange={(e) => setForm({ ...form, guests_count: e.target.value })} /></Field>
        <Field label="URL обложки (опц.)" hint="Иначе берём первое фото"><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></Field>
      </div>

      <Field label="Краткое описание"><Textarea rows={2} value={form.summary ?? ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
      <Field label="Полное описание"><Textarea rows={6} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>

      <Field label="Услуги (через запятую)"><Input value={servicesInput} onChange={(e) => setServicesInput(e.target.value)} placeholder="Сцена и свет, VR-арена, LED-экран" /></Field>
      <Field label="Метрики (JSON)"><Textarea rows={4} value={metricsInput} onChange={(e) => setMetricsInput(e.target.value)} className="font-mono text-xs" /></Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="SEO title"><Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></Field>
        <Field label="SEO description"><Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></Field>
      </div>

      <div>
        <Label className="mb-2 block">Медиа</Label>
        <UniversalMediaUploader
          entity="cases"
          slug={form.slug || item.id}
          photoUrls={form.photo_urls ?? []}
          videoUrls={form.video_urls ?? []}
          onChange={({ photoUrls, videoUrls }) => setForm({ ...form, photo_urls: photoUrls, video_urls: videoUrls })}
        />
      </div>
    </AdminEditorShell>
  );
}
