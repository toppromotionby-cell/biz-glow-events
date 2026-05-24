// Унифицированная обёртка редактора в админке: glass-карточка,
// шапка с переключателями (publish/featured/active) и кнопками удалить/сохранить.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Save, Trash2 } from "lucide-react";

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

export function AdminEmptyEditor({ text = "Выберите запись или создайте новую" }: { text?: string }) {
  return (
    <div className="glass rounded-xl p-10 text-center text-muted-foreground">{text}</div>
  );
}
