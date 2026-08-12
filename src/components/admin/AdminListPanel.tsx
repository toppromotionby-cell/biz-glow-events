// Левый сайдбар-список админки. Инкапсулирует glass-обёртку, скролл,
// состояния «Загрузка/Ошибка/Пусто» и опциональный drag-and-drop через SortableList.
import type { ReactNode } from "react";
import { SortableList, type SortableItem } from "./SortableList";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminErrorInline } from "./StateViews";

interface Props<T extends SortableItem> {
  items: T[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyText?: string;
  emptyAction?: ReactNode;
  className?: string;
  /** Если задан — список перетаскиваемый. */
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}

export function AdminListPanel<T extends SortableItem>({
  items, isLoading, isError, error, onRetry, emptyText = "Нет записей", emptyAction, className, onReorder, renderItem,
}: Props<T>) {
  return (
    <div className={`glass rounded-xl p-3 max-h-[75vh] overflow-y-auto ${className ?? ""}`}>
      {isLoading && (
        <div className="space-y-2" aria-label="Загрузка списка">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-10 w-10 rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && isError && (
        <AdminErrorInline error={error} onRetry={onRetry} className="m-1" />
      )}
      {!isLoading && !isError && items.length === 0 && (

        <div className="p-6 text-sm text-muted-foreground text-center space-y-3">
          <div>{emptyText}</div>
          {emptyAction}
        </div>
      )}
      {!isLoading && items.length > 0 && (
        onReorder ? (
          <SortableList items={items} onReorder={onReorder} className="space-y-1" renderItem={renderItem} />
        ) : (
          <div className="space-y-1">
            {items.map((it) => <div key={it.id}>{renderItem(it, null)}</div>)}
          </div>
        )
      )}
    </div>
  );
}
