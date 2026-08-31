// Единая обёртка над window.open для всех кнопок «Открыть в новом окне».
// Всегда добавляет noopener,noreferrer и понятно сообщает о блокировке попапов.
import { toast } from "sonner";

export const POPUP_BLOCKED_MESSAGE =
  "Браузер заблокировал новое окно — разрешите всплывающие окна для сайта и повторите";

export type OpenInNewTabOptions = {
  /** Показывать тост при блокировке (по умолчанию да). */
  notify?: boolean;
  /** Имя окна: одинаковое имя переиспользует уже открытую вкладку. */
  target?: string;
};

/**
 * Открывает ссылку в новой вкладке.
 * @returns true, если окно открылось; false — если пусто/заблокировано.
 */
export function openInNewTab(url: string | null | undefined, opts: OpenInNewTabOptions = {}): boolean {
  const href = (url ?? "").trim();
  if (!href) {
    if (opts.notify !== false) toast.error("Ссылка недоступна");
    return false;
  }
  if (typeof window === "undefined") return false;

  const win = window.open(href, opts.target ?? "_blank", "noopener,noreferrer");
  if (!win) {
    if (opts.notify !== false) toast.error(POPUP_BLOCKED_MESSAGE);
    return false;
  }
  // Подстраховка для браузеров, игнорирующих noopener в features.
  try {
    win.opener = null;
  } catch {
    /* окно уже изолировано */
  }
  return true;
}
