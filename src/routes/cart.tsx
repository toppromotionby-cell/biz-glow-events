import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { type PromoValidation } from "@/lib/promo.functions";
import { CartCrossSell } from "@/components/CartCrossSell";
import { useAuth } from "@/hooks/use-auth";
import { ensureAuthOrPrompt } from "@/hooks/use-require-auth";
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

function CartPage() {
  const { items, count, total } = useCart();
  const { isAuthenticated } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientType, setClientType] = useState<ClientType>("individual");
  const [promo, setPromo] = useState<(PromoValidation & { valid: true }) | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<Contact | null>(null);
  const discount = promo?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  const { draft, saveDraft, clearDraft } = useContactDraft();
  const { loading, submitOrderWith } = useCheckoutSubmit({
    items,
    finalTotal,
    promoCode: promo?.code ?? null,
    onClearDraft: clearDraft,
  });

  async function finalSubmitWith(contact: Contact, req: Requisites) {
    const res = await submitOrderWith(contact, req);
    if (res.ok) setReqOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    if (!ensureAuthOrPrompt(isAuthenticated, "Войдите, чтобы оформить заказ.")) return;
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
    const missing: { field: string; label: string }[] = [];
    if (contact.client_name.length < 2) missing.push({ field: "client_name", label: "Укажите ваше имя (минимум 2 символа)" });
    if (contact.client_phone.length < 5) missing.push({ field: "client_phone", label: "Укажите корректный телефон" });
    if (!/.+@.+\..+/.test(contact.client_email)) missing.push({ field: "client_email", label: "Укажите корректный email" });
    if (clientType === "company" && !contact.client_company) missing.push({ field: "client_company", label: "Укажите название компании" });
    if (missing.length > 0) {
      toast.error(missing[0].label);
      const el = form.querySelector<HTMLInputElement>(`[name="${missing[0].field}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="container mx-auto px-4 py-12 max-w-5xl">
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
          />
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
