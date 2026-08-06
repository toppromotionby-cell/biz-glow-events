// Надёжное скачивание файлов в браузере.
// В превью-iframe (sandbox) атрибут download игнорируется и файл не сохраняется,
// поэтому там открываем документ в новой вкладке — она создаётся по клику пользователя.
import { toast } from "sonner";

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Скачать файл по уже готовому URL (blob: или обычному). */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (inFrame()) {
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      toast.info("Скачивание в окне предпросмотра ограничено — откройте документ в новой вкладке");
    }
  }
}

/** Скачать содержимое blob под заданным именем. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
