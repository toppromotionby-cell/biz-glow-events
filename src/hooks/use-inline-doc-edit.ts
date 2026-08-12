// Единый механизм инлайн-правки документа: двойной клик по блоку листа
// открывает диалог редактирования этого блока.
//
// Лист рисуется двумя способами — как DOM внутри страницы (промо-КП) и как
// iframe (стандартное КП), поэтому хук слушает оба источника:
//   1) делегированный `dblclick` на контейнере листа;
//   2) `postMessage` от скрипта внутри iframe.
// Поиск блока идёт через `closest('[data-edit]')`, поэтому масштаб сцены,
// вложенность и полноэкранный слой на попадание не влияют.
import { useCallback, useEffect, useRef, type RefObject } from "react";

export type DocEditHit = { target: string; id: string | null };

export function useInlineDocEdit({
  enabled,
  onEdit,
  frameRef,
}: {
  enabled: boolean;
  onEdit: (hit: DocEditHit) => void;
  /** iframe с превью — сообщения принимаются только от него. */
  frameRef?: RefObject<HTMLIFrameElement | null>;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  const handleNode = useCallback((node: EventTarget | null) => {
    if (!enabledRef.current) return;
    const el = node instanceof Element ? node.closest<HTMLElement>("[data-edit]") : null;
    if (!el) return;
    onEditRef.current({ target: el.dataset.edit ?? "", id: el.dataset.editId ?? null });
  }, []);

  // Двойной клик по DOM-листу: слушатель вешается ref-колбэком, поэтому
  // переживает перемонтирование листа.
  const detach = useRef<(() => void) | null>(null);
  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      detach.current?.();
      detach.current = null;
      nodeRef.current = el;
      if (!el) return;
      const onDbl = (e: MouseEvent) => handleNode(e.target);
      el.addEventListener("dblclick", onDbl);
      detach.current = () => el.removeEventListener("dblclick", onDbl);
    },
    [handleNode],
  );

  // Двойной клик внутри iframe-превью.
  useEffect(() => {
    if (!frameRef) return;
    const onMessage = (e: MessageEvent) => {
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      const d = e.data as { source?: string; type?: string; target?: string; id?: string | null };
      if (d?.source !== "doc-preview" || d.type !== "doc-edit" || !d.target) return;
      if (!enabledRef.current) return;
      onEditRef.current({ target: d.target, id: d.id ?? null });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef]);

  return { containerRef, nodeRef, handleNode };
}
