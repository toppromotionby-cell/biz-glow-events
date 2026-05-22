// Универсальный drag-n-drop список на @dnd-kit.
// Используется для перетаскивания строк во всех списках админки.
import { ReactNode, useState, useEffect } from "react";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export interface SortableItem { id: string }

export interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
  className?: string;
  /** Direction of sorting (default: vertical) */
  horizontal?: boolean;
}

export function SortableList<T extends SortableItem>({
  items, onReorder, renderItem, className, horizontal,
}: SortableListProps<T>) {
  const [local, setLocal] = useState(items);
  useEffect(() => { setLocal(items); }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = local.findIndex((it) => it.id === active.id);
    const newIndex = local.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(local, oldIndex, newIndex);
    setLocal(next);
    try {
      await onReorder(next.map((it) => it.id));
    } catch {
      setLocal(items); // rollback
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={local.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className} style={horizontal ? { display: "flex", gap: 8 } : undefined}>
          {local.map((it) => (
            <SortableRow key={it.id} id={it.id}>
              {(handle) => renderItem(it, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };
  const handle = (
    <button
      type="button"
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      aria-label="Перетащить"
      className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted/40 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(handle)}
    </div>
  );
}
