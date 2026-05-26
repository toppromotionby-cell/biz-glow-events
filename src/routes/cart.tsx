import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, ShoppingCart } from "lucide-react";
import { useCart, removeFromCart, updateQty, clearCart } from "@/lib/cart";
import { submitOrder } from "@/lib/orders.functions";
import { readUtm } from "@/lib/utm";
import { PromoCodeInput } from "@/components/PromoCodeInput";
import { DateField } from "@/components/DateField";
import { type PromoValidation } from "@/lib/promo.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { CartCrossSell } from "@/components/CartCrossSell";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { useAuth } from "@/hooks/use-auth";
import { ensureAuthOrPrompt } from "@/hooks/use-require-auth";

const DRAFT_KEY = "cart_contact_draft_v1";


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
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<"individual" | "company">("individual");
  const [promo, setPromo] = useState<(PromoValidation & { valid: true }) | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<null | {
    client_name: string;
    client_phone: string;
    client_email: string;
    client_company: string | null;
    event_date: string | null;
    event_end_date: string | null;
    notes: string | null;
  }>(null);
  const discount = promo?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  // Загрузка/сохранение черновика контактных данных
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, []);
  function saveDraft(fd: FormData) {
    const obj: Record<string, string> = {};
    ["client_name", "client_phone", "client_email", "client_company", "event_date", "event_end_date", "notes"].forEach(k => {
      const v = String(fd.get(k) ?? "").trim();
      if (v) obj[k] = v;
    });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(obj)); } catch {}
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    if (!ensureAuthOrPrompt(isAuthenticated, "Войдите, чтобы оформить заказ.")) return;
    const fd = new FormData(e.currentTarget);
    saveDraft(fd);
    const contact = {
      client_name: String(fd.get("client_name") ?? "").trim(),
      client_phone: String(fd.get("client_phone") ?? "").trim(),
      client_email: String(fd.get("client_email") ?? "").trim(),
      client_company: String(fd.get("client_company") ?? "").trim() || null,
      event_date: String(fd.get("event_date") ?? "") || null,
      event_end_date: String(fd.get("event_end_date") ?? "") || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };
    setContactDraft(contact);
    if (clientType === "company") {
      setReqOpen(true);
    } else {
      void finalSubmitWith(contact, {
        company_legal_name: null, company_unp: null, company_address: null,
        company_bank: null, contact_person_name: null, contact_person_position: null, acting_basis: null,
      });
    }
  }

  type Req = {
    company_legal_name: string | null;
    company_unp: string | null;
    company_address: string | null;
    company_bank: string | null;
    contact_person_name: string | null;
    contact_person_position: string | null;
    acting_basis: string | null;
  };

  async function finalSubmitWith(contact: NonNullable<typeof contactDraft>, req: Req) {
    const utm = readUtm() ?? {};
    setLoading(true);
    const analyticsItems = items.map(i => ({
      item_id: i.id,
      item_name: i.title,
      item_category: i.entity_type,
      price: i.price,
      quantity: i.qty,
    }));
    trackBeginCheckout(analyticsItems, finalTotal);
    try {
      const res = await submit({
        data: {
          ...contact,
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
      trackPurchase({
        transaction_id: res.id,
        value: res.total,
        items: analyticsItems,
      });
      try {
        sessionStorage.setItem(`order_purchase_${res.id}`, JSON.stringify({ value: res.total, ts: Date.now() }));
      } catch {}
      clearCart();
      setReqOpen(false);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      toast.success("Заказ оформлен");
      navigate({ to: "/order/success/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }


  async function finalSubmit(req: Req) {
    if (!contactDraft) return;
    await finalSubmitWith(contactDraft, req);
  }



  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold gradient-text">Ваша корзина</h1>
        <p className="mt-2 text-muted-foreground">{count > 0 ? `Позиций: ${count}. Итого: ${fmt.format(total)}` : "Корзина пуста — добавьте позиции из каталога."}</p>
      </header>

      <CheckoutSteps current={items.length === 0 ? 0 : reqOpen ? 2 : 1} />


      {items.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">Перейдите в каталог и нажмите «В корзину».</p>
          <div className="mt-4 flex justify-center gap-3 flex-wrap">
            {[
              { to: "/zones" as const, label: "Зоны" },
              { to: "/equipment" as const, label: "Оборудование" },
              { to: "/services" as const, label: "Услуги" },
              { to: "/production" as const, label: "Производство" },
            ].map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-8">
          <section className="lg:col-span-3 space-y-3">
            {items.map((i) => (
              <article key={`${i.entity_type}:${i.id}`} className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
                {i.image ? (
                  <img src={i.image} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-surface" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.price > 0 ? `${fmt.format(i.price)} × ${i.qty}` : "По запросу"}</div>
                </div>
                <QtyStepper
                  value={i.qty}
                  onChange={(next) => updateQty(i.id, i.entity_type, next)}
                  label={i.title}
                />
                <div className="w-24 text-right text-sm font-semibold">{fmt.format(i.price * i.qty)}</div>
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
                    Сумма: {fmt.format(total)} · Скидка: <span className="text-success">−{fmt.format(discount)}</span>
                  </div>
                )}
                <div className="text-lg font-display font-bold">Итого: <span className="gradient-text">{fmt.format(finalTotal)}</span></div>
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
                  onApply={(p) => setPromo(p)}
                  onClear={() => setPromo(null)}
                />
              </div>
            </details>
          </section>

          <aside className="lg:col-span-2">
            <form ref={formRef} onSubmit={onSubmit} className="glass rounded-xl p-5 space-y-3">
              <h2 className="font-display font-semibold">Контактные данные</h2>
              <div className="flex gap-2 p-1 rounded-md bg-background/40 border border-border">
                {(["individual", "company"] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setClientType(t)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${clientType === t ? "bg-gradient-primary text-primary-foreground glow-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t === "individual" ? "Физлицо" : "Юрлицо / ИП"}
                  </button>
                ))}
              </div>
              <Field label="Имя *" name="client_name" required defaultValue={draft.client_name} />
              <Field label="Телефон *" name="client_phone" type="tel" required defaultValue={draft.client_phone} />
              <Field label="Email *" name="client_email" type="email" required defaultValue={draft.client_email} />
              {clientType === "company" && (
                <Field label="Компания *" name="client_company" required defaultValue={draft.client_company} />
              )}
              <DateField label="Дата мероприятия" name="event_date" endName="event_end_date" minDate={new Date(new Date().setHours(0, 0, 0, 0))} />
              <label className="block text-sm">
                <span className="text-muted-foreground">Комментарий</span>
                <textarea name="notes" rows={3} defaultValue={draft.notes ?? ""} className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2" />
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="consent_pd" required className="mt-0.5" />
                <span>Согласен на обработку персональных данных.</span>
              </label>
              <button
                type="submit" disabled={loading}
                className="w-full rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
              >
                {loading ? "Отправляем..." : clientType === "company" ? `Далее: реквизиты • ${fmt.format(finalTotal)}` : `Отправить заказ • ${fmt.format(finalTotal)}`}
              </button>
              {clientType === "individual" && (
                <p className="text-[11px] text-muted-foreground text-center">Реквизиты компании при необходимости запросит менеджер.</p>
              )}
            </form>
          </aside>
        </div>
      )}

      {items.length > 0 && (
        <CartCrossSell presentTypes={Array.from(new Set(items.map(i => i.entity_type)))} />
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


function Field({ label, name, type = "text", required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name} type={type} required={required} defaultValue={defaultValue}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}

function RequisitesDialog({
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  onConfirm: (req: {
    company_legal_name: string | null;
    company_unp: string | null;
    company_address: string | null;
    company_bank: string | null;
    contact_person_name: string | null;
    contact_person_position: string | null;
    acting_basis: string | null;
  }) => void;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v ? v : null;
    };
    onConfirm({
      company_legal_name: get("company_legal_name"),
      company_unp: get("company_unp"),
      company_address: get("company_address"),
      company_bank: get("company_bank"),
      contact_person_name: get("contact_person_name"),
      contact_person_position: get("contact_person_position"),
      acting_basis: get("acting_basis"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Реквизиты для подготовки документов</DialogTitle>
          <DialogDescription>
            Заполните реквизиты компании и данные ответственного лица. Это нужно, чтобы мы могли подготовить договор и счёт. Поля можно пропустить, если оплата от физлица — менеджер уточнит детали при звонке.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Компания</h3>
            <ReqField label="Юридическое название" name="company_legal_name" placeholder="ООО «Ромашка»" maxLength={240} />
            <div className="grid sm:grid-cols-2 gap-3">
              <ReqField label="УНП / ИНН" name="company_unp" placeholder="123456789" maxLength={40} />
              <ReqField label="Юридический адрес" name="company_address" placeholder="г. Минск, ул. ..." maxLength={300} />
            </div>
            <ReqField label="Банковские реквизиты" name="company_bank" placeholder="Р/с, БИК, наименование банка" maxLength={300} textarea />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ответственное лицо</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <ReqField label="ФИО" name="contact_person_name" placeholder="Иванов Иван Иванович" maxLength={160} />
              <ReqField label="Должность" name="contact_person_position" placeholder="Директор" maxLength={160} />
            </div>
            <ReqField label="Действует на основании" name="acting_basis" placeholder="Устава / доверенности № … от …" maxLength={200} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
            >
              {loading ? "Отправляем..." : "Подтвердить и отправить"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReqField({
  label,
  name,
  placeholder,
  maxLength,
  textarea,
}: {
  label: string;
  name: string;
  placeholder?: string;
  maxLength?: number;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={2}
          className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
        />
      ) : (
        <input
          name={name}
          type="text"
          placeholder={placeholder}
          maxLength={maxLength}
          className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
        />
      )}
    </label>
  );
}

function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  const steps = ["Корзина", "Контакты", "Реквизиты"] as const;
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs sm:text-sm" aria-label="Шаги оформления">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <span
              aria-current={active ? "step" : undefined}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition ${
                done
                  ? "bg-success/20 text-success border-success/40"
                  : active
                  ? "bg-gradient-primary text-primary-foreground border-transparent glow-primary"
                  : "bg-muted/30 text-muted-foreground border-border"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`truncate ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < steps.length - 1 && (
              <span className={`flex-1 h-px ${i < current ? "bg-success/40" : "bg-border"}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
