// Редактирование позиций заказа: inline qty/price, удаление строки, добавление произвольной строки.
// Полноценный пикер каталога — отдельной итерацией, чтобы не раздувать карточку.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/formatters";
import type { Database } from "@/integrations/supabase/types";

type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const ENTITY_LABEL: Record<string, string> = {
  zone: "Зона", service: "Услуга", equipment: "Оборудование",
  tech_equipment: "Оборудование", production: "Продакшн",
  production_item: "Продакшн", extras: "Доп. услуга", custom: "Доп. услуга",
};

interface Props {
  orderId: string;
  items: OrderItemRow[];
}

export function OrderItemsEditor({ orderId, items }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  function startEdit(it: OrderItemRow) {
    setEditingId(it.id);
    setEditQty(String(it.qty));
    setEditPrice(String(it.price));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function recalcTotal() {
    const { data: fresh } = await supabase.from("order_items").select("qty, price").eq("order_id", orderId);
    const total = (fresh ?? []).reduce((s, r) => s + Number(r.price ?? 0) * Number(r.qty ?? 1), 0);
    await supabase.from("orders").update({ total }).eq("id", orderId);
  }

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const qty = Math.max(1, Number(editQty) || 1);
      const price = Number(editPrice.replace(",", ".")) || 0;
      const { error } = await supabase
        .from("order_items")
        .update({ qty, price })
        .eq("id", editingId);
      if (error) throw error;
      await recalcTotal();
    },
    onSuccess: () => {
      toast.success("Позиция обновлена");
      setEditingId(null);
      invalidateOrder(qc, orderId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_items").delete().eq("id", id);
      if (error) throw error;
      await recalcTotal();
    },
    onSuccess: () => {
      toast.success("Позиция удалена");
      invalidateOrder(qc, orderId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const title = newTitle.trim();
      if (!title) throw new Error("Введите название");
      const qty = Math.max(1, Number(newQty) || 1);
      const price = Number(newPrice.replace(",", ".")) || 0;
      const { error } = await supabase.from("order_items").insert({
        order_id: orderId,
        entity_type: "custom",
        title,
        qty,
        price,
      });
      if (error) throw error;
      await recalcTotal();
    },
    onSuccess: () => {
      toast.success("Позиция добавлена");
      setAdding(false);
      setNewTitle(""); setNewQty("1"); setNewPrice("");
      invalidateOrder(qc, orderId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Позиции ({items.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />Добавить
        </Button>
      </div>

      {adding && (
        <div className="grid sm:grid-cols-[1fr_80px_120px_auto] gap-2 mb-3 p-3 rounded-lg border border-border/50 bg-muted/20">
          <Input placeholder="Название позиции" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          <Input type="number" min="1" placeholder="Кол-во" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
          <Input type="number" min="0" step="0.01" placeholder="Цена, BYN" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          <div className="flex gap-1">
            <Button size="sm" onClick={() => addItem.mutate()} disabled={addItem.isPending}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">Позиций нет</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const isEditing = editingId === it.id;
            return (
              <div key={it.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/30 pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {ENTITY_LABEL[it.entity_type] ?? it.entity_type} ·{" "}
                    {isEditing ? (
                      <Input
                        type="number" min="1" value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="inline-flex h-6 w-16 ml-1"
                      />
                    ) : (
                      <span>{it.qty} шт.</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        type="number" min="0" step="0.01" value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="h-8 w-28 text-right"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} title="Сохранить">
                        <Check className="h-4 w-4 text-emerald-400" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} title="Отмена">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium w-24 text-right">{fmtMoney(it.price)}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(it)} title="Редактировать">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeItem.mutate(it.id)} disabled={removeItem.isPending}
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
