// Универсальный рендер холста: элемент → список примитивов отрисовки.
//
// Один и тот же список исполняют браузер (DOM/React) и PDF-генератор, поэтому
// превью и файл не могут разойтись: расхождения возможны только в исполнителе
// примитива, а не в раскладке.
import {
  byZIndex, clamp, type CanvasElement, type CanvasPage, type PageFormat,
} from "./model";

/** Свойства текстового элемента. */
export type TextProps = {
  text?: string;
  fontSize?: number;
  lineHeight?: number;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  /** Кегль подгоняется под высоту блока (как в Canva). */
  autoFit?: boolean;
  /** Гарнитура: акцидентная (заголовки) или основная. */
  font?: "display" | "body";
  /** Заранее разложенные строки — если заданы, переносы не пересчитываются. */
  lines?: string[];
  uppercase?: boolean;
  letterSpacing?: number;
};

export type ImageProps = { src?: string; fit?: "cover" | "contain"; radius?: number };
export type ShapeProps = { fill?: string; radius?: number; opacity?: number };
export type TableProps = {
  columns?: number[];
  rows?: string[][];
  fontSize?: number;
  headColor?: string;
};

export type DrawOp =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string; radius: number; opacity: number }
  | {
      kind: "text"; x: number; y: number; w: number; h: number;
      text: string; fontSize: number; lineHeight: number; weight: number;
      color: string; align: NonNullable<TextProps["align"]>; valign: NonNullable<TextProps["valign"]>;
      font: "display" | "body"; lines?: string[]; uppercase: boolean; letterSpacing: number;
    }
  | { kind: "image"; x: number; y: number; w: number; h: number; src: string; fit: "cover" | "contain"; radius: number };


export const MIN_FONT = 7;
export const MAX_FONT = 160;

/** Кегль, при котором текст помещается в блок по высоте. */
export function fitFontSize(
  text: string,
  box: { w: number; h: number },
  base: number,
  lineHeight: number,
): number {
  const chars = Math.max(1, text.trim().length);
  let size = clamp(base, MIN_FONT, MAX_FONT);
  for (let i = 0; i < 24 && size > MIN_FONT; i += 1) {
    // Средняя ширина глифа ≈ 0.52em — достаточная оценка для авто-подгона.
    const perLine = Math.max(1, Math.floor(box.w / (size * 0.52)));
    const lines = Math.max(1, Math.ceil(chars / perLine) + (text.match(/\n/g)?.length ?? 0));
    if (lines * size * lineHeight <= box.h) break;
    size -= 1;
  }
  return Math.round(clamp(size, MIN_FONT, MAX_FONT));
}

function textOps(el: CanvasElement<TextProps>): DrawOp[] {
  const p = el.props ?? {};
  const text = p.text ?? "";
  if (!text.trim()) return [];
  const lineHeight = p.lineHeight ?? 1.3;
  const base = p.fontSize ?? 16;
  const fontSize = p.autoFit === false ? base : fitFontSize(text, el, base, lineHeight);
  return [{
    kind: "text",
    x: el.x, y: el.y, w: el.w, h: el.h,
    text, fontSize, lineHeight,
    weight: p.weight ?? 400,
    color: p.color ?? "#111111",
    align: p.align ?? "left",
    valign: p.valign ?? "top",
  }];
}

/** Один элемент → примитивы. Неизвестные типы просто пропускаются. */
export function elementOps(el: CanvasElement): DrawOp[] {
  switch (el.type) {
    case "text":
      return textOps(el as CanvasElement<TextProps>);
    case "shape": {
      const p = (el.props ?? {}) as ShapeProps;
      return [{
        kind: "rect", x: el.x, y: el.y, w: el.w, h: el.h,
        fill: p.fill ?? "#e5e7eb", radius: p.radius ?? 0,
        opacity: clamp(p.opacity ?? 1, 0, 1),
      }];
    }
    case "image":
    case "logo": {
      const p = (el.props ?? {}) as ImageProps;
      if (!p.src) return [];
      return [{
        kind: "image", x: el.x, y: el.y, w: el.w, h: el.h,
        src: p.src,
        fit: p.fit ?? (el.type === "logo" ? "contain" : "cover"),
        radius: p.radius ?? 0,
      }];
    }
    default:
      return [];
  }
}

/** Обрезка примитива по границам листа — ничего не рисуем за пределами A4/слайда. */
function insidePage(op: DrawOp, page: PageFormat): boolean {
  return op.x < page.w && op.y < page.h && op.x + op.w > 0 && op.y + op.h > 0;
}

/** Страница → упорядоченный список примитивов (фон, затем слои снизу вверх). */
export function pageOps(page: CanvasPage): DrawOp[] {
  const ops: DrawOp[] = [];
  if (page.background) {
    ops.push({
      kind: "rect", x: 0, y: 0, w: page.format.w, h: page.format.h,
      fill: page.background, radius: 0, opacity: 1,
    });
  }
  for (const el of [...page.elements].sort(byZIndex)) {
    for (const op of elementOps(el)) {
      if (insidePage(op, page.format)) ops.push(op);
    }
  }
  return ops;
}
