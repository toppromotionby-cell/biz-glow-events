// Админка кейсов: список, создание, редактирование, публикация, featured.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { toast } from "sonner";
import { Plus, Trash2, Save, Star } from "lucide-react";

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
    queryFn: async () => (await supabase.from("cases").select("*").order("event_date", { ascending: false, nullsFirst: false })).data ?? [],
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Кейсы</h1>
          <p className="text-sm text-muted-foreground">{items.length} записей</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="glass rounded-xl p-3 max-h-[75vh] overflow-y-auto space-y-1">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
          {items.map((it: CaseRow) => (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className={`w-full text-left p-3 rounded-lg text-sm transition ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium truncate flex items-center gap-1.5">
                {it.featured && <Star className="h-3 w-3 fill-current shrink-0" />}
                <span className="truncate">{it.title}</span>
              </div>
              <div className="text-xs opacity-70 flex items-center gap-2">
                <span>{it.event_date ?? "—"}</span>
                {it.published ? <span className="text-success">● опубликовано</span> : <span>○ черновик</span>}
              </div>
            </button>
          ))}
        </div>

        <div>
          {selected ? (
            <Editor key={selected.id} item={selected}
              onDelete={() => remove.mutate(selected.id)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-cases"] })}
            />
          ) : (
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">Выберите кейс или создайте новый</div>
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
    const { error } = await supabase.from("cases").update({
      title: form.title, slug: form.slug, client: form.client, event_type: form.event_type,
      event_date: form.event_date || null, location: form.location,
      guests_count: form.guests_count ? Number(form.guests_count) : null,
      summary: form.summary, description: form.description,
      cover_url: form.cover_url ?? (form.photo_urls?.[0] ?? null),
      photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
      services_used, metrics,
      seo_title: form.seo_title, seo_description: form.seo_description,
      published: !!form.published, featured: !!form.featured,
    }).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onSaved();
  };

  return (
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            {form.published ? "Опубликовано" : "Черновик"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            <Star className="h-3.5 w-3.5" /> На главную
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Удалить</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Заголовок</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div><Label>Клиент</Label><Input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
        <div><Label>Тип события</Label><Input value={form.event_type ?? ""} onChange={(e) => setForm({ ...form, event_type: e.target.value })} placeholder="Корпоратив / Конференция / Фестиваль" /></div>
        <div><Label>Дата</Label><Input type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
        <div><Label>Локация</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div><Label>Число гостей</Label><Input type="number" value={form.guests_count ?? ""} onChange={(e) => setForm({ ...form, guests_count: e.target.value })} /></div>
        <div><Label>URL обложки (опц.)</Label><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="Иначе берём первое фото" /></div>
      </div>

      <div><Label>Краткое описание</Label><Textarea rows={2} value={form.summary ?? ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
      <div><Label>Полное описание</Label><Textarea rows={6} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

      <div><Label>Услуги (через запятую)</Label><Input value={servicesInput} onChange={(e) => setServicesInput(e.target.value)} placeholder="Сцена и свет, VR-арена, LED-экран" /></div>
      <div><Label>Метрики (JSON)</Label><Textarea rows={4} value={metricsInput} onChange={(e) => setMetricsInput(e.target.value)} className="font-mono text-xs" /></div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>SEO title</Label><Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
        <div><Label>SEO description</Label><Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
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
    </div>
  );
}
