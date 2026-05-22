// Клиентское «Сравнение»: localStorage + событие "compare:change". SSR-safe. Лимит — 4 позиции.
import { useEffect, useState, useCallback } from "react";
import type { CartEntityType } from "@/lib/cart";

export type CompareItem = {
  id: string;
  entity_type: CartEntityType;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
  addedAt: number;
};

const KEY = "eh_compare_v1";
const EVT = "compare:change";
export const COMPARE_MAX = 4;

const isBrowser = () => typeof window !== "undefined";

function read(): CompareItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

function write(items: CompareItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

function sameKey(a: { id: string; entity_type: CartEntityType }, b: { id: string; entity_type: CartEntityType }) {
  return a.id === b.id && a.entity_type === b.entity_type;
}

/** Returns: 'added' | 'removed' | 'limit' | 'mismatch' */
export function toggleCompare(it: Omit<CompareItem, "addedAt">): "added" | "removed" | "limit" | "mismatch" {
  const cur = read();
  const idx = cur.findIndex(c => sameKey(c, it));
  if (idx >= 0) {
    cur.splice(idx, 1);
    write(cur);
    return "removed";
  }
  if (cur.length > 0 && cur[0].entity_type !== it.entity_type) return "mismatch";
  if (cur.length >= COMPARE_MAX) return "limit";
  cur.unshift({ ...it, addedAt: Date.now() });
  write(cur);
  return "added";
}

export function removeFromCompare(id: string, entity_type: CartEntityType) {
  write(read().filter(c => !sameKey(c, { id, entity_type })));
}

export function clearCompare() { write([]); }

export function useCompare() {
  const [items, setItems] = useState<CompareItem[]>([]);
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
  const has = useCallback(
    (id: string, entity_type: CartEntityType) => items.some(i => sameKey(i, { id, entity_type })),
    [items],
  );
  return { items, count: items.length, has };
}
