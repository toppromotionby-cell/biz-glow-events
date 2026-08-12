// Единый «сценарий» контентного слайда (позиция / текст) в координатах
// холста 1280×720. Ровно один и тот же список блоков рисуют превью
// (SlideCanvas) и PDF (pdf.server), поэтому файл выглядит так же, как экран.
//
// Здесь нет ни CSS-потока, ни ручных отступов «на глаз»: каждая строка,
// плашка и фотография получают абсолютную геометрию, посчитанную по общим
// метрикам текста (text-metrics.ts).
import { GRID, SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import {
  DEFAULT_LAYOUT_OVERRIDES, clampNum, PRICE_SCALE_MAX, PRICE_SCALE_MIN,
  partTextScale,
  type PresentationSlide, type SlideLayoutOverrides, type TextAlignX,
} from "@/lib/presentations/model";
import { measureText, wrapText } from "@/lib/presentations/text-metrics";
import { FULL_BLEED_SHADE, type SpecBlock, type SpecPaint } from "@/lib/presentations/slide-spec";

/** Геометрия элементов контентного слайда — общая для превью и PDF. */
export const CONTENT = {
  /** Акцентная линия под заголовком. */
  ruleW: 64,
  ruleH: 3,
  ruleGapTop: 18,
  /** Отступ подзаголовка от заголовка. */
  subtitleGap: 8,
  /** Втяжка текста пункта списка от маркера. */
  bulletIndent: 18,
  bulletGap: 6,
  listGapTop: 10,
  /** Плашки характеристик. */
  chipPadX: 14,
  chipPadY: 9,
  chipGap: 10,
  chipRadius: 12,
  /** Плашка цены. */
  pricePadX: 20,
  pricePadY: 10,
  priceGap: 10,
  priceRadius: 14,
  skuGapTop: 12,
  footerBottom: 28,
} as const;

export function money(n: number): string {
  const v = new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${v} BYN`;
}

type Align = "left" | "center" | "right";

/** Кегли частей текста с учётом ручного масштаба — общие для превью и PDF. */
export function partSizes(
  ov: SlideLayoutOverrides,
  base: { title: number; subtitle: number; body: number },
): { title: number; subtitle: number; body: number } {
  return {
    title: base.title * partTextScale(ov.titleScale),
    subtitle: base.subtitle * partTextScale(ov.subtitleScale),
    body: base.body * partTextScale(ov.bodyScale),
  };
}

const resolveAlign = (part: TextAlignX, base: Align): Align =>
  part === "auto" ? base : part;

/** Смещение по X для блока ширины `w` внутри колонки шириной `boxW`. */
function offsetX(align: Align, boxW: number, w: number): number {
  if (align === "center") return Math.max(0, (boxW - w) / 2);
  if (align === "right") return Math.max(0, boxW - w);
  return 0;
}

export type ContentSpecInput = {
  slide: PresentationSlide;
  fit: SlideFit;
  /** Название компании для футера. */
  brandName: string;
  /** Логотип компании стоит в футере — название не дублируем. */
  footerLogo: boolean;
  index?: number;
  total?: number;
};

/**
 * Блоки контентного слайда: фотографии, затемнение, текстовая колонка,
 * характеристики, цена, артикул и футер.
 */
export function contentSlideSpec(a: ContentSpecInput): SpecBlock[] {
  const { slide, fit } = a;
  const c = slide.content;
  const ts = fit.type;
  const layout = fit.layout;
  const ov = c.layout ?? DEFAULT_LAYOUT_OVERRIDES;
  const blocks: SpecBlock[] = [];

  // --- Фотографии ---------------------------------------------------
  layout.frames.forEach((f, i) => {
    const path = layout.photos[i];
    if (!path) return;
    const fullEdge = f.x === 0 || f.w >= SLIDE_W;
    blocks.push({
      kind: "image",
      index: i,
      path,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      radius: fullEdge ? 0 : GRID.radius,
    });
  });

  const isFull = layout.placement === "full";
  if (isFull) blocks.push({ kind: "shade", from: FULL_BLEED_SHADE.from, alpha: FULL_BLEED_SHADE.alpha });

  const ink: SpecPaint = isFull ? "onPhoto" : "ink";
  const muted: SpecPaint = isFull ? "onPhotoMuted" : "muted";

  // --- Текстовая колонка --------------------------------------------
  const box: Rect = layout.textBox;
  const baseAlign: Align = layout.textAlignX;
  const x = box.x;
  const w = box.w;
  let y = box.y;

  const push = (
    text: string,
    opts: {
      id?: "title" | "subtitle" | "body";
      size: number;
      lineHeight: number;
      font: "display" | "body";
      weight: number;
      color: SpecPaint;
      align: Align;
      width?: number;
      placeholder?: string;
      uppercase?: boolean;
      letterSpacing?: number;
      keepEmpty?: boolean;
    },
  ): void => {
    const width = opts.width ?? w;
    const lines = text.trim() ? wrapText(text, opts.size, width) : [];
    if (!lines.length && !opts.keepEmpty) return;
    blocks.push({
      kind: "text",
      id: opts.id,
      x,
      y,
      w: width,
      size: opts.size,
      lineHeight: opts.lineHeight,
      font: opts.font,
      weight: opts.weight,
      color: opts.color,
      text,
      placeholder: opts.placeholder,
      align: opts.align,
      uppercase: opts.uppercase,
      letterSpacing: opts.letterSpacing,
      lines: opts.id ? undefined : lines,
    });
    y += Math.max(1, lines.length) * opts.size * opts.lineHeight;
  };

  const sizes = partSizes(ov, {
    title: ts.titleSlide,
    subtitle: ts.subtitle,
    body: ts.body,
  });
  const titleSize = sizes.title;
  push(slide.title, {
    id: "title",
    size: titleSize,
    lineHeight: 1.1,
    font: "display",
    weight: 800,
    color: ink,
    align: resolveAlign(ov.titleAlignX, baseAlign),
    placeholder: slide.type === "product" ? "Название позиции" : "Заголовок слайда",
    keepEmpty: true,
  });

  if (slide.subtitle.trim()) {
    y += CONTENT.subtitleGap;
    push(slide.subtitle, {
      id: "subtitle",
      size: sizes.subtitle,
      lineHeight: 1.3,
      font: "body",
      weight: 400,
      color: muted,
      align: resolveAlign(ov.subtitleAlignX, baseAlign),
      placeholder: "Подзаголовок",
    });
  }

  if (!isFull) {
    y += CONTENT.ruleGapTop;
    blocks.push({
      kind: "rect",
      x: x + offsetX(baseAlign, w, CONTENT.ruleW),
      y,
      w: CONTENT.ruleW,
      h: CONTENT.ruleH,
      radius: CONTENT.ruleH,
      color: "accent",
    });
    y += CONTENT.ruleH;
  }

  if (c.showDescription && c.description.trim()) {
    y += ts.blockGap;
    push(c.description, {
      id: "body",
      size: sizes.body,
      lineHeight: ts.lineGap,
      font: "body",
      weight: 400,
      color: ink,
      align: resolveAlign(ov.bodyAlignX, baseAlign),
    });
  }

  if (c.showIncludes && c.includes.length) {
    y += ts.blockGap;
    if (slide.type === "product") {
      push("Что входит", {
        size: ts.label,
        lineHeight: 1.3,
        font: "body",
        weight: 600,
        color: muted,
        align: baseAlign,
        uppercase: true,
        letterSpacing: 1,
      });
      y += CONTENT.listGapTop;
    }
    for (const item of c.includes.slice(0, 9)) {
      const size = ts.bullet;
      if (baseAlign === "left") {
        const innerW = w - CONTENT.bulletIndent;
        const lines = wrapText(item, size, innerW);
        blocks.push({
          kind: "text", x, y, w: CONTENT.bulletIndent, size, lineHeight: ts.lineGap,
          font: "body", weight: 400, color: "accent", text: "•", align: "left", lines: ["•"],
        });
        blocks.push({
          kind: "text", x: x + CONTENT.bulletIndent, y, w: innerW, size, lineHeight: ts.lineGap,
          font: "body", weight: 400, color: ink, text: item, align: "left", lines,
        });
        y += Math.max(1, lines.length) * size * ts.lineGap + CONTENT.bulletGap;
      } else {
        const text = `• ${item}`;
        const lines = wrapText(text, size, w);
        blocks.push({
          kind: "text", x, y, w, size, lineHeight: ts.lineGap,
          font: "body", weight: 400, color: ink, text, align: baseAlign, lines,
        });
        y += Math.max(1, lines.length) * size * ts.lineGap + CONTENT.bulletGap;
      }
    }
  }

  if (c.showSpecs && c.specs.length) {
    y += ts.blockGap;
    const size = ts.chip;
    const chipH = size * 1.3 + CONTENT.chipPadY * 2;
    // Раскладываем «чипы» по строкам, как flex-wrap в превью.
    const rows: { text: string; w: number }[][] = [[]];
    let rowW = 0;
    for (const s of c.specs) {
      const text = `${s.label}: ${s.value}`;
      const cw = measureText(text, size) + CONTENT.chipPadX * 2;
      const add = rows[rows.length - 1].length ? cw + CONTENT.chipGap : cw;
      if (rowW + add > w && rows[rows.length - 1].length) {
        rows.push([]);
        rowW = cw;
      } else {
        rowW += add;
      }
      rows[rows.length - 1].push({ text, w: cw });
    }
    for (const row of rows) {
      const total = row.reduce((sum, ch) => sum + ch.w, 0) + CONTENT.chipGap * (row.length - 1);
      let cx = x + offsetX(baseAlign, w, total);
      for (const chip of row) {
        blocks.push({
          kind: "rect", x: cx, y, w: chip.w, h: chipH,
          radius: CONTENT.chipRadius, color: "panel",
        });
        blocks.push({
          kind: "text",
          x: cx + CONTENT.chipPadX,
          y: y + CONTENT.chipPadY,
          w: chip.w - CONTENT.chipPadX * 2,
          size,
          lineHeight: 1.3,
          font: "body",
          weight: 500,
          color: ink,
          text: chip.text,
          align: "left",
          lines: [chip.text],
        });
        cx += chip.w + CONTENT.chipGap;
      }
      y += chipH + CONTENT.chipGap;
    }
    y -= CONTENT.chipGap;
  }

  // --- Цена ----------------------------------------------------------
  const showPrice = c.showPrice && c.price != null && c.price > 0;
  if (showPrice) {
    const k = clampNum(ov.priceScale ?? 1, PRICE_SCALE_MIN, PRICE_SCALE_MAX);
    const sum = money(c.price as number);
    const unit = `/ ${c.priceUnit}`;
    const sumSize = ts.stat * k;
    const unitSize = ts.caption * k;
    const padX = CONTENT.pricePadX * k;
    const padY = CONTENT.pricePadY * k;
    const gap = CONTENT.priceGap * k;
    const pillW = measureText(sum, sumSize) + gap + measureText(unit, unitSize) + padX * 2;
    const pillH = sumSize * 1.25 + padY * 2;
    const pb = layout.priceBox;
    const px = pb ? pb.x : x + offsetX(baseAlign, w, pillW);
    const py = pb ? pb.y : y + ts.blockGap;

    blocks.push({
      kind: "rect", x: px, y: py, w: pillW, h: pillH,
      radius: CONTENT.priceRadius * k, color: "accent",
    });
    blocks.push({
      kind: "text", x: px + padX, y: py + padY, w: pillW - padX * 2, size: sumSize,
      lineHeight: 1.25, font: "display", weight: 800, color: "onAccent",
      text: sum, align: "left", lines: [sum],
    });
    blocks.push({
      kind: "text",
      x: px + padX + measureText(sum, sumSize) + gap,
      y: py + padY + (sumSize - unitSize) * 0.9,
      w: pillW,
      size: unitSize,
      lineHeight: 1.25,
      font: "body",
      weight: 400,
      color: "onAccent",
      text: unit,
      align: "left",
      lines: [unit],
    });
    if (!pb) y = py + pillH;
  }

  if (c.sku.trim()) {
    y += CONTENT.skuGapTop;
    push(`Артикул: ${c.sku}`, {
      size: ts.caption,
      lineHeight: 1.3,
      font: "body",
      weight: 400,
      color: muted,
      align: baseAlign,
    });
  }

  // --- Футер ----------------------------------------------------------
  blocks.push(...footerSpec({
    ts: ts.caption,
    brandName: a.footerLogo ? "" : a.brandName,
    index: a.index,
    total: a.total,
    color: muted,
  }));

  return blocks;
}

/** Футер слайда: название компании слева, номер страницы справа. */
export function footerSpec(a: {
  ts: number;
  brandName: string;
  index?: number;
  total?: number;
  color: SpecPaint;
}): SpecBlock[] {
  const out: SpecBlock[] = [];
  const y = SLIDE_H - CONTENT.footerBottom - a.ts * 1.2;
  const w = SLIDE_W - GRID.marginX * 2;
  if (a.brandName.trim()) {
    out.push({
      kind: "text", x: GRID.marginX, y, w, size: a.ts, lineHeight: 1.2,
      font: "body", weight: 400, color: a.color, text: a.brandName,
      align: "left", lines: [a.brandName],
    });
  }
  if (a.index !== undefined && a.total !== undefined) {
    const label = `${a.index + 1} / ${a.total}`;
    out.push({
      kind: "text", x: GRID.marginX, y, w, size: a.ts, lineHeight: 1.2,
      font: "body", weight: 400, color: a.color, text: label,
      align: "right", lines: [label],
    });
  }
  return out;
}
