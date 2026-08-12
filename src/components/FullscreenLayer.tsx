// Полноэкранный слой приложения (редакторы, показ презентации, просмотр документа).
//
// Зачем портал: глобальное правило `main, header, footer { position: relative;
// z-index: 2 }` создаёт контекст наложения, из-за которого `fixed inset-0 z-30`
// внутри <main> оказывается НИЖЕ бокового меню админки (`fixed z-10` уровнем выше).
// Меню перехватывало клики по левой панели редактора — казалось, что элементы
// «живут своей жизнью». Портал в <body> выносит слой из ловушки, а единая шкала
// z-слоёв (см. Z_LAYER) не даёт наложениям вернуться.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Единая шкала слоёв приложения.
 * Всё, что всплывает (меню, диалоги, уведомления), обязано быть ВЫШЕ
 * полноэкранных слоёв — иначе окно рисуется под редактором, а Radix при этом
 * блокирует клики по странице, и интерфейс выглядит «зависшим».
 */
export const Z_LAYER = {
  content: 2,
  sidebar: 10,
  fullscreen: 60,
  /** Полноэкранный показ презентации. */
  overlayTop: 70,
  /** Меню, селекты, поповеры, подсказки. */
  popover: 90,
  /** Диалоги, шторки, drawer. */
  dialog: 100,
  /** Тост-уведомления — поверх всего. */
  toast: 110,
} as const;


/** Атрибут на <body>, пока открыт хотя бы один полноэкранный слой. */
const BODY_ATTR = "data-fullscreen-layer";
let openCount = 0;

export function FullscreenLayer({
  children,
  className = "",
  zIndex = Z_LAYER.fullscreen,
  label,
}: {
  children: ReactNode;
  className?: string;
  zIndex?: number;
  /** aria-label слоя. */
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    openCount += 1;
    document.body.setAttribute(BODY_ATTR, "1");
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (!openCount) document.body.removeAttribute(BODY_ATTR);
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${className}`}
      style={{ zIndex }}
      aria-label={label}
    >
      {children}
    </div>,
    document.body,
  );
}
