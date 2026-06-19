import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { type CartItem, clearCart } from "@/lib/cart";
import { submitOrder } from "@/lib/orders.functions";
import { readUtm } from "@/lib/utm";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { type Requisites } from "@/components/cart/RequisitesDialog";

const DRAFT_KEY = "cart_contact_draft_v1";

export type Contact = {
  client_name: string;
  client_phone: string;
  client_email: string;
  client_company: string | null;
  event_date: string | null;
  event_end_date: string | null;
  notes: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  client_name: "Имя",
  client_phone: "Телефон",
  client_email: "Email",
  client_company: "Компания",
  event_date: "Дата мероприятия",
  notes: "Комментарий",
  items: "Позиции в корзине",
};

export function humanizeError(err: unknown): string {
  if (!(err instanceof Error)) return "Ошибка отправки. Попробуйте ещё раз.";
  const msg = err.message;
  const trimmed = msg.trim();
  if (trimmed.startsWith("[")) {
    try {
      const issues = JSON.parse(trimmed) as Array<{ path?: string[]; message?: string }>;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        const field = first.path?.[0];
        const label = field ? (FIELD_LABELS[field] ?? field) : null;
        const baseMsg = first.message ?? "Проверьте корректность данных";
        return label ? `${label}: ${baseMsg}` : baseMsg;
      }
    } catch {
      /* ignore */
    }
  }
  return msg || "Ошибка отправки";
}

export function useContactDraft() {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const saveDraft = useCallback((fd: FormData) => {
    const obj: Record<string, string> = {};
    ["client_name", "client_phone", "client_email", "client_company", "event_date", "event_end_date", "notes"].forEach((k) => {
      const v = String(fd.get(k) ?? "").trim();
      if (v) obj[k] = v;
    });
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }, []);
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return { draft, saveDraft, clearDraft };
}

export function useCheckoutSubmit({
  items,
  finalTotal,
  promoCode,
  onClearDraft,
}: {
  items: CartItem[];
  finalTotal: number;
  promoCode: string | null;
  onClearDraft: () => void;
}) {
  const submit = useServerFn(submitOrder);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const submitOrderWith = useCallback(
    async (contact: Contact, req: Requisites) => {
      const utm = readUtm() ?? {};
      setLoading(true);
      const analyticsItems = items.map((i) => ({
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
            promo_code: promoCode,
            ...req,
            utm_source: utm.utm_source ?? null,
            utm_medium: utm.utm_medium ?? null,
            utm_campaign: utm.utm_campaign ?? null,
            utm_term: utm.utm_term ?? null,
            utm_content: utm.utm_content ?? null,
            consent_pd: true,
            items: items.map((i) => ({
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
          sessionStorage.setItem(
            `order_purchase_${res.id}`,
            JSON.stringify({ value: res.total, ts: Date.now() }),
          );
        } catch {
          /* ignore */
        }
        clearCart();
        onClearDraft();
        toast.success("Заказ оформлен");
        navigate({ to: "/order/success/$id", params: { id: res.id } });
        return { ok: true as const, id: res.id };
      } catch (err) {
        toast.error(humanizeError(err));
        return { ok: false as const };
      } finally {
        setLoading(false);
      }
    },
    [items, finalTotal, promoCode, submit, navigate, onClearDraft],
  );

  return { loading, submitOrderWith };
}
