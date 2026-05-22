import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart, removeFromCart, updateQty, clearCart } from "@/lib/cart";
import { submitOrder } from "@/lib/orders.functions";
import { readUtm } from "@/lib/utm";
import { PromoCodeInput } from "@/components/PromoCodeInput";
import { type PromoValidation } from "@/lib/promo.functions";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Ваша заявка — event-hub.by" },
      { name: "description", content: "Позиции, добавленные в заявку. Отправьте заявку — мы перезвоним." },
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
  const discount = promo?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const fd = new FormData(e.currentTarget);
    const utm = readUtm() ?? {};
    setLoading(true);
    try {
      const res = await submit({
        data: {
          client_name: String(fd.get("client_name") ?? "").trim(),
          client_phone: String(fd.get("client_phone") ?? "").trim(),
          client_email: String(fd.get("client_email") ?? "").trim(),
          client_company: String(fd.get("client_company") ?? "").trim() || null,
          event_date: String(fd.get("event_date") ?? "") || null,
          notes: String(fd.get("notes") ?? "").trim() || null,
          source: "cart",
          promo_code: promo?.code ?? null,
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
      setDone({ id: res.id });
      toast.success("Заявка отправлена");
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
          <h1 className="text-3xl font-display font-bold gradient-text">Заявка принята</h1>
          <p className="mt-3 text-muted-foreground">Номер: <span className="font-mono">{done.id.slice(0, 8)}</span>. Мы свяжемся в течение рабочего дня.</p>
          <Link to="/" className="mt-6 inline-flex rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">На главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold gradient-text">Ваша заявка</h1>
        <p className="mt-2 text-muted-foreground">{count > 0 ? `Позиций: ${count}. Итого: ${fmt.format(total)}` : "Корзина пуста — добавьте позиции из каталога."}</p>
      </header>

      {items.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">Перейдите в каталог и нажмите «В заявку».</p>
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
                <input
                  type="number" min={1} max={99} value={i.qty}
                  onChange={(e) => updateQty(i.id, i.entity_type, Number(e.target.value))}
                  aria-label={`Количество для ${i.title}`}
                  className="w-16 rounded-md bg-background/50 border border-border px-2 py-1 text-sm text-center"
                />
                <div className="w-24 text-right text-sm font-semibold">{fmt.format(i.price * i.qty)}</div>
                <button onClick={() => removeFromCart(i.id, i.entity_type)} aria-label={`Удалить ${i.title}`} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            ))}
            <div className="flex justify-between items-center pt-3">
              <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-foreground">Очистить корзину</button>
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
              <Field label="Дата мероприятия" name="event_date" type="date" />
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
                {loading ? "Отправляем..." : `Отправить заявку • ${fmt.format(finalTotal)}`}
              </button>
            </form>
          </aside>
        </div>
      )}
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
