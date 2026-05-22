// Поле ввода промокода для корзины. Возвращает применённую скидку через onApply.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag, Loader2, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validatePromo, type PromoValidation } from "@/lib/promo.functions";
import { toast } from "sonner";

type Applied = Extract<PromoValidation, { valid: true }> | (PromoValidation & { valid: true });

export function PromoCodeInput({
  orderTotal,
  applied,
  onApply,
  onClear,
}: {
  orderTotal: number;
  applied: Applied | null;
  onApply: (p: Applied) => void;
  onClear: () => void;
}) {
  const [code, setCode] = useState("");
  const fn = useServerFn(validatePromo);

  const m = useMutation({
    mutationFn: () => fn({ data: { code, order_total: orderTotal } }),
    onSuccess: (res) => {
      if (!res.valid) {
        toast.error(res.reason ?? "Промокод недействителен");
        return;
      }
      onApply(res as Applied);
      toast.success(`Промокод применён: −${res.discount_amount} BYN`);
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 glass rounded-md px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          <span className="font-mono font-medium">{applied.code}</span>
          <span className="text-muted-foreground">
            {applied.discount_type === "percent" ? `−${applied.discount_value}%` : `−${applied.discount_value} BYN`}
          </span>
        </span>
        <button type="button" onClick={onClear} className="text-muted-foreground hover:text-destructive" aria-label="Снять промокод">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 2) m.mutate(); }}
      className="flex gap-2"
    >
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Промокод"
          className="pl-9 uppercase"
          aria-label="Промокод"
        />
      </div>
      <Button type="submit" variant="outline" disabled={m.isPending || code.trim().length < 2}>
        {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
      </Button>
    </form>
  );
}
