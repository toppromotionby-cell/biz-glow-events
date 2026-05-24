// Унифицированная обёртка редактора в админке: glass-карточка,
// шапка с переключателями (publish/featured/active) и кнопками удалить/сохранить.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Inbox } from "lucide-react";

export function AdminEditorShell({
  title, switches, onDelete, onSave, saving, children, deleteLabel = "Удалить", confirmDelete = true,
}: {
  title?: ReactNode;
  switches?: ReactNode;
  onDelete?: () => void;
  onSave?: () => void;
  saving?: boolean;
  deleteLabel?: string;
  confirmDelete?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5 flex-wrap">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {switches}
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="outline" size="sm" onClick={() => {
              if (!confirmDelete || confirm("Удалить?")) onDelete();
            }}>
              <Trash2 className="h-4 w-4 mr-1" />{deleteLabel}
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={saving} className="btn-primary-gradient">
              <Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Универсальное пустое состояние для admin-редакторов и таблиц.
 * Унифицирует все «Выберите запись...», «Пока нет ...», «Загрузка...».
 */
export function AdminEmptyEditor({
  title,
  description,
  icon,
  action,
  /** @deprecated используйте title/description */
  text,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  text?: string;
  className?: string;
}) {
  const heading = title ?? text ?? "Ничего не выбрано";
  return (
    <div
      role="status"
      className={`glass rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3 ${className ?? ""}`}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="space-y-1">
        <div className="font-medium text-foreground">{heading}</div>
        {description && <div className="text-sm text-muted-foreground max-w-md">{description}</div>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
