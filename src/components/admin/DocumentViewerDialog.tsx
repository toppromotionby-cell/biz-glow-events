// Диалог просмотра документа: PDF/HTML в iframe + кнопки скачать / открыть во вкладке.
// Загрузка и открытие вкладки происходят по клику пользователя, поэтому браузер их не блокирует.
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import { OpenInNewTabButton } from "@/components/admin/OpenInNewTabButton";
import { PdfPreview } from "@/components/admin/PdfPreview";
import { isPreviewableMime } from "@/lib/document-mime";

export type ViewerDoc = { url: string; name: string; mime: string; blob: Blob };

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
                <OpenInNewTabButton href={doc.url} label="В новом окне" target="doc-viewer-tab" />
                <Button size="sm" variant="outline" onClick={() => void downloadBlob(doc.blob, doc.name)}>
                  <Download className="mr-1.5 h-4 w-4" />Скачать
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {doc ? doc.mime === "application/pdf" ? (
          <PdfPreview blob={doc.blob} />
        ) : isPreviewableMime(doc.mime) ? (
          <iframe title={doc.name} src={doc.url} className="h-[76vh] w-full border-0 bg-background" />
        ) : (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium">Файл готов к сохранению</p>
            <p className="text-xs text-muted-foreground">
              {doc.name} · {(doc.blob.size / 1024).toFixed(0)} КБ — этот формат браузер не показывает.
            </p>
            <Button size="sm" onClick={() => void downloadBlob(doc.blob, doc.name)}>
              <Download className="mr-1.5 h-4 w-4" />Скачать файл
            </Button>
          </div>
        ) : (
          <div className="flex h-[40vh] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Готовим документ…
          </div>
        )}

        <p className="border-t border-border/60 px-5 py-2 text-[11px] text-muted-foreground">
          Если скачивание заблокировано в окне предпросмотра — нажмите «В новом окне» и сохраните документ оттуда.
        </p>
      </DialogContent>
    </Dialog>
  );
}
