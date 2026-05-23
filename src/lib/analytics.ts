// Лёгкий e-commerce трекер для GA4 + Яндекс.Метрика.
// SSR-безопасен: всё работает только в браузере, ошибки глотаются.
// gtag/ym инжектятся в ScriptInjector — здесь только обёртки событий.

// Window-типы объявлены в src/components/ScriptInjector.tsx

const YM_ID = (import.meta.env.VITE_YM_ID as string | undefined);

function isBrowser() { return typeof window !== "undefined"; }

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

function gtagEvent(name: string, params: Record<string, unknown>) {
  if (!isBrowser()) return;
  try {
    window.dataLayer?.push({ event: name, ecommerce: params });
    window.gtag?.("event", name, params);
  } catch {}
}

function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (!isBrowser() || !YM_ID || !window.ym) return;
  try {
    (window.ym as (...args: unknown[]) => void)(Number(YM_ID), "reachGoal", goal, params ?? {});
  } catch {}
}

export function trackViewItem(item: AnalyticsItem) {
  gtagEvent("view_item", {
    currency: "BYN",
    value: item.price ?? 0,
    items: [{ ...item, quantity: item.quantity ?? 1 }],
  });
  ymGoal("view_item", { item_id: item.item_id, price: item.price ?? 0 });
}

export function trackAddToCart(item: AnalyticsItem) {
  gtagEvent("add_to_cart", {
    currency: "BYN",
    value: (item.price ?? 0) * (item.quantity ?? 1),
    items: [{ ...item, quantity: item.quantity ?? 1 }],
  });
  ymGoal("add_to_cart", { item_id: item.item_id, price: item.price ?? 0 });
}

export function trackBeginCheckout(items: AnalyticsItem[], total: number) {
  gtagEvent("begin_checkout", {
    currency: "BYN",
    value: total,
    items,
  });
  ymGoal("begin_checkout", { value: total, count: items.length });
}

export function trackPurchase(opts: {
  transaction_id: string;
  value: number;
  items?: AnalyticsItem[];
}) {
  gtagEvent("purchase", {
    transaction_id: opts.transaction_id,
    currency: "BYN",
    value: opts.value,
    items: opts.items ?? [],
  });
  ymGoal("purchase", { transaction_id: opts.transaction_id, value: opts.value });
}

export function trackLead(source: string, value?: number) {
  gtagEvent("generate_lead", { currency: "BYN", value: value ?? 0, source });
  ymGoal("lead", { source, value: value ?? 0 });
}
