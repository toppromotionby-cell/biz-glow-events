// Диалог просмотра документа: PDF/HTML в iframe + кнопки скачать / открыть во вкладке.
// Загрузка и открытие вкладки происходят по клику пользователя, поэтому браузер их не блокирует.
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ViewerDoc = { url: string; name: string; mime: string };

export function DocumentViewerDialog({
  doc,
  loading,
  onOpenChange,
}: {
  doc: ViewerDoc | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!doc || !!loading} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 px-5 py-3">
          <DialogTitle className="truncate text-base">{doc?.name ?? "Документ"}</DialogTitle>
          <div className="flex items-center gap-2 pr-6">
            {doc && (
              <>
                <Button size="sm" variant="outline" onClick={() => downloadUrl(doc.url, doc.name)}>
                  <Download className="mr-1.5 h-4 w-4" />Скачать
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />В новой вкладке
                  </a>
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {doc ? (
          <iframe title={doc.name} src={doc.url} className="h-[76vh] w-full border-0 bg-white" />
        ) : (
          <div className="flex h-[40vh] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Готовим документ…
          </div>
        )}

        <p className="border-t border-border/60 px-5 py-2 text-[11px] text-muted-foreground">
          Если скачивание заблокировано в окне предпросмотра — откройте документ в новой вкладке и сохраните оттуда.
        </p>
      </DialogContent>
    </Dialog>
  );
}
