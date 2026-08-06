// Admin: управление занятостью каталога (бронирования / обслуживание).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";

export const Route = createFileRoute("/admin/availability")({ component: Page });

const TYPES = [
  { v: "zones", l: "Зоны" },
  { v: "tech_equipment", l: "Оборудование" },
  { v: "services", l: "Услуги" },
  { v: "production_items", l: "Производство" },
  { v: "attractions", l: "Аттракционы" },
] as const;

type EntityType = typeof TYPES[number]["v"];

function Page() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState<EntityType>("zones");
  const [itemId, setItemId] = useState<string>("");
  const [form, setForm] = useState({ start_date: "", end_date: "", status: "booked" as "booked" | "maintenance" });
  const { confirm: confirmDelete, dialog: confirmDialog } = useConfirm();

  const { data: items = [] } = useQuery({
    queryKey: ["admin-availability-items", entityType],
    queryFn: async () => {
      const { data } = await supabase.from(entityType).select("id, title").order("title");
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-availability", entityType, itemId],
    queryFn: async () => {
      const { data } = await supabase.from("availability")
        .select("*").eq("entity_type", entityType).eq("item_id", itemId)
        .order("start_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!itemId,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!itemId || !form.start_date || !form.end_date) throw new Error("Заполните все поля");
      const { error } = await supabase.from("availability").insert({
        entity_type: entityType, item_id: itemId,
        start_date: form.start_date, end_date: form.end_date, status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-availability"] });
      toast.success("Добавлено");
      setForm({ start_date: "", end_date: "", status: "booked" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-availability"] }); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Занятость каталога"
        subtitle="Брони и периоды обслуживания. Отображаются клиентам на странице товара."
      />

      <div className="glass rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <Field label="Раздел">
          <Select value={entityType} onValueChange={(v) => { setEntityType(v as EntityType); setItemId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Позиция">
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger><SelectValue placeholder="Выберите..." /></SelectTrigger>
            <SelectContent>
              {items.map((it: { id: string; title: string }) => <SelectItem key={it.id} value={it.id}>{it.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {itemId && (
        <>
          <div className="glass rounded-xl p-5">
            <h2 className="font-semibold mb-4">Добавить период</h2>
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <Field label="С">
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="По">
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
              <Field label="Статус">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "booked" | "maintenance" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booked">Занято</SelectItem>
                    <SelectItem value="maintenance">Обслуживание</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button onClick={() => add.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
            </div>
          </div>

          <div className="glass rounded-xl p-5">
            <h2 className="font-semibold mb-3">Существующие периоды</h2>
            {isLoading && <div className="text-sm text-muted-foreground">Загрузка...</div>}
            {!isLoading && rows.length === 0 && <div className="text-sm text-muted-foreground">Нет записей</div>}
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div className="text-sm flex items-center gap-3">
                    <span className="font-medium">{r.start_date} → {r.end_date}</span>
                    <StatusPill tone={r.status === "booked" ? "danger" : "warning"}>
                      {r.status === "booked" ? "Занято" : "Обслуживание"}
                    </StatusPill>
                  </div>
                  <Button variant="ghost" size="sm" onClick={async () => { if (await confirmDelete({ title: "Удалить запись?", confirmText: "Удалить", destructive: true })) remove.mutate(r.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
