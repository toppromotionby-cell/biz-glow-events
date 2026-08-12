// Миграция слайда презентации в универсальную объектную модель холста.
//
// Функция детерминированная: берётся уже существующий спек слайда (тот же,
// что рисуют превью и PDF) и переводится в `CanvasElement[]` один в один —
// геометрия и кегли не меняются. Благодаря этому старые презентации
// открываются в новом редакторе без ручной переверстки.
import { PAGE_FORMATS, normalizeElement, type CanvasElement, type CanvasPage } from "@/lib/canvas/model";
import type { ImageProps, ShapeProps, TextProps } from "@/lib/canvas/ops";
import type { SpecBlock, SpecPaint } from "@/lib/presentations/slide-spec";
import { SLIDE_H, SLIDE_W, type SlideThemeTokens } from "@/lib/presentations/design";
import { FULL_BLEED_SHADE } from "@/lib/presentations/slide-spec";
import { wrapText } from "@/lib/presentations/text-metrics";

/** Полупрозрачные rgba() палитры сводим к плотному цвету — как в PDF. */
const solid = (css: string, fallback: string): string =>
  /^#?[0-9a-fA-F]{6}$/.test(css.trim()) ? css : fallback;

/** Токен цвета спека → конкретный hex темы слайда. */
export function paintHex(paint: SpecPaint, t: SlideThemeTokens): string {
  switch (paint) {
    case "ink":
      return solid(t.ink, "#111827");
    case "muted":
      return solid(t.muted, "#6b7280");
    case "accent":
      return t.accent;
    case "onAccent":
      return t.onAccent;
    case "onPhoto":
      return "#ffffff";
    case "onPhotoMuted":
      return "#ebebeb";
    default:
      return solid(t.panel, "#f7f8fa");
  }
}

export type ToElementsOptions = {
  theme: SlideThemeTokens;
  /** Путь в хранилище → готовый URL картинки. */
  resolveImage?: (path: string) => string | null;
  /** URL логотипа компании для блоков `logo`. */
  logoSrc?: string | null;
};

/** Спек слайда → элементы холста. Порядок блоков задаёт zIndex. */
export function specToElements(blocks: SpecBlock[], o: ToElementsOptions): CanvasElement[] {
  const out: CanvasElement[] = [];
  const push = (
    id: string,
    type: CanvasElement["type"],
    geom: { x: number; y: number; w: number; h: number },
    props: TextProps | ImageProps | ShapeProps,
  ): void => {
    out.push(normalizeElement({ id, type, ...geom, zIndex: out.length, props }));
  };

  blocks.forEach((b, i) => {
    switch (b.kind) {
      case "shade": {
        // Затемнение под текстом — обычная плашка внизу слайда.
        const y = b.from * SLIDE_H;
        push(`shade-${i}`, "shape", { x: 0, y, w: SLIDE_W, h: SLIDE_H - y }, {
          fill: "#000000",
          opacity: b.alpha,
          radius: 0,
        });
        break;
      }
      case "rect":
        push(`rect-${i}`, "shape", b, {
          fill: paintHex(b.color, o.theme),
          radius: b.radius,
          opacity: b.opacity ?? 1,
        });
        break;
      case "circle":
        push(
          `circle-${i}`,
          "shape",
          { x: b.cx - b.r, y: b.cy - b.r, w: b.r * 2, h: b.r * 2 },
          { fill: paintHex(b.color, o.theme), radius: b.r, opacity: b.opacity },
        );
        break;
      case "image": {
        const src = o.resolveImage?.(b.path) ?? b.path;
        push(`image-${i}`, "image", b, { src, fit: "cover", radius: b.radius });
        break;
      }
      case "logo": {
        const src = o.logoSrc ?? null;
        if (!src) break;
        push(`logo-${i}`, "logo", b, { src, fit: "contain", radius: 0 });
        break;
      }
      case "text": {
        const lines = b.lines ?? (b.text.trim() ? wrapText(b.text, b.size, b.w) : []);
        const h = Math.max(1, lines.length) * b.size * b.lineHeight;
        push(b.id ? `text-${b.id}` : `text-${i}`, "text", { x: b.x, y: b.y, w: b.w, h }, {
          text: b.text,
          fontSize: b.size,
          lineHeight: b.lineHeight,
          weight: b.weight,
          color: paintHex(b.color, o.theme),
          align: b.align,
          valign: "top",
          font: b.font,
          lines,
          uppercase: b.uppercase ?? false,
          letterSpacing: b.letterSpacing ?? 0,
          autoFit: false,
        });
        break;
      }
      default:
        break;
    }
  });

  return out;
}

/** Слайд целиком: фон темы + элементы спека в формате «слайд 16:9». */
export function slidePageFromSpec(
  id: string,
  blocks: SpecBlock[],
  o: ToElementsOptions,
): CanvasPage {
  return {
    id,
    format: PAGE_FORMATS.slide,
    background: o.theme.bgStops[0] ?? o.theme.bg,
    elements: specToElements(blocks, o),
  };
}

export { FULL_BLEED_SHADE };
