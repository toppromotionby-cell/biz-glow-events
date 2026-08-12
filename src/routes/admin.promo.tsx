// Админка промокодов.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { persistSortOrder } from "@/lib/sort-order";

export const Route = createFileRoute("/admin/promo")({ component: Page });

import type { Database } from "@/integrations/supabase/types";
type Row = Database["public"]["Tables"]["promo_codes"]["Row"];

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
      <AdminPageHeader
        title="Промокоды"
        subtitle={`${items.length} кодов`}
        icon={<Tag className="h-7 w-7" />}
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Создать</Button>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <AdminListPanel
          items={items as Row[]}
          isLoading={isLoading}
          emptyText="Нет промокодов"
          onReorder={async (ids) => {
            try { await persistSortOrder("promo_codes", ids); qc.invalidateQueries({ queryKey: ["admin-promo"] }); }
            catch (e) { toast.error((e as Error).message); throw e; }
          }}
          renderItem={(it, handle) => (
            <div className={`flex items-center gap-1 rounded-lg transition ${sel?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
              {handle}
              <button
                type="button"
                onClick={() => setSel(it)}
                aria-pressed={sel?.id === it.id}
                className="flex-1 text-left p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
              >
                <div className="font-mono font-medium truncate">{it.code}</div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <span>{it.discount_type === "percent" ? `${it.discount_value}%` : `${it.discount_value} BYN`}</span>
                  <span>· {it.used_count}{it.max_uses ? `/${it.max_uses}` : ""}</span>
                  <StatusPill tone={it.active ? "success" : "muted"}>{it.active ? "активен" : "выкл"}</StatusPill>
                </div>
              </button>
            </div>
          )}
        />

        {sel ? <Editor key={sel.id} row={sel} onDelete={() => del.mutate(sel.id)} /> : (
          <AdminEmptyEditor
            title="Промокод не выбран"
            description="Выберите код из списка слева или создайте новый — он появится с дефолтной скидкой 10%."
            icon={<Tag className="h-6 w-6" aria-hidden="true" />}
            action={
              <Button onClick={() => create.mutate()} className="btn-primary-gradient">
                <Plus className="h-4 w-4 mr-2" />Создать промокод
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function Editor({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Row>(row);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Возврат к другой записи в списке — сбрасываем форму и статус.
  useEffect(() => {
    setF(row);
    setSaveState("idle");
  }, [row]);

  const patch = (p: Partial<Row>) => {
    setF((prev) => ({ ...prev, ...p }));
    setSaveState("dirty");
  };

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
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["admin-promo"] });
      toast.success("Сохранено");
    },
    onError: (e: Error) => {
      setSaveState("error");
      toast.error(e.message);
    },
  });

  // Защита от потери правок: и при переходах внутри админки, и при закрытии вкладки.
  const { guardDialog } = useUnsavedGuard(saveState === "dirty" || saveState === "error");

  // Ctrl/Cmd+S — сохранить сразу, как в остальных редакторах.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) return;
      e.preventDefault();
      if (!save.isPending) save.mutate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <>
    {guardDialog}
    <AdminEditorShell
      title={<span className="font-mono text-xl">{f.code}</span>}
      switches={
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!f.active} onCheckedChange={(v) => patch({ active: v })} /> Активен
        </label>
      }
      onDelete={onDelete}
      onSave={() => save.mutate()}
      saving={save.isPending}
      saveState={saveState}
      errorMessage={save.error instanceof Error ? save.error.message : null}
    >

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Код" required><Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono" /></Field>
        <Field label="Тип скидки" required>
          <Select value={f.discount_type} onValueChange={(v) => setF({ ...f, discount_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Процент (%)</SelectItem>
              <SelectItem value="fixed">Фикс. сумма (BYN)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Размер скидки" required><Input type="number" min={0} value={f.discount_value ?? 0} onChange={(e) => setF({ ...f, discount_value: Number(e.target.value) || 0 })} /></Field>
        <Field label="Мин. сумма заказа"><Input type="number" min={0} value={f.min_order_total ?? 0} onChange={(e) => setF({ ...f, min_order_total: Number(e.target.value) || 0 })} /></Field>
        <Field label="Действует с"><Input type="datetime-local" value={f.valid_from?.slice(0, 16) ?? ""} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></Field>
        <Field label="Действует до"><Input type="datetime-local" value={f.valid_to?.slice(0, 16) ?? ""} onChange={(e) => setF({ ...f, valid_to: e.target.value })} /></Field>
        <Field label="Лимит применений"><Input type="number" min={1} placeholder="без лимита" value={f.max_uses ?? ""} onChange={(e) => setF({ ...f, max_uses: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Использовано"><Input value={f.used_count ?? 0} readOnly className="opacity-70" /></Field>
      </div>

      <Field label="Описание" hint="Для внутреннего использования">
        <Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
    </AdminEditorShell>
  );
}
