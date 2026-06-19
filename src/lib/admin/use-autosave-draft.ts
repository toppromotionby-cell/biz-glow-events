// localStorage-автосохранение черновика формы. Debounce — 1500 мс по умолчанию.
// Использование:
//   const { restored, clear } = useAutoSaveDraft(`blog:${id ?? "new"}`, values, !isDirty);
// При размонтировании черновик НЕ чистится — это делает форма после успешного save.
import { useEffect, useRef, useState } from "react";

const PREFIX = "admin-draft:";

export function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: string; data: T };
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

export function useAutoSaveDraft<T>(key: string, values: T, opts: { enabled?: boolean; delayMs?: number } = {}) {
  const { enabled = true, delayMs = 1500 } = opts;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) { firstRun.current = false; return; }
    const handle = setTimeout(() => {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: new Date().toISOString(), data: values }));
        setSavedAt(new Date());
      } catch { /* quota / disabled */ }
    }, delayMs);
    return () => clearTimeout(handle);
  }, [key, values, enabled, delayMs]);

  return { savedAt, clear: () => clearDraft(key) };
}
