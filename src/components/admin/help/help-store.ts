// Мини-стор для контекстной справки: любая иконка «?» может открыть боковую панель
// с нужной статьёй, не пробрасывая пропсы через всё дерево админки.
import { useSyncExternalStore } from "react";

let currentArticleId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openHelp(articleId: string) {
  currentArticleId = articleId;
  emit();
}

export function closeHelp() {
  currentArticleId = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => currentArticleId;
const getServerSnapshot = () => null;

export function useHelpArticleId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
