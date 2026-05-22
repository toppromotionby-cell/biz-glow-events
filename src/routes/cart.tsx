import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart, removeFromCart, updateQty, clearCart } from "@/lib/cart";
import { submitOrder } from "@/lib/orders.functions";
import { readUtm } from "@/lib/utm";
import { PromoCodeInput } from "@/components/PromoCodeInput";
import { DateField } from "@/components/DateField";
import { type PromoValidation } from "@/lib/promo.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";


export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Ваша корзина — event-hub.by" },
      { name: "description", content: "Позиции, добавленные в корзину. Отправьте запрос — мы перезвоним." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CartPage,
});

const fmt = new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 });

function CartPage() {
  const { items, count, total } = useCart();
  const submit = useServerFn(submitOrder);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [promo, setPromo] = useState<(PromoValidation & { valid: true }) | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<null | {
    client_name: string;
    client_phone: string;
    client_email: string;
    client_company: string | null;
    event_date: string | null;
    notes: string | null;
  }>(null);
  const discount = promo?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const fd = new FormData(e.currentTarget);
    setContactDraft({
      client_name: String(fd.get("client_name") ?? "").trim(),
      client_phone: String(fd.get("client_phone") ?? "").trim(),
      client_email: String(fd.get("client_email") ?? "").trim(),
      client_company: String(fd.get("client_company") ?? "").trim() || null,
      event_date: String(fd.get("event_date") ?? "") || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    });
    setReqOpen(true);
  }

  async function finalSubmit(req: {
    company_legal_name: string | null;
    company_unp: string | null;
    company_address: string | null;
    company_bank: string | null;
    contact_person_name: string | null;
    contact_person_position: string | null;
    acting_basis: string | null;
  }) {
    if (!contactDraft) return;
    const utm = readUtm() ?? {};
    setLoading(true);
    try {
      const res = await submit({
        data: {
          ...contactDraft,
          source: "cart",
          promo_code: promo?.code ?? null,
          ...req,
          utm_source: utm.utm_source ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_term: utm.utm_term ?? null,
          utm_content: utm.utm_content ?? null,
          consent_pd: true,
          items: items.map(i => ({
            entity_type: i.entity_type,
            entity_id: i.id,
            title: i.title,
            price: i.price,
            qty: i.qty,
            start_date: i.start_date ?? null,
            end_date: i.end_date ?? null,
          })),
        },
      });
      clearCart();
      setReqOpen(false);
      setDone({ id: res.id });
      toast.success("Заказ оформлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }


  if (done) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="glass rounded-2xl p-8 text-center">
          <h1 className="text-3xl font-display font-bold gradient-text">Заказ принят</h1>
          <p className="mt-3 text-muted-foreground">Номер: <span className="font-mono">{done.id.slice(0, 8)}</span>. Мы свяжемся в течение рабочего дня.</p>
          <Link to="/" className="mt-6 inline-flex rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">На главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold gradient-text">Ваша корзина</h1>
        <p className="mt-2 text-muted-foreground">{count > 0 ? `Позиций: ${count}. Итого: ${fmt.format(total)}` : "Корзина пуста — добавьте позиции из каталога."}</p>
      </header>

      {items.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">Перейдите в каталог и нажмите «В корзину».</p>
          <div className="mt-4 flex justify-center gap-3 flex-wrap">
            <Link to="/zones" className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition">Зоны</Link>
            <Link to="/equipment" className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition">Оборудование</Link>
            <Link to="/services" className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition">Услуги</Link>
            <Link to="/production" className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition">Производство</Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-8">
          <section className="lg:col-span-3 space-y-3">
            {items.map((i) => (
              <article key={`${i.entity_type}:${i.id}`} className="glass rounded-xl p-4 flex gap-4 items-center">
                {i.image ? (
                  <img src={i.image} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-surface" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.price > 0 ? `${fmt.format(i.price)} × ${i.qty}` : "По запросу"}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQty(i.id, i.entity_type, i.qty - 1)}
                    disabled={i.qty <= 1}
                    aria-label={`Уменьшить количество для ${i.title}`}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background/60 text-foreground hover:bg-primary/10 hover:border-primary/40 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{i.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(i.id, i.entity_type, i.qty + 1)}
                    disabled={i.qty >= 99}
                    aria-label={`Увеличить количество для ${i.title}`}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background/60 text-foreground hover:bg-primary/10 hover:border-primary/40 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="w-24 text-right text-sm font-semibold">{fmt.format(i.price * i.qty)}</div>
                <button
                  type="button"
                  onClick={() => removeFromCart(i.id, i.entity_type)}
                  aria-label={`Удалить ${i.title}`}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-destructive/30 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            ))}
            <div className="flex justify-between items-center pt-3">
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Очистить корзину
              </button>
              <div className="text-right">
                {discount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Сумма: {fmt.format(total)} · Скидка: <span className="text-success">−{fmt.format(discount)}</span>
                  </div>
                )}
                <div className="text-lg font-display font-bold">Итого: <span className="gradient-text">{fmt.format(finalTotal)}</span></div>
              </div>
            </div>
            <PromoCodeInput
              orderTotal={total}
              applied={promo}
              onApply={(p) => setPromo(p)}
              onClear={() => setPromo(null)}
            />
          </section>

          <aside className="lg:col-span-2">
            <form onSubmit={onSubmit} className="glass rounded-xl p-5 space-y-3">
              <h2 className="font-display font-semibold">Контактные данные</h2>
              <Field label="Имя *" name="client_name" required />
              <Field label="Телефон *" name="client_phone" type="tel" required />
              <Field label="Email *" name="client_email" type="email" required />
              <Field label="Компания" name="client_company" />
              <DateField label="Дата мероприятия" name="event_date" minDate={new Date(new Date().setHours(0, 0, 0, 0))} />
              <label className="block text-sm">
                <span className="text-muted-foreground">Комментарий</span>
                <textarea name="notes" rows={3} className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2" />
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" required defaultChecked className="mt-0.5" />
                <span>Согласен на обработку персональных данных.</span>
              </label>
              <button
                type="submit" disabled={loading}
                className="w-full rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
              >
                {loading ? "Отправляем..." : `Отправить заказ • ${fmt.format(finalTotal)}`}
              </button>
            </form>
          </aside>
        </div>
      )}

      <RequisitesDialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        loading={loading}
        onConfirm={finalSubmit}
      />
    </div>
  );
}


function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name} type={type} required={required}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
