// Унифицированная обёртка редактора в админке: glass-карточка,
// шапка с переключателями (publish/featured/active) и кнопками удалить/сохранить.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Inbox } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SaveStatus, type SaveState } from "@/components/admin/SaveStatus";

export function AdminEditorShell({
  title, switches, onDelete, onSave, saving, children, deleteLabel = "Удалить", confirmDelete = true,
  saveState, draftSavedAt, errorMessage, saveDisabled,
}: {
  title?: ReactNode;
  switches?: ReactNode;
  onDelete?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  deleteLabel?: string;
  confirmDelete?: boolean;
  saveState?: SaveState;
  draftSavedAt?: Date | null;
  errorMessage?: string | null;
  children: ReactNode;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5 flex-wrap">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {switches}
        </div>
        <div className="flex items-center gap-3">
          {saveState && (
            <SaveStatus state={saveState} draftSavedAt={draftSavedAt} errorMessage={errorMessage} />
          )}
          <div className="flex gap-2">
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => { if (confirmDelete) setConfirmOpen(true); else onDelete(); }}
              >
                <Trash2 className="h-4 w-4 mr-1" />{deleteLabel}
              </Button>
            )}
            {onSave && (
              <Button size="sm" onClick={onSave} disabled={saving || saveDisabled} className="btn-primary-gradient">
                <Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}
              </Button>
            )}
          </div>
        </div>
      </div>
      {children}

      {onDelete && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие необратимо. Запись будет удалена без возможности восстановления.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
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
