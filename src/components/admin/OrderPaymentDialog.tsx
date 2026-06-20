// Диалог «Внести оплату»: пишет дельту в orders.paid и событие payment_added в timeline.
// История платежей читается из order_timeline по событию payment_added.
import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
] as const;

type Method = (typeof METHODS)[number]["value"];

const MAX_COMMENT_LENGTH = 500;

const paymentSchema = z.object({
  amount: z.coerce.number({ message: "Введите корректную сумму" })
    .positive({ message: "Сумма должна быть больше 0" })
    .finite({ message: "Сумма некорректна" }),
  method: z.enum(METHODS.map((m) => m.value) as [Method, ...Method[]], {
    message: "Выберите метод оплаты",
  }),
  paidAt: z.string().min(1, { message: "Укажите дату платежа" }),
  comment: z.string().max(MAX_COMMENT_LENGTH, {
    message: `Комментарий не длиннее ${MAX_COMMENT_LENGTH} символов`,
  }).optional(),
});

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function validateAmount(raw: string, remaining: number): string | null {
  if (raw.trim() === "") return "Введите сумму";
  const value = parseAmount(raw);
  if (value === null) return "Некорректный формат суммы. Используйте 1234.56 или 1234,56";
  if (value <= 0) return "Сумма должна быть больше 0";
  const parts = raw.replace(",", ".").split(".");
  if (parts[1] && parts[1].length > 2) return "Не более 2 знаков после запятой";
  if (value > remaining * 1000) return "Сумма слишком большая";
  return null;
}

function validateDate(raw: string): string | null {
  if (raw.trim() === "") return "Укажите дату платежа";
  const date = new Date(raw + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "Некорректная дата";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return "Дата платежа не может быть в будущем";
  return null;
}

export function OrderPaymentDialog({ open, onOpenChange, orderId, currentPaid, total }: Props) {
  const qc = useQueryClient();
  const remaining = Math.max(0, total - currentPaid);
  const [amount, setAmount] = useState<string>(remaining > 0 ? String(remaining) : "");
  const [method, setMethod] = useState<Method>("card");
  const [comment, setComment] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Partial<Record<"amount" | "method" | "paidAt" | "comment", string>>>({});
  const [touched, setTouched] = useState<Partial<Record<"amount" | "paidAt" | "comment", boolean>>>({});

  const resetForm = useCallback(() => {
    setAmount(remaining > 0 ? String(remaining) : "");
    setMethod("card");
    setComment("");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setErrors({});
    setTouched({});
  }, [remaining]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const validate = useCallback((): boolean => {
    const nextErrors: typeof errors = {};
    const amountError = validateAmount(amount, remaining);
    if (amountError) nextErrors.amount = amountError;
    if (!METHODS.some((m) => m.value === method)) nextErrors.method = "Выберите метод оплаты";
    const dateError = validateDate(paidAt);
    if (dateError) nextErrors.paidAt = dateError;
    if (comment.length > MAX_COMMENT_LENGTH) {
      nextErrors.comment = `Не более ${MAX_COMMENT_LENGTH} символов`;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [amount, method, paidAt, comment, remaining]);

  const addPayment = useMutation({
    mutationFn: async () => {
      const value = parseAmount(amount);
      if (value === null || value <= 0) throw new Error("Некорректная сумма платежа");
      const payload = {
        amount: value,
        method,
        comment: comment.trim() || null,
        paid_at: paidAt,
      };
      paymentSchema.parse({ ...payload, amount: value });

      const newPaid = currentPaid + value;

      const { error: updErr } = await supabase
        .from("orders")
        .update({ paid: newPaid })
        .eq("id", orderId);
      if (updErr) throw updErr;

      const { error: tlErr } = await supabase.from("order_timeline").insert({
        order_id: orderId,
        event: "payment_added",
        payload,
      });
      if (tlErr) throw tlErr;
    },
    onSuccess: () => {
      toast.success("Платёж зафиксирован");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["order-timeline", orderId] });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast.error(e instanceof z.ZodError ? "Проверьте введённые данные" : e.message);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    addPayment.mutate();
  }, [addPayment, validate]);

  const handleAmountChange = (raw: string) => {
    setAmount(raw);
    if (touched.amount) {
      const err = validateAmount(raw, remaining);
      setErrors((prev) => ({ ...prev, amount: err || undefined }));
    }
  };

  const handleDateChange = (raw: string) => {
    setPaidAt(raw);
    if (touched.paidAt) {
      const err = validateDate(raw);
      setErrors((prev) => ({ ...prev, paidAt: err || undefined }));
    }
  };

  const handleCommentChange = (raw: string) => {
    setComment(raw);
    if (touched.comment) {
      setErrors((prev) => ({ ...prev, comment: raw.length > MAX_COMMENT_LENGTH ? `Не более ${MAX_COMMENT_LENGTH} символов` : undefined }));
    }
  };

  const amountValue = parseAmount(amount);
  const isOverpayment = amountValue !== null && amountValue > remaining && remaining > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Внести оплату</DialogTitle>
          <DialogDescription>
            Остаток к оплате:{" "}
            <span className="text-foreground font-medium">{remaining.toLocaleString("ru-BY")} BYN</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Сумма, BYN</Label>
            <Input
              id="payment-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, amount: true }));
                const err = validateAmount(amount, remaining);
                setErrors((prev) => ({ ...prev, amount: err || undefined }));
              }}
              className={errors.amount ? "border-destructive focus-visible:ring-destructive" : ""}
              autoFocus
              placeholder="0,00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount ? (
              <p className="text-xs text-destructive">{errors.amount}</p>
            ) : isOverpayment ? (
              <p className="text-xs text-amber-500">Сумма больше остатка — будет переплата</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-method">Метод</Label>
            <select
              id="payment-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
              aria-invalid={!!errors.method}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {errors.method && <p className="text-xs text-destructive">{errors.method}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Дата платежа</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidAt}
              onChange={(e) => handleDateChange(e.target.value)}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, paidAt: true }));
                const err = validateDate(paidAt);
                setErrors((prev) => ({ ...prev, paidAt: err || undefined }));
              }}
              className={errors.paidAt ? "border-destructive focus-visible:ring-destructive" : ""}
              max={new Date().toISOString().slice(0, 10)}
              aria-invalid={!!errors.paidAt}
            />
            {errors.paidAt && <p className="text-xs text-destructive">{errors.paidAt}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-comment">Комментарий (опц.)</Label>
            <Input
              id="payment-comment"
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, comment: true }));
                setErrors((prev) => ({ ...prev, comment: comment.length > MAX_COMMENT_LENGTH ? `Не более ${MAX_COMMENT_LENGTH} символов` : undefined }));
              }}
              className={errors.comment ? "border-destructive focus-visible:ring-destructive" : ""}
              placeholder="Номер чека, счёт и т.д."
              aria-invalid={!!errors.comment}
            />
            <div className="flex justify-between">
              {errors.comment ? (
                <p className="text-xs text-destructive">{errors.comment}</p>
              ) : (
                <span />
              )}
              <span className={comment.length > MAX_COMMENT_LENGTH ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {comment.length}/{MAX_COMMENT_LENGTH}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addPayment.isPending}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={addPayment.isPending}>
            {addPayment.isPending ? "Сохранение…" : "Зафиксировать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
