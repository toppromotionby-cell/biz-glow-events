// Клиентское «Избранное»: localStorage + событие "wishlist:change". SSR-safe.
import { useEffect, useState, useCallback } from "react";
import type { CartEntityType } from "@/lib/cart";

export type WishlistItem = {
  id: string;
  entity_type: CartEntityType;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
  addedAt: number;
};

const KEY = "eh_wishlist_v1";
const EVT = "wishlist:change";

const isBrowser = () => typeof window !== "undefined";

function read(): WishlistItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

function write(items: WishlistItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

function sameKey(a: { id: string; entity_type: CartEntityType }, b: { id: string; entity_type: CartEntityType }) {
  return a.id === b.id && a.entity_type === b.entity_type;
}

export function toggleWishlist(it: Omit<WishlistItem, "addedAt">): boolean {
  const cur = read();
  const idx = cur.findIndex(c => sameKey(c, it));
  if (idx >= 0) {
    cur.splice(idx, 1);
    write(cur);
    return false;
  }
  cur.unshift({ ...it, addedAt: Date.now() });
  write(cur);
  return true;
}

export function removeFromWishlist(id: string, entity_type: CartEntityType) {
  write(read().filter(c => !sameKey(c, { id, entity_type })));
}

export function clearWishlist() { write([]); }

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
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
  const count = items.length;
  const has = useCallback(
    (id: string, entity_type: CartEntityType) => items.some(i => sameKey(i, { id, entity_type })),
    [items],
  );
  return { items, count, has };
}
