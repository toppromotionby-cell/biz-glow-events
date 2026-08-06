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

type DownloadOpts = {
  /** Обычный http(s)-URL того же файла на сервере — запасной путь, если blob заблокирован. */
  fallbackUrl?: string;
};

/**
 * Скачать файл по уже готовому URL (blob: или обычному).
 *
 * Порядок: сначала штатный <a download> — он работает и в iframe, если у фрейма
 * есть allow-downloads. Если браузер блокирует (частый случай для blob: внутри
 * sandbox-фрейма), уходим на серверный URL: новая вкладка, затем навигация.
 */
export function downloadUrl(url: string, filename: string, opts: DownloadOpts = {}) {
  if (anchorSupportsDownload()) {
    clickAnchor(url, filename);
    if (!inIframe()) return;
  }

  const serverUrl = opts.fallbackUrl;
  // В iframe клик мог быть тихо заблокирован — даём пользователю рабочий путь.
  if (!serverUrl) {
    if (!anchorSupportsDownload() && openInNewTab(url)) return;
    toast("Если файл не скачался", {
      description: filename,
      action: { label: "Открыть файл", onClick: () => openInNewTab(url) },
      duration: 10_000,
    });
    return;
  }

  toast("Если файл не скачался", {
    description: filename,
    action: {
      label: "Открыть файл",
      onClick: () => {
        if (!openInNewTab(serverUrl)) {
          try {
            (window.top ?? window).location.href = serverUrl;
          } catch {
            window.location.href = serverUrl;
          }
        }
      },
    },
    duration: 10_000,
  });
}

/** Скачать содержимое blob под заданным именем. */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  opts: DownloadOpts = {},
): Promise<void> {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename, opts);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
