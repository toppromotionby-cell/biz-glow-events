// Сравнение позиций каталога: localStorage + событие "compare:change". SSR-безопасно.
import { useCallback, useEffect, useState } from "react";
import type { CatalogType } from "@/lib/catalog.functions";

export const COMPARE_LIMIT = 4;

export type CompareItem = {
  id: string;
  entity_type: CatalogType;
  slug: string;
  title: string;
  image?: string | null;
  priceFrom?: number | null;
};

const KEY = "eh_compare_v1";
const EVT = "compare:change";

function isBrowser() { return typeof window !== "undefined"; }

function read(): CompareItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, COMPARE_LIMIT) : [];
  } catch { return []; }
}

function write(items: CompareItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, COMPARE_LIMIT)));
  window.dispatchEvent(new CustomEvent(EVT));
}

export type ToggleCompareResult = { added: boolean; removed: boolean; limitReached: boolean };

export function toggleCompare(item: CompareItem): ToggleCompareResult {
  const cur = read();
  const idx = cur.findIndex((c) => c.slug === item.slug && c.entity_type === item.entity_type);
  if (idx >= 0) {
    cur.splice(idx, 1);
    write(cur);
    return { added: false, removed: true, limitReached: false };
  }
  if (cur.length >= COMPARE_LIMIT) return { added: false, removed: false, limitReached: true };
  cur.push(item);
  write(cur);
  return { added: true, removed: false, limitReached: false };
}

export function removeFromCompare(slug: string, entity_type: CatalogType) {
  write(read().filter((c) => !(c.slug === slug && c.entity_type === entity_type)));
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
    (slug: string, type: CatalogType) => items.some((i) => i.slug === slug && i.entity_type === type),
    [items],
  );
  return { items, count: items.length, has };
}
