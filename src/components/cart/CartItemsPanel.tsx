import { Trash2 } from "lucide-react";
import { type CartItem, removeFromCart, updateQty, clearCart } from "@/lib/cart";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { PromoCodeInput } from "@/components/PromoCodeInput";
import { type PromoValidation } from "@/lib/promo.functions";
import { fmtCurrency } from "@/lib/formatters";

type AppliedPromo = (PromoValidation & { valid: true }) | null;

export function CartItemsPanel({
  items,
  total,
  discount,
  finalTotal,
  promo,
  onApplyPromo,
  onClearPromo,
}: {
  items: CartItem[];
  total: number;
  discount: number;
  finalTotal: number;
  promo: AppliedPromo;
  onApplyPromo: (p: PromoValidation & { valid: true }) => void;
  onClearPromo: () => void;
}) {
  return (
    <section className="lg:col-span-3 space-y-3">
      {items.map((i) => (
        <article key={`${i.entity_type}:${i.id}`} className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
          {i.image ? (
            <img src={i.image} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-md bg-surface" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{i.title}</div>
            <div className="text-xs text-muted-foreground">{i.price > 0 ? `${fmtCurrency(i.price)} × ${i.qty}` : "По запросу"}</div>
          </div>
          <QtyStepper
            value={i.qty}
            onChange={(next) => updateQty(i.id, i.entity_type, next)}
            label={i.title}
          />
          <div className="w-24 text-right text-sm font-semibold">{fmtCurrency(i.price * i.qty)}</div>
          <button
            type="button"
            onClick={() => removeFromCart(i.id, i.entity_type)}
            aria-label={`Удалить ${i.title}`}
            className="btn-icon-danger h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </article>
      ))}
      <div className="flex justify-between items-center pt-3">
        <button
          type="button"
          onClick={clearCart}
          className="btn-icon-danger inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Очистить корзину
        </button>
        <div className="text-right">
          {discount > 0 && (
            <div className="text-sm text-muted-foreground">
              Сумма: {fmtCurrency(total)} · Скидка: <span className="text-success">−{fmtCurrency(discount)}</span>
            </div>
          )}
          <div className="text-lg font-display font-bold">Итого: <span className="gradient-text">{fmtCurrency(finalTotal)}</span></div>
        </div>
      </div>
      <details className="mt-3 group" open={!!promo}>
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 select-none">
          <span className="inline-block transition-transform group-open:rotate-90">›</span>
          {promo ? `Промокод применён: ${promo.code}` : "Есть промокод?"}
        </summary>
        <div className="mt-3">
          <PromoCodeInput
            orderTotal={total}
            applied={promo}
            onApply={onApplyPromo}
            onClear={onClearPromo}
          />
        </div>
      </details>
    </section>
  );
}
