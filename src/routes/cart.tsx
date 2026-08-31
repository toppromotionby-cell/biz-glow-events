import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { type PromoValidation } from "@/lib/promo.functions";
import { CartCrossSell } from "@/components/CartCrossSell";
import { fmtCurrency } from "@/lib/formatters";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CartItemsPanel } from "@/components/cart/CartItemsPanel";
import { ContactForm, type ClientType } from "@/components/cart/ContactForm";
import {
  RequisitesDialog,
  EMPTY_REQUISITES,
  type Requisites,
} from "@/components/cart/RequisitesDialog";
import {
  useContactDraft,
  useCheckoutSubmit,
  type Contact,
} from "@/hooks/use-checkout-submit";

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

function validateField(name: string, value: string, clientType: ClientType): string | null {
  const v = value.trim();
  switch (name) {
    case "client_name":
      return v.length < 2 ? "Укажите ваше имя (минимум 2 символа)" : null;
    case "client_phone":
      return v.length < 5 ? "Укажите корректный телефон" : null;
    case "client_email":
      return /.+@.+\..+/.test(v) ? null : "Укажите корректный email";
    case "client_company":
      return clientType === "company" && !v ? "Укажите название компании" : null;
    default:
      return null;
  }
}

function CartPage() {
  const { items, count, total } = useCart();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientType, setClientType] = useState<ClientType>("individual");
  const [promo, setPromo] = useState<(PromoValidation & { valid: true }) | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<Contact | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const discount = promo?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  const { draft, saveDraft, clearDraft } = useContactDraft();
  const { loading, submitOrderWith } = useCheckoutSubmit({
    items,
    finalTotal,
    promoCode: promo?.code ?? null,
    onClearDraft: clearDraft,
  });

  function handleFieldBlur(name: string, value: string) {
    const msg = validateField(name, value, clientType);
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  }

  async function finalSubmitWith(contact: Contact, req: Requisites) {
    const res = await submitOrderWith(contact, req);
    if (res.ok) setReqOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    saveDraft(fd);
    const contact: Contact = {
      client_name: String(fd.get("client_name") ?? "").trim(),
      client_phone: String(fd.get("client_phone") ?? "").trim(),
      client_email: String(fd.get("client_email") ?? "").trim(),
      client_company: String(fd.get("client_company") ?? "").trim() || null,
      event_date: String(fd.get("event_date") ?? "") || null,
      event_end_date: String(fd.get("event_end_date") ?? "") || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };
    const nextErrors: Record<string, string> = {};
    for (const field of ["client_name", "client_phone", "client_email", "client_company"]) {
      const msg = validateField(field, String(fd.get(field) ?? ""), clientType);
      if (msg) nextErrors[field] = msg;
    }
    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0];
    if (firstField) {
      toast.error(nextErrors[firstField]);
      const el = form.querySelector<HTMLInputElement>(`[name="${firstField}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!fd.get("consent_pd")) {
      toast.error("Подтвердите согласие на обработку персональных данных");
      const el = form.querySelector<HTMLInputElement>('[name="consent_pd"]');
      el?.focus();
      return;
    }

    setContactDraft(contact);
    if (clientType === "company") {
      setReqOpen(true);
    } else {
      void finalSubmitWith(contact, EMPTY_REQUISITES);
    }
  }



  async function finalSubmit(req: Requisites) {
    if (!contactDraft) return;
    await finalSubmitWith(contactDraft, req);
  }

  return (
    <div className="page-shell py-12 max-w-5xl pb-28 lg:pb-12">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold gradient-text">Ваша корзина</h1>
        <p className="mt-2 text-muted-foreground">
          {count > 0 ? `Позиций: ${count}. Итого: ${fmtCurrency(total)}` : "Корзина пуста — добавьте позиции из каталога."}
        </p>
      </header>

      <CheckoutSteps current={items.length === 0 ? 0 : reqOpen ? 2 : 1} />

      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid lg:grid-cols-5 gap-8">
          <CartItemsPanel
            items={items}
            total={total}
            discount={discount}
            finalTotal={finalTotal}
            promo={promo}
            onApplyPromo={setPromo}
            onClearPromo={() => setPromo(null)}
          />
          <ContactForm
            formRef={formRef}
            loading={loading}
            clientType={clientType}
            onClientTypeChange={setClientType}
            draft={draft}
            finalTotal={finalTotal}
            onSubmit={onSubmit}
            errors={errors}
            onFieldBlur={handleFieldBlur}

          />
        </div>
      )}

      {/* Липкая панель итога на мобильных: сумма всегда видна, кнопка скроллит к форме. */}
      {items.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 glass-strong px-4 py-2.5 lg:hidden"
          style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="leading-tight">
              <p className="text-[11px] text-muted-foreground">Итого · {count} поз.</p>
              <p className="font-display text-lg font-bold gradient-text">{fmtCurrency(finalTotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                formRef.current?.querySelector<HTMLInputElement>('[name="client_name"]')?.focus();
              }}
              className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary"
            >
              Оформить
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <CartCrossSell presentTypes={Array.from(new Set(items.map((i) => i.entity_type)))} />
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
