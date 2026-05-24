// Универсальная обёртка таблицы admin: glass-карточка, единый thead,
// состояния «Загрузка/Пусто», горизонтальный скролл.
import type { ReactNode } from "react";

export interface AdminTableColumn {
  key: string;
  label: ReactNode;
  className?: string;
}

export function AdminTable({
  columns,
  isLoading,
  isEmpty,
  emptyText = "Пусто",
  loadingText = "Загрузка...",
  textSize = "sm",
  children,
  className,
}: {
  columns: AdminTableColumn[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  loadingText?: string;
  textSize?: "xs" | "sm";
  children?: ReactNode;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={`glass rounded-xl overflow-hidden p-8 text-center text-muted-foreground ${className ?? ""}`}>
        {loadingText}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className={`glass rounded-xl overflow-hidden p-8 text-center text-muted-foreground ${className ?? ""}`}>
        {emptyText}
      </div>
    );
  }
  return (
    <div className={`glass rounded-xl overflow-hidden ${className ?? ""}`}>
      <div className="overflow-x-auto">
        <table className={`w-full text-${textSize}`}>
          <thead className="admin-table-head">
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
