// Админка отзывов: список + редактор.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save, Star } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { persistSortOrder } from "@/lib/sort-order";

export const Route = createFileRoute("/admin/testimonials")({ component: Page });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function Page() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => (await supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("testimonials")
        .insert({ client_name: "Новый клиент", text: "Отличная работа!", rating: 5, published: false })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Отзывы</h1>
          <p className="text-sm text-muted-foreground">{items.length} записей</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="glass rounded-xl p-3 max-h-[75vh] overflow-y-auto">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
          <SortableList
            items={items as Row[]}
            onReorder={async (ids) => {
              try { await persistSortOrder("testimonials", ids); qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); }
              catch (e) { toast.error((e as Error).message); throw e; }
            }}
            className="space-y-1"
            renderItem={(it, handle) => (
              <div className={`flex items-center gap-1 rounded-lg ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
                {handle}
                <button
                  onClick={() => setSelected(it)}
                  className="flex-1 text-left p-3 text-sm min-w-0"
                >
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {it.featured && <Star className="h-3 w-3 fill-current shrink-0" />}
                    <span className="truncate">{it.client_name}</span>
                  </div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span>{"★".repeat(it.rating)}</span>
                    {it.published ? <span className="text-success">● опубликовано</span> : <span>○ черновик</span>}
                  </div>
                </button>
              </div>
            )}
          />
        </div>

        {selected ? (
          <Editor key={selected.id} row={selected} onDelete={() => remove.mutate(selected.id)} />
        ) : (
          <div className="glass rounded-xl p-12 text-center text-muted-foreground">Выберите отзыв или создайте новый</div>
        )}
      </div>
    </div>
  );
}

function Editor({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Row>(row);

  const save = useMutation({
    mutationFn: async () => {
      const patch = {
        client_name: f.client_name,
        client_company: f.client_company || null,
        client_role: f.client_role || null,
        client_photo_url: f.client_photo_url || null,
        rating: Number(f.rating) || 5,
        text: f.text,
        event_date: f.event_date || null,
        published: !!f.published,
        featured: !!f.featured,
        sort_order: Number(f.sort_order) || 0,
      };
      const { error } = await supabase.from("testimonials").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); toast.success("Сохранено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">{f.client_name || "Без имени"}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.published} onCheckedChange={(v) => setF({ ...f, published: v })} /> Опубликовано</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.featured} onCheckedChange={(v) => setF({ ...f, featured: v })} /> Featured</label>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm("Удалить?")) onDelete(); }}><Trash2 className="h-4 w-4" /></Button>
          <Button onClick={() => save.mutate()} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-2" />Сохранить</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Имя клиента *</Label><Input value={f.client_name ?? ""} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Компания</Label><Input value={f.client_company ?? ""} onChange={(e) => setF({ ...f, client_company: e.target.value })} /></div>
        <div className="space-y-2"><Label>Должность</Label><Input value={f.client_role ?? ""} onChange={(e) => setF({ ...f, client_role: e.target.value })} /></div>
        <div className="space-y-2"><Label>URL фото</Label><Input value={f.client_photo_url ?? ""} onChange={(e) => setF({ ...f, client_photo_url: e.target.value })} /></div>
        <div className="space-y-2"><Label>Оценка (1–5)</Label><Input type="number" min={1} max={5} value={f.rating ?? 5} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} /></div>
        <div className="space-y-2"><Label>Дата мероприятия</Label><Input type="date" value={f.event_date ?? ""} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Порядок сортировки</Label><Input type="number" value={f.sort_order ?? 0} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></div>
      </div>

      <div className="space-y-2"><Label>Текст отзыва *</Label><Textarea rows={6} value={f.text ?? ""} onChange={(e) => setF({ ...f, text: e.target.value })} /></div>
    </div>
  );
}
