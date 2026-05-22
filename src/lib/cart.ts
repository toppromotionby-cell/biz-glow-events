// Лёгкая клиентская корзина-«заявка»: localStorage + кастом-событие "cart:change".
// Используется на детальных страницах и на /cart. SSR-безопасна.
import { useEffect, useState, useCallback } from "react";

export type CartEntityType = "zones" | "tech_equipment" | "services" | "production_items";

export type CartItem = {
  id: string; // uuid из БД, либо slug-фолбэк
  entity_type: CartEntityType;
  slug: string;
  title: string;
  price: number;
  qty: number;
  image?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

const KEY = "eh_cart_v1";
const EVT = "cart:change";

function isBrowser() { return typeof window !== "undefined"; }

function read(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

function write(items: CartItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function addToCart(it: CartItem) {
  const cur = read();
  const idx = cur.findIndex(c => c.id === it.id && c.entity_type === it.entity_type);
  if (idx >= 0) {
    cur[idx] = { ...cur[idx], qty: cur[idx].qty + (it.qty || 1) };
  } else {
    cur.push({ ...it, qty: it.qty || 1 });
  }
  write(cur);
}

export function removeFromCart(id: string, entity_type: CartEntityType) {
  write(read().filter(c => !(c.id === id && c.entity_type === entity_type)));
}

export function updateQty(id: string, entity_type: CartEntityType, qty: number) {
  const next = read().map(c =>
    c.id === id && c.entity_type === entity_type ? { ...c, qty: Math.max(1, qty | 0) } : c,
  );
  write(next);
}

export function updateDates(id: string, entity_type: CartEntityType, start?: string | null, end?: string | null) {
  const next = read().map(c =>
    c.id === id && c.entity_type === entity_type ? { ...c, start_date: start ?? null, end_date: end ?? null } : c,
  );
  write(next);
}

export function clearCart() { write([]); }

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const sync = useCallback(() => setItems(read()), []);
  useEffect(() => {
    sync();
    if (!isBrowser()) return;
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * (i.price || 0), 0);
  return { items, count, total };
}
