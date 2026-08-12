// Этап 7 (UX-фидбэк): единые состояния «ошибка загрузки» и «пусто» для админки.
// Любой список/таблица показывает понятный текст и кнопку «Повторить»,
// вместо молчаливо пустого экрана.
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Человеческий текст ошибки запроса. */
export function errorText(error: unknown, fallback = "Не удалось загрузить данные"): string {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function AdminErrorState({
  title = "Не удалось загрузить данные",
  error,
  onRetry,
  isRetrying,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  const detail = error ? errorText(error, "") : "";
  return (
    <div
      role="alert"
      className={`glass rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 ${className ?? ""}`}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <div className="font-medium text-foreground">{title}</div>
        {detail && detail !== title && (
          <div className="text-sm text-muted-foreground max-w-md break-words">{detail}</div>
        )}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
          Повторить
        </Button>
      )}
    </div>
  );
}

/** Компактная строка-ошибка внутри уже существующей карточки. */
export function AdminErrorInline({
  error,
  onRetry,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm ${className ?? ""}`}
    >
      <span className="text-destructive break-words">{errorText(error)}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
          Повторить
        </Button>
      )}
    </div>
  );
}

export function AdminStateShell({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  empty,
  loading,
  children,
}: {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <>{loading ?? null}</>;
  if (isError) return <AdminErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty ?? null}</>;
  return <>{children}</>;
}
