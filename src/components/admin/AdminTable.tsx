// Универсальная обёртка таблицы admin: glass-карточка, единый thead,
// состояния «Загрузка/Ошибка/Пусто», горизонтальный скролл.
import type { CSSProperties, ReactNode } from "react";
import { AdminErrorState } from "./StateViews";

export interface AdminTableColumn {
  key: string;
  label: ReactNode;
  className?: string;
}

export function AdminTable({
  columns,
  isLoading,
  isEmpty,
  isError,
  error,
  onRetry,
  emptyText = "Пусто",
  emptyAction,
  loadingText = "Загрузка...",
  textSize = "sm",
  children,
  className,
}: {
  columns: AdminTableColumn[];
  isLoading?: boolean;
  isEmpty?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyText?: string;
  emptyAction?: ReactNode;
  loadingText?: string;
  textSize?: "xs" | "sm";
  children?: ReactNode;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={`glass rounded-xl overflow-hidden p-4 space-y-2 ${className ?? ""}`} aria-busy="true" aria-label={loadingText}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 rounded-md bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <AdminErrorState error={error} onRetry={onRetry} className={className} />;
  }
  if (isEmpty) {
    return (
      <div className={`glass rounded-xl overflow-hidden p-8 text-center text-muted-foreground space-y-3 ${className ?? ""}`}>
        <div>{emptyText}</div>
        {emptyAction}
      </div>
    );
  }

  // Подписи колонок пробрасываем в CSS-переменные: на узких контейнерах
  // строка превращается в карточку, а ::before берёт подпись из --col-N.
  const labelVars: Record<string, string> = {};
  columns.forEach((c, i) => {
    if (typeof c.label === "string") labelVars[`--col-${i + 1}`] = JSON.stringify(c.label);
  });

  return (
    <div className={`glass rounded-xl overflow-hidden ${className ?? ""}`}>
      <div className="table-shell table-cards" style={labelVars as CSSProperties}>
        <table className={`w-full text-${textSize}`}>
          <thead className="admin-table-head sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/70">

            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`text-left p-3 ${c.className ?? ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

