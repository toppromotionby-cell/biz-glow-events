// Универсальный CRUD каталогов: zones | tech_equipment | services | production_items.
import { createFileRoute, useParams } from "@tanstack/react-router";
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
import { Plus, Trash2, Save } from "lucide-react";

const TABLES = ["zones", "tech_equipment", "services", "production_items"] as const;
type Table = (typeof TABLES)[number];

const LABELS: Record<Table, string> = {
  zones: "Зоны", tech_equipment: "Оборудование", services: "Услуги", production_items: "Производство",
};

export const Route = createFileRoute("/admin/catalog/$type")({
  component: CatalogAdmin,
});

function CatalogAdmin() {
  const { type } = useParams({ from: "/admin/catalog/$type" });
  if (!TABLES.includes(type as Table)) return <div>Неизвестный тип каталога</div>;
  return <CatalogInner table={type as Table} />;
}

function CatalogInner({ table }: { table: Table }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog", table],
    queryFn: async () => (await supabase.from(table).select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const slug = `new-${Date.now()}`;
      const { data, error } = await supabase.from(table).insert({ title: "Новая запись", slug, published: false }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(row); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">{LABELS[table]}</h1>
          <p className="text-sm text-muted-foreground">{items.length} записей</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="glass rounded-xl p-3 max-h-[70vh] overflow-y-auto space-y-1">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
          {items.map((it: any) => (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className={`w-full text-left p-3 rounded-lg text-sm transition ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium truncate">{it.title}</div>
              <div className="text-xs opacity-70 flex items-center gap-2">
                <span>{it.slug}</span>
                {it.published ? <span className="text-success">● опубликовано</span> : <span>○ черновик</span>}
              </div>
            </button>
          ))}
        </div>

        <div>
          {selected ? <Editor key={selected.id} table={table} item={selected} onDelete={() => remove.mutate(selected.id)} onSaved={() => qc.invalidateQueries({ queryKey: ["catalog", table] })} /> : (
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">Выберите запись или создайте новую</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ table, item, onSaved, onDelete }: { table: Table; item: any; onSaved: () => void; onDelete: () => void }) {
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from(table).update({
      title: form.title, slug: form.slug, category: form.category,
      short_description: form.short_description, description: form.description,
      requirements: form.requirements, seo_title: form.seo_title, seo_description: form.seo_description,
      published: form.published, photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
      pricing: form.pricing ?? {}, features: form.features ?? [], faq: form.faq ?? [],
    }).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onSaved();
  };

  return (
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
          <span className="text-sm">{form.published ? "Опубликовано" : "Черновик"}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Удалить</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Заголовок</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div><Label>Категория</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><Label>Цена «от» (BYN)</Label>
          <Input type="number" value={form.pricing?.from ?? ""} onChange={(e) => setForm({ ...form, pricing: { ...(form.pricing ?? {}), from: Number(e.target.value) } })} />
        </div>
      </div>

      <div><Label>Краткое описание</Label><Textarea rows={2} value={form.short_description ?? ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></div>
      <div><Label>Описание</Label><Textarea rows={6} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Требования</Label><Textarea rows={3} value={form.requirements ?? ""} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>SEO title</Label><Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
        <div><Label>SEO description</Label><Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
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
    </div>
  );
}
