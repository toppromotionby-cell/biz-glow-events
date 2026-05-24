// Универсальный CRUD каталогов: zones | tech_equipment | services | production_items.
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save, Pencil, X, ArrowRightLeft } from "lucide-react";
import { PriceTableEditor, PriceTableView, minPriceFromTiers, getTiers } from "@/components/PriceTable";
import { SortableList } from "@/components/admin/SortableList";
import { persistSortOrder } from "@/lib/sort-order";

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
  const [preview, setPreview] = useState<any | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog", table],
    queryFn: async () => (await supabase.from(table).select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const slug = `new-${Date.now()}`;
      const { data, error } = await supabase.from(table).insert({ title: "Новая запись", slug, published: false }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">{LABELS[table]}</h1>
          <p className="text-sm text-muted-foreground">{items.length} записей · клик по записи открывает подробный просмотр</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="glass rounded-xl p-3 max-h-[70vh] overflow-y-auto">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
          <SortableList
            items={items as any[]}
            onReorder={async (ids) => {
              try { await persistSortOrder(table, ids); qc.invalidateQueries({ queryKey: ["catalog", table] }); }
              catch (e) { toast.error((e as Error).message); throw e; }
            }}
            className="space-y-1"
            renderItem={(it, handle) => (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(it)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview(it); } }}
                className={`group relative w-full text-left p-3 rounded-lg text-sm transition cursor-pointer flex items-center gap-2 ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}
              >
                {handle}
                {it.photo_urls?.[0] ? (
                  <img src={it.photo_urls[0]} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted/40 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span className="truncate">{it.slug}</span>
                    {it.published ? <span className="text-success">●</span> : <span>○</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelected(it); }}
                  title="Редактировать"
                  className="opacity-0 group-hover:opacity-100 transition inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          />
        </div>

        <div>
          {selected ? <Editor key={selected.id} table={table} item={selected} onDelete={() => remove.mutate(selected.id)} onSaved={() => qc.invalidateQueries({ queryKey: ["catalog", table] })} /> : (
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">Кликните по записи для подробного просмотра или нажмите «Добавить»</div>
          )}
        </div>
      </div>

      <PreviewDialog
        item={preview}
        onClose={() => setPreview(null)}
        onEdit={(it) => { setSelected(it); setPreview(null); }}
      />
    </div>
  );
}

type PreviewDialogProps = { item: any | null; onClose: () => void; onEdit: (it: any) => void };
function PreviewDialog({ item, onClose, onEdit }: PreviewDialogProps) {
  const open = !!item;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display flex items-center gap-3 flex-wrap">
                {item.title}
                {item.published
                  ? <Badge className="bg-success/20 text-success border-success/30">Опубликовано</Badge>
                  : <Badge variant="outline">Черновик</Badge>}
                {item.category && <Badge variant="secondary">{item.category}</Badge>}
              </DialogTitle>
              <DialogDescription className="sr-only">Редактирование позиции каталога</DialogDescription>
              {item.short_description && (
                <p className="text-sm text-muted-foreground mt-2">{item.short_description}</p>
              )}
            </DialogHeader>

            {(item.photo_urls?.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Фотографии ({item.photo_urls.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {item.photo_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted/30">
                      <img src={url} alt={`${item.title} #${i + 1}`} loading="lazy" className="h-full w-full object-cover hover:scale-105 transition" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {(item.video_urls?.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Видео ({item.video_urls.length})</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {item.video_urls.map((url: string, i: number) => (
                    <video key={i} src={url} controls className="w-full rounded-lg bg-black aspect-video" />
                  ))}
                </div>
              </section>
            )}

            {item.description && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Полное описание</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
              </section>
            )}

            {item.requirements && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Требования</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.requirements}</p>
              </section>
            )}

            {Array.isArray(item.features) && item.features.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Особенности</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {item.features.map((f: any, i: number) => (
                    <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
                  ))}
                </ul>
              </section>
            )}

            {getTiers(item.pricing).length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Цены</h3>
                <PriceTableView pricing={item.pricing} />
              </section>
            )}

            {Array.isArray(item.faq) && item.faq.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">FAQ</h3>
                <div className="space-y-2">
                  {item.faq.map((q: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border/50 p-3">
                      <div className="font-medium text-sm">{q.q ?? q.question ?? `Вопрос ${i + 1}`}</div>
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{q.a ?? q.answer ?? ""}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div><span className="font-semibold text-foreground">Slug:</span> {item.slug}</div>
              <div><span className="font-semibold text-foreground">ID:</span> {item.id}</div>
              {item.seo_title && <div><span className="font-semibold text-foreground">SEO title:</span> {item.seo_title}</div>}
              {item.seo_description && <div className="sm:col-span-2"><span className="font-semibold text-foreground">SEO description:</span> {item.seo_description}</div>}
              {item.created_at && <div>Создано: {new Date(item.created_at).toLocaleString("ru-BY")}</div>}
              {item.updated_at && <div>Обновлено: {new Date(item.updated_at).toLocaleString("ru-BY")}</div>}
            </section>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" />Закрыть</Button>
              <Button onClick={() => onEdit(item)} className="bg-gradient-primary glow-primary"><Pencil className="h-4 w-4 mr-1" />Редактировать</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ table, item, onSaved, onDelete }: { table: Table; item: any; onSaved: () => void; onDelete: () => void }) {
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Table | "">("");
  const [moving, setMoving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const moveTo = async (target: Table) => {
    if (target === table) return;
    setMoving(true);
    try {
      // Build payload with shared columns only (no id/created_at/updated_at).
      const payload: any = {
        title: form.title, slug: form.slug, category: form.category,
        short_description: form.short_description, description: form.description,
        requirements: form.requirements, seo_title: form.seo_title, seo_description: form.seo_description,
        published: form.published, photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
        pricing: form.pricing ?? {}, features: form.features ?? [], faq: form.faq ?? [],
      };
      // Handle slug uniqueness in target table
      const { data: existing } = await supabase.from(target).select("id").eq("slug", payload.slug).maybeSingle();
      if (existing) payload.slug = `${payload.slug}-${Date.now().toString(36).slice(-4)}`;

      const { error: insErr } = await supabase.from(target).insert(payload);
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from(table).delete().eq("id", item.id);
      if (delErr) throw delErr;

      toast.success(`Перемещено в «${LABELS[target]}»`);
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      qc.invalidateQueries({ queryKey: ["catalog", target] });
      navigate({ to: "/admin/catalog/$type", params: { type: target } });
    } catch (e: any) {
      toast.error(e.message ?? "Не удалось переместить");
    } finally {
      setMoving(false);
      setMoveTarget("");
    }
  };

  const otherTables = TABLES.filter((t) => t !== table);

  return (
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
          <span className="text-sm">{form.published ? "Опубликовано" : "Черновик"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <Select value={moveTarget} onValueChange={(v) => { setMoveTarget(v as Table); moveTo(v as Table); }} disabled={moving}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder={moving ? "Перемещение..." : "Переместить в..."} /></SelectTrigger>
              <SelectContent>
                {otherTables.map((t) => <SelectItem key={t} value={t}>{LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Удалить</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div><Label>Заголовок</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div><Label>Категория</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
      </div>

      <PriceTableEditor
        value={form.pricing ?? {}}
        onChange={(next) => setForm({ ...form, pricing: next })}
      />
      <div className="text-xs text-muted-foreground -mt-1">
        Цена «от» автоматически: {(() => {
          const m = minPriceFromTiers(getTiers(form.pricing));
          return m !== null ? new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(m) : "по запросу";
        })()}
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
