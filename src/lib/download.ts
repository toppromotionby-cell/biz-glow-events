// Надёжное скачивание файлов в браузере без зависимости от PDF-viewer.
// В окне предпросмотра страница живёт внутри sandbox-iframe, где клик по
// <a download> блокируется молча. Поэтому там сразу открываем файл в новой
// вкладке — оттуда он сохраняется штатно.
import { toast } from "sonner";

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function anchorSupportsDownload(): boolean {
  return "download" in document.createElement("a");
}

function clickAnchor(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1_000);
}

/** Открыть файл в новой вкладке; вернуть false, если попап заблокирован. */
function openInNewTab(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return !!win;
}

/** Скачать файл по уже готовому URL (blob: или обычному). */
export function downloadUrl(url: string, filename: string) {
  const needsTabFallback = inIframe() || !anchorSupportsDownload();
  if (!needsTabFallback) {
    clickAnchor(url, filename);
    return;
  }
  if (openInNewTab(url)) return;
  // Попап заблокирован — пробуем штатный путь и подсказываем пользователю.
  clickAnchor(url, filename);
  toast("Скачивание заблокировано браузером", {
    description: filename,
    action: { label: "Открыть файл", onClick: () => openInNewTab(url) },
    duration: 10_000,
  });
}

/** Скачать содержимое blob под заданным именем. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
