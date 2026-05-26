// Универсальный CRUD каталогов: zones | tech_equipment | services | production_items.
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { StorageImg, StorageVideo } from "@/components/StorageMedia";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, X, ArrowRightLeft, Search, Copy, Eye, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { PriceTableEditor, PriceTableView, minPriceFromTiers, getTiers } from "@/components/PriceTable";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { CategoryCombobox } from "@/components/admin/CategoryCombobox";
import { FeaturesEditor } from "@/components/admin/FeaturesEditor";
import { ExtrasEditor } from "@/components/admin/ExtrasEditor";
import { Info } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Признак «черновика»: нет фото / нет цены / нет описания.
function draftIssues(it: any): string[] {
  const issues: string[] = [];
  if (!it.photo_urls?.length) issues.push("нет фото");
  if (!getTiers(it.pricing).length) issues.push("нет цены");
  if (!it.short_description && !it.description) issues.push("нет описания");
  return issues;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preview, setPreview] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // Сбрасываем выделение при смене таблицы.
  useEffect(() => { setSelectedIds(new Set()); }, [table]);

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

  // Дублирование карточки: создаём копию с уникальным slug.
  const duplicate = useMutation({
    mutationFn: async (src: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, slug, title, ...rest } = src;
      const newSlug = `${slug ?? "copy"}-${Date.now().toString(36).slice(-4)}`;
      const { data, error } = await supabase.from(table).insert({
        ...rest,
        slug: newSlug,
        title: `${title ?? "Без названия"} (копия)`,
        published: false,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(row); toast.success("Карточка скопирована"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk-операции: публикация/снятие/удаление выбранных.
  const bulkPublish = useMutation({
    mutationFn: async (published: boolean) => {
      if (selectedIds.size === 0) return;
      const { error } = await supabase.from(table).update({ published }).in("id", [...selectedIds]);
      if (error) throw error;
    },
    onSuccess: (_d, published) => {
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      toast.success(`${selectedIds.size} ${published ? "опубликовано" : "снято с публикации"}`);
      setSelectedIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) return;
      const { error } = await supabase.from(table).delete().in("id", [...selectedIds]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      toast.success(`Удалено: ${selectedIds.size}`);
      setSelectedIds(new Set());
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Подсветка строки = «то, что сейчас открыто пользователю» (preview либо editor).
  const activeId = preview?.id ?? selected?.id;

  // Локальный поиск по карточкам (название, slug, категория, описание).
  const q = search.trim().toLowerCase();
  const filtered = q
    ? (items as any[]).filter((it) => {
        const hay = [it.title, it.slug, it.category, it.short_description, it.description]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : (items as any[]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((it: any) => selectedIds.has(it.id));
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((it: any) => it.id)));
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={LABELS[table]}
        subtitle={`${items.length} записей · клик по записи открывает подробный просмотр`}
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>}
      />

      {selectedIds.size > 0 && (
        <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2 sticky top-2 z-20 border border-primary/40">
          <span className="text-sm font-medium mr-2">Выбрано: {selectedIds.size}</span>
          <Button size="sm" variant="outline" onClick={() => bulkPublish.mutate(true)} disabled={bulkPublish.isPending}>
            <Eye className="h-4 w-4 mr-1" />Опубликовать
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkPublish.mutate(false)} disabled={bulkPublish.isPending}>
            <EyeOff className="h-4 w-4 mr-1" />Снять с публикации
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            onClick={() => setBulkConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />Удалить
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            Снять выделение
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по карточкам…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Очистить"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Выбрать все" />
                <span>Выбрать все ({filtered.length})</span>
              </label>
              {q && <span>Найдено: {filtered.length} из {items.length}</span>}
            </div>
          )}
        <AdminListPanel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items={filtered as any[]}
          isLoading={isLoading}
          emptyText={q ? "Ничего не найдено" : "Пока нет карточек"}
          emptyAction={!q && (
            <Button size="sm" onClick={() => create.mutate()} className="btn-primary-gradient">
              <Plus className="h-4 w-4 mr-1" />Добавить первую
            </Button>
          )}
          onReorder={q ? undefined : async (ids) => {
            try { await persistSortOrder(table, ids); qc.invalidateQueries({ queryKey: ["catalog", table] }); }
            catch (e) { toast.error((e as Error).message); throw e; }
          }}
          renderItem={(it, handle) => {
            const issues = draftIssues(it);
            const checked = selectedIds.has(it.id);
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(it)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview(it); } }}
                className={`group relative w-full text-left p-3 rounded-lg text-sm transition cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeId === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}
              >
                {handle}
                <span onClick={(e) => { e.stopPropagation(); toggleId(it.id); }} className="shrink-0">
                  <Checkbox checked={checked} aria-label={`Выбрать ${it.title}`} />
                </span>
                {it.photo_urls?.[0] ? (
                  <StorageImg path={it.photo_urls[0]} className="h-10 w-10 rounded object-cover shrink-0" fallbackClassName="h-10 w-10 rounded shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted/40 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    <span className="truncate">{it.title}</span>
                    {issues.length > 0 && (
                      <span title={`Черновик: ${issues.join(", ")}`} className="shrink-0 text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span className="truncate">{it.slug}</span>
                    <StatusPill tone={it.published ? "success" : "muted"}>{it.published ? "опубл." : "черн."}</StatusPill>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); duplicate.mutate(it); }}
                    title="Дублировать"
                    aria-label="Дублировать"
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/30"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(it); }}
                    title="Редактировать"
                    aria-label="Редактировать"
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/30"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          }}
        />
        </div>

        <div>
          {selected ? (
            <Editor
              key={selected.id}
              table={table}
              item={selected}
              onDelete={() => remove.mutate(selected.id)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["catalog", table] })}
            />
          ) : preview ? (
            <PreviewPanel
              item={preview}
              onClose={() => setPreview(null)}
              onEdit={(it: any) => { setSelected(it); setPreview(null); }}
            />

          ) : (
            <AdminEmptyEditor
              title="Запись не выбрана"
              description="Кликните по карточке слева для подробного просмотра, либо добавьте новую — список поддерживает перетаскивание."
              action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-1" />Создать карточку</Button>}
            />
          )}
        </div>
      </div>


      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {selectedIds.size} карточек?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Выбранные карточки будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDelete.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


type PreviewDialogProps = { item: any | null; onClose: () => void; onEdit: (it: any) => void };
function PreviewDialog({ item, onClose, onEdit }: PreviewDialogProps) {
  const open = !!item;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
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
                    <div key={i} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted/30">
                      <StorageImg path={url} alt={`${item.title} #${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition" fallbackClassName="h-full w-full" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(item.video_urls?.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Видео ({item.video_urls.length})</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {item.video_urls.map((url: string, i: number) => (
                    <StorageVideo key={i} path={url} className="w-full rounded-lg bg-black aspect-video" />
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Что входит</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {item.features.map((f: any, i: number) => (
                    <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(item.extras) && item.extras.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2"><Info className="h-3.5 w-3.5" />Дополнительно</h3>
                <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {item.extras.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between gap-3 border-b border-border/30 py-1">
                      <dt className="text-muted-foreground">{r?.label ?? ""}</dt>
                      <dd className="font-medium text-right">{r?.value ?? ""}</dd>
                    </div>
                  ))}
                </dl>
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
              <Button onClick={() => onEdit(item)} className="bg-gradient-primary glow-primary"><Pencil className="h-4 w-4 mr-1" />Редактировать</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ table, item, onSaved, onDelete }: { table: Table; item: any; onSaved: () => void; onDelete: () => void }) {
  const draftKey = `catalog-draft:${table}:${item.id}`;
  // Восстанавливаем черновик из localStorage (если есть и новее серверного updated_at).
  const [form, setForm] = useState(() => {
    if (typeof window === "undefined") return { ...item };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt: number; data: any };
        if (cached?.data && cached.savedAt > new Date(item.updated_at ?? 0).getTime()) {
          return { ...item, ...cached.data };
        }
      }
    } catch { /* ignore */ }
    return { ...item };
  });
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Table | "">("");
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

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from(table).update({
      title: form.title, slug: form.slug, category: form.category,
      short_description: form.short_description, description: form.description,
      requirements: form.requirements, seo_title: form.seo_title, seo_description: form.seo_description,
      published: form.published, photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
      pricing: form.pricing ?? {}, features: form.features ?? [], extras: form.extras ?? [], faq: form.faq ?? [],
    }).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setHasDraft(false);
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
        pricing: form.pricing ?? {}, features: form.features ?? [], extras: form.extras ?? [], faq: form.faq ?? [],
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось переместить");
    } finally {
      setMoving(false);
      setMoveTarget("");
    }
  };

  const otherTables = TABLES.filter((t) => t !== table);

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
          <span className="hidden">{/* placeholder */}</span>
          <div className="flex items-center gap-1">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <Select value={moveTarget} onValueChange={(v) => { setMoveTarget(v as Table); moveTo(v as Table); }} disabled={moving}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder={moving ? "Перемещение..." : "Переместить в..."} /></SelectTrigger>
              <SelectContent>
                {otherTables.map((t) => <SelectItem key={t} value={t}>{LABELS[t]}</SelectItem>)}
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
        value={form.pricing ?? {}}
        onChange={(next) => setForm({ ...form, pricing: next })}
      />
      <div className="text-xs text-muted-foreground -mt-1">
        Цена «от» автоматически: {(() => {
          const m = minPriceFromTiers(getTiers(form.pricing));
          return m !== null ? new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(m) : "по запросу";
        })()}
      </div>

      <Field label="Краткое описание"><Textarea rows={2} className="border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30" value={form.short_description ?? ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></Field>
      <Field label="Описание"><Textarea rows={6} className="border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Требования"><Textarea rows={3} value={form.requirements ?? ""} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></Field>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <FeaturesEditor value={form.features} onChange={(next) => setForm({ ...form, features: next })} />
        </div>
        <div className="glass rounded-xl p-4">
          <ExtrasEditor value={form.extras} onChange={(next) => setForm({ ...form, extras: next })} />
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

