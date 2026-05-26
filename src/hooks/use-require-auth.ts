// Хук-обёртка: оборачивает действие, требующее авторизации.
// Если пользователь не залогинен — открывает AuthPromptDialog вместо действия.
import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { openAuthPrompt } from "@/lib/auth-prompt";

export function useRequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  return useCallback(
    <Args extends unknown[]>(action: (...args: Args) => void, reason?: string) =>
      (...args: Args) => {
        if (loading) return;
        if (!isAuthenticated) {
          openAuthPrompt({ reason, redirect: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined });
          return;
        }
        action(...args);
      },
    [isAuthenticated, loading],
  );
}

// Для submit-обработчиков форм: возвращает true, если можно продолжать.
export function ensureAuthOrPrompt(isAuthenticated: boolean, reason?: string): boolean {
  if (isAuthenticated) return true;
  openAuthPrompt({ reason, redirect: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined });
  return false;
}
