// Диалог «Внести оплату»: пишет дельту в orders.paid и событие payment_added в timeline.
// История платежей читается из order_timeline по событию payment_added.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentPaid: number;
  total: number;
}

const METHODS = [
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "transfer", label: "Безнал" },
  { value: "other", label: "Другое" },
];

export function OrderPaymentDialog({ open, onOpenChange, orderId, currentPaid, total }: Props) {
  const qc = useQueryClient();
  const remaining = Math.max(0, total - currentPaid);
  const [amount, setAmount] = useState<string>(remaining > 0 ? String(remaining) : "");
  const [method, setMethod] = useState<string>("card");
  const [comment, setComment] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const addPayment = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      if (!isFinite(value) || value <= 0) throw new Error("Введите положительную сумму");
      const newPaid = currentPaid + value;

      // 1. Обновляем суммарную оплату — триггер сам запишет paid_changed.
      const { error: updErr } = await supabase
        .from("orders")
        .update({ paid: newPaid })
        .eq("id", orderId);
      if (updErr) throw updErr;

      // 2. Пишем подробное событие платежа.
      const { error: tlErr } = await supabase.from("order_timeline").insert({
        order_id: orderId,
        event: "payment_added",
        payload: { amount: value, method, comment: comment || null, paid_at: paidAt },
      });
      if (tlErr) throw tlErr;
    },
    onSuccess: () => {
      toast.success("Платёж зафиксирован");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["order-timeline", orderId] });
      onOpenChange(false);
      setAmount("");
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Внести оплату</DialogTitle>
          <DialogDescription>
            Остаток к оплате: <span className="text-foreground font-medium">{remaining.toLocaleString("ru-BY")} BYN</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <label className="block text-sm">
            <span className="text-muted-foreground">Сумма, BYN</span>
            <Input
              type="number" inputMode="decimal" step="0.01" min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Метод</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            >
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Дата платежа</span>
            <Input
              type="date" value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Комментарий (опц.)</span>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => addPayment.mutate()} disabled={addPayment.isPending}>
            {addPayment.isPending ? "Сохранение…" : "Зафиксировать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
