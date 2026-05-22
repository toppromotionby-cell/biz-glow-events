// Админка промокодов: список + редактор (создание/редактирование/удаление через supabase + RLS).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/promo")({ component: Page });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function Page() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Row | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-promo"],
    queryFn: async () => (await supabase.from("promo_codes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const code = `PROMO${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase.from("promo_codes").insert({
        code, discount_type: "percent", discount_value: 10, active: false,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["admin-promo"] }); setSel(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promo"] }); setSel(null); toast.success("Удалён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text flex items-center gap-2">
            <Tag className="h-7 w-7" /> Промокоды
          </h1>
          <p className="text-sm text-muted-foreground">{items.length} кодов</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Создать</Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="glass rounded-xl p-3 max-h-[75vh] overflow-y-auto space-y-1">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
          {items.map((it: Row) => (
            <button key={it.id} onClick={() => setSel(it)}
              className={`w-full text-left p-3 rounded-lg text-sm transition ${sel?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
              <div className="font-mono font-medium truncate">{it.code}</div>
              <div className="text-xs opacity-70 flex items-center gap-2">
                <span>{it.discount_type === "percent" ? `${it.discount_value}%` : `${it.discount_value} BYN`}</span>
                <span>· {it.used_count}{it.max_uses ? `/${it.max_uses}` : ""}</span>
                {it.active ? <span className="text-success">●</span> : <span>○</span>}
              </div>
            </button>
          ))}
        </div>

        {sel ? <Editor key={sel.id} row={sel} onDelete={() => del.mutate(sel.id)} /> : (
          <div className="glass rounded-xl p-12 text-center text-muted-foreground">Выберите промокод или создайте новый</div>
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
        code: String(f.code).trim().toUpperCase(),
        description: f.description || null,
        discount_type: f.discount_type,
        discount_value: Number(f.discount_value) || 0,
        min_order_total: Number(f.min_order_total) || 0,
        valid_from: f.valid_from || null,
        valid_to: f.valid_to || null,
        max_uses: f.max_uses ? Number(f.max_uses) : null,
        active: !!f.active,
      };
      const { error } = await supabase.from("promo_codes").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promo"] }); toast.success("Сохранено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-mono text-xl">{f.code}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Активен
          </label>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm("Удалить?")) onDelete(); }}><Trash2 className="h-4 w-4" /></Button>
          <Button onClick={() => save.mutate()} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-2" />Сохранить</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Код *</Label><Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono" /></div>
        <div className="space-y-2">
          <Label>Тип скидки *</Label>
          <select value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value })}
            className="w-full h-10 rounded-md bg-background/50 border border-border px-3">
            <option value="percent">Процент (%)</option>
            <option value="fixed">Фикс. сумма (BYN)</option>
          </select>
        </div>
        <div className="space-y-2"><Label>Размер скидки *</Label><Input type="number" min={0} value={f.discount_value ?? 0} onChange={(e) => setF({ ...f, discount_value: e.target.value })} /></div>
        <div className="space-y-2"><Label>Мин. сумма заказа</Label><Input type="number" min={0} value={f.min_order_total ?? 0} onChange={(e) => setF({ ...f, min_order_total: e.target.value })} /></div>
        <div className="space-y-2"><Label>Действует с</Label><Input type="datetime-local" value={f.valid_from?.slice(0, 16) ?? ""} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></div>
        <div className="space-y-2"><Label>Действует до</Label><Input type="datetime-local" value={f.valid_to?.slice(0, 16) ?? ""} onChange={(e) => setF({ ...f, valid_to: e.target.value })} /></div>
        <div className="space-y-2"><Label>Лимит применений</Label><Input type="number" min={1} placeholder="без лимита" value={f.max_uses ?? ""} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /></div>
        <div className="space-y-2"><Label>Использовано</Label><Input value={f.used_count ?? 0} readOnly className="opacity-70" /></div>
      </div>

      <div className="space-y-2"><Label>Описание</Label><Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Для внутреннего использования" /></div>
    </div>
  );
}
