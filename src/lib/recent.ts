// "Недавно просмотренные": localStorage + событие "recent:change". SSR-safe.
import { useEffect, useState, useCallback } from "react";
import type { CartEntityType } from "@/lib/cart";

export type RecentItem = {
  id: string;
  entity_type: CartEntityType;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
  viewedAt: number;
};

const KEY = "eh_recent_v1";
const EVT = "recent:change";
const MAX = 12;

const isBrowser = () => typeof window !== "undefined";

function read(): RecentItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

function write(items: RecentItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function trackView(it: Omit<RecentItem, "viewedAt">) {
  if (!isBrowser()) return;
  const cur = read().filter(c => !(c.id === it.id && c.entity_type === it.entity_type));
  cur.unshift({ ...it, viewedAt: Date.now() });
  write(cur.slice(0, MAX));
}

export function useRecent() {
  const [items, setItems] = useState<RecentItem[]>([]);
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
  return items;
}
