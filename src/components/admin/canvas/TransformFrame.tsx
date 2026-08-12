// Рамка трансформации объекта холста — единый слой drag/resize для
// «Презентаций» и «Документов». Вся математика жестов живёт в react-moveable,
// свой код только переводит пиксели экрана в координаты холста.
import { Suspense, lazy, useRef, useState } from "react";

// react-moveable трогает DOM на импорте, поэтому грузим его только в браузере.
const Moveable = lazy(() => import("react-moveable"));

export type FrameRect = { x: number; y: number; w: number; h: number };

export type TransformFrameProps = {
  /** Геометрия в координатах холста. */
  rect: FrameRect;
  /** Текущий масштаб холста (px экрана на 1 px холста). */
  scale: number;
  label?: string;
  draggable?: boolean;
  resizable?: boolean;
  keepRatio?: boolean;
  /** Подсказка размера рядом с рамкой (например «640 × 360»). */
  hint?: string | null;
  /** Достигнут предел — маркеры подсвечиваются. */
  limit?: boolean;
  onGestureStart?: () => void;
  /** Перемещение: смещение от начала жеста в координатах холста. */
  onDrag?: (p: { dx: number; dy: number; clientX: number; clientY: number }) => void;
  /**
   * Изменение размера: коэффициенты к исходным ширине/высоте плюс модификаторы.
   * Блок сам решает, что делать с коэффициентом — менять ширину или кегль.
   */
  onResize?: (p: {
    kx: number; ky: number; k: number;
    w: number; h: number;
    shift: boolean; alt: boolean;
    dir: [number, number];
  }) => void;
  onGestureEnd?: () => void;
  onDoubleClick?: () => void;
};

export function TransformFrame({
  rect, scale, label, draggable = true, resizable = true, keepRatio = false,
  hint, limit, onGestureStart, onDrag, onResize, onGestureEnd, onDoubleClick,
}: TransformFrameProps) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const start = useRef({ x: 0, y: 0, w: 1, h: 1 });

  const px = (v: number) => v * scale;

  return (
    <>
      <div
        ref={setTarget}
        className="pointer-events-none absolute"
        style={{ left: px(rect.x), top: px(rect.y), width: px(rect.w), height: px(rect.h) }}
      >
        {label && (
          <span className="absolute -top-5 left-0 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {label}
          </span>
        )}
        {hint && (
          <span
            className={`absolute -bottom-7 right-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              limit ? "bg-amber-500 text-black" : "bg-primary text-primary-foreground"
            }`}
          >
            {hint}
          </span>
        )}
      </div>
      <Suspense fallback={null}>
        {target && (
          <Moveable
            target={target}
            draggable={draggable}
            resizable={resizable}
            rotatable={false}
            keepRatio={keepRatio}
            origin={false}
            edge={false}
            throttleDrag={0}
            throttleResize={0}
            renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
            className={limit ? "moveable-limit" : undefined}
            onDragStart={() => {
              start.current = { x: 0, y: 0, w: rect.w, h: rect.h };
              onGestureStart?.();
            }}
            onDrag={(e) => {
              const ev = e.inputEvent as MouseEvent;
              onDrag?.({
                dx: e.beforeTranslate[0] / scale,
                dy: e.beforeTranslate[1] / scale,
                clientX: ev?.clientX ?? 0,
                clientY: ev?.clientY ?? 0,
              });
            }}
            onDragEnd={() => onGestureEnd?.()}
            onResizeStart={() => {
              start.current = { x: 0, y: 0, w: Math.max(1, rect.w), h: Math.max(1, rect.h) };
              onGestureStart?.();
            }}
            onResize={(e) => {
              const ev = e.inputEvent as MouseEvent;
              const w = e.width / scale;
              const h = e.height / scale;
              const kx = w / start.current.w;
              const ky = h / start.current.h;
              const dir = e.direction as [number, number];
              const both = (dir[0] !== 0 && dir[1] !== 0) || !!ev?.shiftKey;
              const k = both ? Math.max(kx, ky) : dir[0] !== 0 ? kx : ky;
              onResize?.({
                kx, ky, k, w, h,
                shift: !!ev?.shiftKey,
                alt: !!ev?.altKey,
                dir,
              });
            }}
            onResizeEnd={() => onGestureEnd?.()}
            onClick={(e) => {
              if ((e.inputEvent as MouseEvent)?.detail >= 2) onDoubleClick?.();
            }}
          />
        )}
      </Suspense>
    </>
  );
}
