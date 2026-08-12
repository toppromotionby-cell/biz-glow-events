// Общая панель истории версий документа: одна кнопка снимка и список версий
// с подтверждением восстановления. Используется в КП и промо-КП.
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/admin/ConfirmDialog";

export type DocVersionRow = {
  id: string;
  /** Заголовок строки (метка версии или дата). */
  label: string;
  /** Необязательная вторая строка, например сумма. */
  subtitle?: string;
};

export function DocVersionsPanel({
  versions,
  onCreate,
  onRestore,
}: {
  versions: DocVersionRow[];
  onCreate: () => void | Promise<void>;
  onRestore: (versionId: string) => void | Promise<void>;
}) {
  const { confirm, dialog } = useConfirm();

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => void onCreate()}>
        Сохранить версию
      </Button>
      {!versions.length && <p className="text-sm text-muted-foreground">Версий пока нет</p>}
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate">{v.label}</div>
            {v.subtitle && <div className="text-xs text-muted-foreground tabular-nums">{v.subtitle}</div>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const ok = await confirm({
                title: "Восстановить эту версию?",
                description: "Текущие данные документа будут заменены содержимым версии.",
              });
              if (!ok) return;
              await onRestore(v.id);
            }}
          >
            Восстановить
          </Button>
        </div>
      ))}
      {dialog}
    </div>
  );
}
