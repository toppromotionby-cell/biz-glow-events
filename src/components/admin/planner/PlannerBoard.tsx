// Доска планера: колонки по статусу, перенос карточки меняет статус.
import type { CalDirection, CalItem } from "@/lib/calendar/model";
import { PRIORITY_LABEL, fmtWhen, isOverdue } from "@/lib/calendar/model";
import { Badge } from "@/components/ui/badge";

const COLUMNS: Array<{ key: CalItem["status"]; title: string }> = [
  { key: "planned", title: "Запланировано" },
  { key: "in_progress", title: "В работе" },
  { key: "done", title: "Готово" },
];

export interface PlannerBoardProps {
  items: CalItem[];
  directions: CalDirection[];
  onStatus: (item: CalItem, status: CalItem["status"]) => void;
  onEdit: (item: CalItem) => void;
}

export function PlannerBoard({ items, directions, onStatus, onEdit }: PlannerBoardProps) {
  const now = new Date();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = items.filter((i) => i.status === col.key);
        return (
          <div
            key={col.key}
            className="rounded-xl border bg-muted/30 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              const item = items.find((i) => i.id === id);
              if (item && item.status !== col.key) onStatus(item, col.key);
            }}
          >
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>{col.title}</span>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Пусто — перетащите карточку сюда</p>
              ) : null}
              {list.map((i) => {
                const dir = directions.find((d) => d.id === i.direction_id) ?? null;
                return (
                  <button
                    key={i.id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                    onClick={() => onEdit(i)}
                    className="w-full cursor-grab rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      {dir ? <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: dir.color }} /> : null}
                      <span className={`text-sm font-medium ${i.status === "done" ? "line-through opacity-60" : ""}`}>
                        {i.importance === "hard" ? "🔒 " : ""}
                        {i.title}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{i.kind === "meeting" ? "Встреча" : "Задача"}</span>
                      <span>·</span>
                      <span>{fmtWhen(i)}</span>
                      {i.priority && i.priority <= 2 ? (
                        <Badge variant="outline" className="h-5">
                          {PRIORITY_LABEL[i.priority]}
                        </Badge>
                      ) : null}
                      {isOverdue(i, now) ? (
                        <Badge variant="destructive" className="h-5">
                          Просрочено
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
