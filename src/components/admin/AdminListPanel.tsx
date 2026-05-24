// Левый сайдбар-список админки. Инкапсулирует glass-обёртку, скролл,
// состояния «Загрузка/Пусто» и опциональный drag-and-drop через SortableList.
import type { ReactNode } from "react";
import { SortableList, type SortableItem } from "./SortableList";

interface Props<T extends SortableItem> {
  items: T[];
  isLoading?: boolean;
  emptyText?: string;
  className?: string;
  /** Если задан — список перетаскиваемый. */
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}

export function AdminListPanel<T extends SortableItem>({
  items, isLoading, emptyText = "Нет записей", className, onReorder, renderItem,
}: Props<T>) {
  return (
    <div className={`glass rounded-xl p-3 max-h-[75vh] overflow-y-auto ${className ?? ""}`}>
      {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>}
      {!isLoading && items.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground text-center">{emptyText}</div>
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
