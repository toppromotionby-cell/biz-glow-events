// Слой выделения и трансформаций над `CanvasPage`.
//
// Клик выбирает верхний элемент под курсором, Shift добавляет к выделению,
// перетаскивание и 8 маркеров меняют геометрию. Изменения во время жеста
// идут «транзиентно», в историю попадает только результат — как в Canva.
import { useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  bbox, clampToPage, hitTest, type CanvasElement, type CanvasPage,
} from "@/lib/canvas/model";
import { TransformFrame } from "./TransformFrame";

export type SelectionLayerProps = {
  page: CanvasPage;
  scale: number;
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** Изменение геометрии выделенных элементов. */
  onChange: (next: CanvasElement[], transient: boolean) => void;
  /** Двойной клик по элементу — вход в редактирование содержимого. */
  onActivate?: (id: string) => void;
};

const MIN_SIZE = 8;

export function SelectionLayer({
  page, scale, selected, onSelect, onChange, onActivate,
}: SelectionLayerProps) {
  const startRef = useRef<CanvasElement[]>([]);

  const picked = useMemo(
    () => page.elements.filter((el) => selected.includes(el.id)),
    [page.elements, selected],
  );
  const frame = useMemo(() => bbox(picked), [picked]);

  const handleBackgroundClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / scale;
    const y = (e.clientY - box.top) / scale;
    const hit = hitTest(page.elements, x, y);
    if (!hit) {
      onSelect([]);
      return;
    }
    onSelect(e.shiftKey && !selected.includes(hit.id) ? [...selected, hit.id] : [hit.id]);
  };

  const begin = () => {
    startRef.current = picked.map((el) => ({ ...el }));
  };

  const apply = (
    map: (el: CanvasElement) => CanvasElement,
    transient: boolean,
  ) => {
    const changed = startRef.current.map((el) => clampToPage(map(el), page.format));
    onChange(changed, transient);
  };

  return (
    <div
      className="absolute inset-0"
      style={{ width: page.format.w * scale, height: page.format.h * scale }}
      onMouseDown={handleBackgroundClick}
    >
      {frame && (
        <TransformFrame
          rect={frame}
          scale={scale}
          keepRatio={picked.length > 1}
          hint={`${Math.round(frame.w)} × ${Math.round(frame.h)}`}
          onGestureStart={begin}
          onDrag={({ dx, dy }) =>
            apply((el) => ({ ...el, x: el.x + dx, y: el.y + dy }), true)
          }
          onResize={({ kx, ky, shift }) => {
            const sx = shift ? Math.max(kx, ky) : kx;
            const sy = shift ? Math.max(kx, ky) : ky;
            apply((el) => ({
              ...el,
              x: frame.x + (el.x - frame.x) * sx,
              y: frame.y + (el.y - frame.y) * sy,
              w: Math.max(MIN_SIZE, el.w * sx),
              h: Math.max(MIN_SIZE, el.h * sy),
            }), true);
          }}
          onGestureEnd={() => {
            const last = startRef.current;
            if (!last.length) return;
            // Финальное состояние уже применено — фиксируем его в истории.
            onChange(picked.map((el) => ({ ...el })), false);
          }}
          onDoubleClick={() => picked[0] && onActivate?.(picked[0].id)}
        />
      )}
    </div>
  );
}
