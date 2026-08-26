// Структурные слайды презентации: оглавление, цифры, тайминг, команда,
// сравнение, галерея, цитата, смета, логотипы и призыв к действию.
//
// Как и остальные спеки, файл возвращает абсолютную геометрию блоков в
// координатах холста 1280×720 — один и тот же список рисуют превью
// (SlideCanvas) и PDF (pdf.server), поэтому вывод совпадает пиксель в пиксель.
import { GRID, SLIDE_H, SLIDE_W, slidePhotos, type Rect, type TypeScale } from "@/lib/presentations/design";
import { photoFrames } from "@/lib/presentations/photo-grid";
import { photoAlt } from "@/lib/presentations/captions";
import { measureText, wrapText } from "@/lib/presentations/text-metrics";
import {
  SLIDE_TYPES, slideVariantId, type PresentationSlide, type SlideType,
} from "@/lib/presentations/model";
import { footerSpec } from "@/lib/presentations/content-spec";
import {
  FULL_BLEED_SHADE, SPEC, type SpecBlock, type SpecImage, type SpecPaint,
} from "@/lib/presentations/slide-spec";

/** Типы слайдов со своей структурной раскладкой (не текст и не позиция). */
export const LAYOUT_SLIDE_TYPES = [
  "agenda", "stats", "timeline", "team", "compare",
  "gallery", "quote", "estimate", "logos", "cta",
] as const satisfies readonly SlideType[];

export type LayoutSlideType = (typeof LAYOUT_SLIDE_TYPES)[number];

export function isLayoutSlideType(t: SlideType): t is LayoutSlideType {
  return (LAYOUT_SLIDE_TYPES as readonly string[]).includes(t);
}

/** Все известные типы (защита от рассинхрона списков). */
export const ALL_SLIDE_TYPES = SLIDE_TYPES;

export type LayoutSpecInput = {
  slide: PresentationSlide;
  ts: TypeScale;
  brandName: string;
  /** Логотип компании стоит в футере — название не дублируем. */
  footerLogo: boolean;
  index?: number;
  total?: number;
};

const PAD_X = SPEC.padX;
const PAD_TOP = SPEC.padTop;
const CONTENT_W = SLIDE_W - PAD_X * 2;
const BOTTOM = SLIDE_H - 84;
const GAP = 20;

const lines = (text: string, size: number, w: number, face: "body" | "bold" | "display" = "body") =>
  text.trim() ? wrapText(text, size, w, face) : [];

const heightOf = (text: string, size: number, w: number, lh: number, face: "body" | "bold" | "display" = "body") =>
  Math.max(1, lines(text, size, w, face).length) * size * lh;

type TextOpts = {
  x: number;
  y: number;
  w: number;
  size: number;
  lineHeight?: number;
  font?: "display" | "body";
  weight?: number;
  color?: SpecPaint;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacing?: number;
  id?: "title" | "subtitle" | "body";
  placeholder?: string;
  maxLines?: number;
};

/** Текстовый блок с заранее посчитанными строками (как в остальных спеках). */
function text(t: string, o: TextOpts): SpecBlock {
  const face = o.font === "display" ? "display" : (o.weight ?? 400) >= 600 ? "bold" : "body";
  let ls = lines(t, o.size, o.w, face);
  if (o.maxLines && ls.length > o.maxLines) {
    ls = ls.slice(0, o.maxLines);
    ls[ls.length - 1] = `${ls[ls.length - 1].replace(/\s+\S*$/, "")}…`;
  }
  return {
    kind: "text",
    id: o.id,
    x: o.x,
    y: o.y,
    w: o.w,
    size: o.size,
    lineHeight: o.lineHeight ?? 1.3,
    font: o.font ?? "body",
    weight: o.weight ?? 400,
    color: o.color ?? "ink",
    text: t,
    placeholder: o.placeholder,
    align: o.align ?? "left",
    uppercase: o.uppercase,
    letterSpacing: o.letterSpacing,
    lines: o.id ? undefined : ls,
  };
}

const panel = (r: Rect, color: SpecPaint = "panel", opacity?: number): SpecBlock => ({
  kind: "rect", x: r.x, y: r.y, w: r.w, h: r.h, radius: GRID.radius, color, opacity,
});

/** Шапка структурного слайда: заголовок, подзаголовок, акцентная линия. */
function header(
  a: LayoutSpecInput,
  opts: { align?: "left" | "center"; rule?: boolean; onPhoto?: boolean } = {},
): { blocks: SpecBlock[]; y: number } {
  const { slide, ts } = a;
  const align = opts.align ?? "left";
  const ink: SpecPaint = opts.onPhoto ? "onPhoto" : "ink";
  const muted: SpecPaint = opts.onPhoto ? "onPhotoMuted" : "muted";
  const blocks: SpecBlock[] = [];
  let y = PAD_TOP;

  blocks.push(text(slide.title, {
    id: "title", x: PAD_X, y, w: CONTENT_W, size: ts.titleSection, lineHeight: 1.12,
    font: "display", weight: 800, color: ink, align, placeholder: "Заголовок слайда",
  }));
  y += heightOf(slide.title || "Заголовок слайда", ts.titleSection, CONTENT_W, 1.12, "display");

  if (slide.subtitle.trim()) {
    y += 10;
    blocks.push(text(slide.subtitle, {
      id: "subtitle", x: PAD_X, y, w: Math.min(880, CONTENT_W), size: ts.subtitle,
      font: "body", color: muted, align, placeholder: "Подзаголовок",
    }));
    y += heightOf(slide.subtitle, ts.subtitle, Math.min(880, CONTENT_W), 1.3);
  }

  if (opts.rule !== false) {
    y += 18;
    blocks.push({
      kind: "rect",
      x: align === "center" ? SLIDE_W / 2 - 32 : PAD_X,
      y, w: 64, h: 3, radius: 3, color: "accent",
    });
    y += 3;
  }
  return { blocks, y: y + 28 };
}

/** Свободная область под шапкой. */
const area = (y: number): Rect => ({ x: PAD_X, y, w: CONTENT_W, h: Math.max(120, BOTTOM - y) });

/** Равные колонки внутри области. */
function columns(box: Rect, count: number, gap = GAP): Rect[] {
  const w = (box.w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x: box.x + i * (w + gap), y: box.y, w, h: box.h }));
}

/* ------------------------------------------------------------------ */
/* Оглавление / программа                                              */
/* ------------------------------------------------------------------ */

function agendaSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts } = a;
  const items = a.slide.content.includes.filter(Boolean).slice(0, 10);
  const h = header(a, { align: variant === "minimal" ? "center" : "left", rule: variant !== "minimal" });
  const out = [...h.blocks];
  const box = area(h.y);
  if (!items.length) return out;

  if (variant === "cards") {
    const perRow = items.length > 4 ? 3 : 2;
    const rows = Math.ceil(items.length / perRow);
    const cardH = Math.min(150, (box.h - GAP * (rows - 1)) / rows);
    items.forEach((item, i) => {
      const col = columns(box, perRow)[i % perRow];
      const y = box.y + Math.floor(i / perRow) * (cardH + GAP);
      out.push(panel({ x: col.x, y, w: col.w, h: cardH }));
      out.push(text(String(i + 1).padStart(2, "0"), {
        x: col.x + 22, y: y + 18, w: col.w - 44, size: ts.label, weight: 700,
        color: "accent", letterSpacing: 1,
      }));
      out.push(text(item, {
        x: col.x + 22, y: y + 18 + ts.label * 1.3 + 8, w: col.w - 44,
        size: ts.bullet, weight: 600, maxLines: 3,
      }));
    });
    return out;
  }

  const cols = variant === "two-cols" && items.length > 4 ? 2 : 1;
  const colBoxes = columns(box, cols, 48);
  const perCol = Math.ceil(items.length / cols);
  const step = Math.min(74, box.h / perCol);

  items.forEach((item, i) => {
    const col = colBoxes[Math.floor(i / perCol)];
    const row = i % perCol;
    const y = col.y + row * step;
    const numW = variant === "minimal" ? 0 : 62;
    if (variant === "rail") {
      out.push({ kind: "rect", x: col.x, y: y + 6, w: 3, h: step - 14, radius: 3, color: "accent", opacity: 0.5 });
      out.push({ kind: "circle", cx: col.x + 1.5, cy: y + 14, r: 6, color: "accent", opacity: 1 });
    } else if (numW) {
      out.push(text(String(i + 1).padStart(2, "0"), {
        x: col.x, y, w: numW, size: ts.subtitle, weight: 700, font: "display", color: "accent",
      }));
    }
    const tx = variant === "rail" ? col.x + 28 : col.x + numW;
    out.push(text(item, {
      x: tx, y, w: col.w - (tx - col.x), size: ts.bullet, weight: 500, maxLines: 2,
    }));
    if (variant !== "rail" && variant !== "minimal") {
      out.push({
        kind: "rect", x: col.x, y: y + step - 12, w: col.w, h: 1, radius: 1, color: "muted", opacity: 0.25,
      });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Цифры и факты                                                       */
/* ------------------------------------------------------------------ */

function statsSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts } = a;
  const items = a.slide.content.specs.filter((s) => s.label || s.value);
  const h = header(a, { align: variant === "giant" ? "center" : "left", rule: variant !== "giant" });
  const out = [...h.blocks];
  const box = area(h.y);
  if (!items.length) return out;

  const bigSize = Math.round(ts.titleHero * 0.9);

  if (variant === "giant") {
    const first = items[0];
    const y = box.y + Math.max(0, (box.h - bigSize * 2.2) / 2);
    out.push(text(first.value, {
      x: box.x, y, w: box.w, size: bigSize * 1.4, lineHeight: 1, font: "display",
      weight: 800, color: "accent", align: "center",
    }));
    out.push(text(first.label, {
      x: box.x, y: y + bigSize * 1.4 + 16, w: box.w, size: ts.subtitle, color: "muted", align: "center",
    }));
    const rest = items.slice(1, 4);
    if (rest.length) {
      const cols = columns({ ...box, y: y + bigSize * 1.4 + 16 + ts.subtitle * 1.3 + 40, h: 90 }, rest.length);
      rest.forEach((s, i) => {
        out.push(text(s.value, {
          x: cols[i].x, y: cols[i].y, w: cols[i].w, size: ts.stat, font: "display",
          weight: 800, align: "center",
        }));
        out.push(text(s.label, {
          x: cols[i].x, y: cols[i].y + ts.stat * 1.25, w: cols[i].w, size: ts.caption,
          color: "muted", align: "center",
        }));
      });
    }
    return out;
  }

  if (variant === "bento") {
    const list = items.slice(0, 4);
    const rowH = (box.h - GAP) / 2;
    const heroW = box.w * 0.56;
    const rects: Rect[] = [
      { x: box.x, y: box.y, w: heroW, h: box.h },
      { x: box.x + heroW + GAP, y: box.y, w: box.w - heroW - GAP, h: rowH },
      { x: box.x + heroW + GAP, y: box.y + rowH + GAP, w: (box.w - heroW - GAP - GAP) / 2, h: rowH },
      {
        x: box.x + heroW + GAP + (box.w - heroW - GAP - GAP) / 2 + GAP,
        y: box.y + rowH + GAP, w: (box.w - heroW - GAP - GAP) / 2, h: rowH,
      },
    ];
    list.forEach((s, i) => {
      const r = rects[i];
      out.push(panel(r, i === 0 ? "accent" : "panel"));
      const size = i === 0 ? bigSize : ts.stat;
      out.push(text(s.value, {
        x: r.x + 26, y: r.y + r.h / 2 - size * 0.9, w: r.w - 52, size, lineHeight: 1.05,
        font: "display", weight: 800, color: i === 0 ? "onAccent" : "ink",
      }));
      out.push(text(s.label, {
        x: r.x + 26, y: r.y + r.h / 2 + size * 0.35, w: r.w - 52, size: ts.caption,
        color: i === 0 ? "onAccent" : "muted", maxLines: 2,
      }));
    });
    return out;
  }

  const list = items.slice(0, variant === "strip" ? 5 : 3);
  const cols = columns(box, list.length);
  const cardH = variant === "strip" ? 130 : Math.min(240, box.h);
  list.forEach((s, i) => {
    const r: Rect = { x: cols[i].x, y: box.y, w: cols[i].w, h: cardH };
    if (variant === "cards") out.push(panel(r, i === 0 ? "accent" : "panel"));
    if (variant === "strip" && i > 0) {
      out.push({ kind: "rect", x: r.x - GAP / 2, y: r.y + 8, w: 1, h: cardH - 16, radius: 1, color: "muted", opacity: 0.3 });
    }
    const onAccent = variant === "cards" && i === 0;
    const size = variant === "strip" ? ts.stat : Math.round(bigSize * 0.8);
    const px = variant === "cards" ? 24 : 0;
    out.push(text(s.value, {
      x: r.x + px, y: r.y + (variant === "cards" ? 28 : 6), w: r.w - px * 2, size,
      lineHeight: 1.05, font: "display", weight: 800, color: onAccent ? "onAccent" : "accent",
    }));
    out.push(text(s.label, {
      x: r.x + px, y: r.y + (variant === "cards" ? 28 : 6) + size * 1.2, w: r.w - px * 2,
      size: ts.body, color: onAccent ? "onAccent" : "muted", maxLines: 3,
    }));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Тайминг / этапы                                                     */
/* ------------------------------------------------------------------ */

function timelineSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts } = a;
  const items = a.slide.content.specs.filter((s) => s.label || s.value).slice(0, variant === "compact" ? 8 : 6);
  const h = header(a);
  const out = [...h.blocks];
  const box = area(h.y);
  if (!items.length) return out;

  if (variant === "horizontal" || variant === "steps") {
    const cols = columns(box, Math.min(items.length, 5));
    const lineY = box.y + 26;
    if (variant === "horizontal") {
      out.push({ kind: "rect", x: box.x, y: lineY, w: box.w, h: 2, radius: 2, color: "muted", opacity: 0.35 });
    }
    items.slice(0, 5).forEach((s, i) => {
      const c = cols[i];
      if (variant === "steps") {
        out.push(panel({ x: c.x, y: box.y, w: c.w, h: Math.min(260, box.h) }));
      } else {
        out.push({ kind: "circle", cx: c.x + 9, cy: lineY + 1, r: 9, color: "accent", opacity: 1 });
      }
      const px = variant === "steps" ? 22 : 0;
      const top = variant === "steps" ? box.y + 24 : lineY + 28;
      out.push(text(s.label, {
        x: c.x + px, y: top, w: c.w - px * 2, size: ts.subtitle, font: "display",
        weight: 700, color: "accent",
      }));
      out.push(text(s.value, {
        x: c.x + px, y: top + ts.subtitle * 1.3 + 8, w: c.w - px * 2, size: ts.body, maxLines: 4,
      }));
    });
    return out;
  }

  const step = Math.min(variant === "compact" ? 62 : 84, box.h / items.length);
  items.forEach((s, i) => {
    const y = box.y + i * step;
    const numW = 150;
    if (variant === "numbered") {
      out.push(text(String(i + 1).padStart(2, "0"), {
        x: box.x, y, w: 70, size: ts.stat, font: "display", weight: 800, color: "accent",
      }));
    } else {
      out.push({ kind: "circle", cx: box.x + 7, cy: y + ts.subtitle * 0.6, r: 7, color: "accent", opacity: 1 });
      if (i < items.length - 1) {
        out.push({ kind: "rect", x: box.x + 6, y: y + ts.subtitle, w: 2, h: step - ts.subtitle, radius: 2, color: "accent", opacity: 0.3 });
      }
    }
    const lx = variant === "numbered" ? box.x + 80 : box.x + 30;
    out.push(text(s.label, {
      x: lx, y, w: numW, size: ts.subtitle, font: "display", weight: 700,
    }));
    out.push(text(s.value, {
      x: lx + numW + 16, y: y + 2, w: box.w - (lx - box.x) - numW - 16, size: ts.body,
      color: "muted", maxLines: 2,
    }));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Команда                                                             */
/* ------------------------------------------------------------------ */

function teamSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts, slide } = a;
  const people = slide.content.specs.filter((s) => s.label || s.value);
  const photos = slidePhotos(slide);
  const h = header(a);
  const out = [...h.blocks];
  const box = area(h.y);
  if (!people.length) return out;

  const withPhoto = variant !== "minimal" && photos.length > 0;

  if (variant === "split") {
    const left: Rect = { x: box.x, y: box.y, w: box.w * 0.42, h: box.h };
    if (withPhoto) {
      out.push(photoBlock(slide, photos[0], 0, left, photos.length));
    }
    const rx = left.x + left.w + 40;
    const rw = box.x + box.w - rx;
    people.slice(0, 5).forEach((p, i) => {
      const y = box.y + i * Math.min(88, box.h / Math.min(people.length, 5));
      out.push(text(p.label, { x: rx, y, w: rw, size: ts.subtitle, font: "display", weight: 700 }));
      out.push(text(p.value, { x: rx, y: y + ts.subtitle * 1.25, w: rw, size: ts.body, color: "muted", maxLines: 1 }));
    });
    return out;
  }

  const perRow = variant === "grid4" ? 4 : 3;
  const list = people.slice(0, variant === "grid4" ? 8 : variant === "strip" ? 5 : 3);
  const rows = Math.ceil(list.length / perRow);
  const cardH = Math.min(variant === "strip" ? 230 : 300, (box.h - GAP * (rows - 1)) / rows);
  const cols = columns(box, Math.min(perRow, list.length));

  list.forEach((p, i) => {
    const c = cols[i % cols.length];
    const y = box.y + Math.floor(i / cols.length) * (cardH + GAP);
    const r: Rect = { x: c.x, y, w: c.w, h: cardH };
    const cardStyle = variant === "cards3" || variant === "grid4";
    if (cardStyle) out.push(panel(r));
    const pad = cardStyle ? 16 : 0;
    const photoH = withPhoto ? Math.min(cardH * 0.62, cardH - 90) : 0;
    if (withPhoto && photos[i]) {
      out.push(photoBlock(slide, photos[i], i, {
        x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: photoH,
      }, photos.length));
    }
    const ty = r.y + pad + (photoH ? photoH + 14 : 0);
    out.push(text(p.label, {
      x: r.x + pad, y: ty, w: r.w - pad * 2, size: ts.subtitle, font: "display", weight: 700, maxLines: 1,
    }));
    out.push(text(p.value, {
      x: r.x + pad, y: ty + ts.subtitle * 1.25, w: r.w - pad * 2, size: ts.body, color: "muted", maxLines: 2,
    }));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Сравнение                                                           */
/* ------------------------------------------------------------------ */

function compareSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts, slide } = a;
  const rows = slide.content.specs.filter((s) => s.label || s.value).slice(0, 7);
  const heads = slide.content.includes;
  const headA = heads[0] || "Вариант A";
  const headB = heads[1] || "Вариант B";
  const h = header(a);
  const out = [...h.blocks];
  const box = area(h.y);
  if (!rows.length) return out;

  const [left, right] = columns(box, 2, variant === "packages" ? GAP : 40);
  const accentRight = variant === "accent" || variant === "packages";
  const cardStyle = variant === "packages" || variant === "before-after";

  if (cardStyle) {
    out.push(panel(left, "panel"));
    out.push(panel(right, accentRight ? "accent" : "panel"));
  }
  const pad = cardStyle ? 26 : 0;
  const headY = box.y + pad;
  const inkR: SpecPaint = accentRight && cardStyle ? "onAccent" : "ink";
  const mutedR: SpecPaint = accentRight && cardStyle ? "onAccent" : "muted";

  out.push(text(headA, {
    x: left.x + pad, y: headY, w: left.w - pad * 2, size: ts.subtitle, font: "display",
    weight: 700, uppercase: variant === "checklist",
  }));
  out.push(text(headB, {
    x: right.x + pad, y: headY, w: right.w - pad * 2, size: ts.subtitle, font: "display",
    weight: 700, color: inkR, uppercase: variant === "checklist",
  }));

  if (!cardStyle) {
    out.push({ kind: "rect", x: left.x, y: headY + ts.subtitle * 1.35, w: left.w, h: 2, radius: 2, color: "muted", opacity: 0.3 });
    out.push({ kind: "rect", x: right.x, y: headY + ts.subtitle * 1.35, w: right.w, h: 2, radius: 2, color: accentRight ? "accent" : "muted", opacity: accentRight ? 1 : 0.3 });
  }

  let y = headY + ts.subtitle * 1.35 + 24;
  const step = Math.min(64, (box.h - (y - box.y) - pad) / rows.length);
  rows.forEach((r, i) => {
    const ry = y + i * step;
    const bullet = variant === "checklist" || variant === "packages" ? "— " : "";
    out.push(text(bullet + r.label, {
      x: left.x + pad, y: ry, w: left.w - pad * 2, size: ts.body, maxLines: 2,
    }));
    out.push(text(bullet + r.value, {
      x: right.x + pad, y: ry, w: right.w - pad * 2, size: ts.body,
      color: cardStyle ? mutedR : "ink", weight: accentRight && !cardStyle ? 600 : 400, maxLines: 2,
    }));
    if (variant === "checklist" && i < rows.length - 1) {
      out.push({ kind: "rect", x: box.x, y: ry + step - 10, w: box.w, h: 1, radius: 1, color: "muted", opacity: 0.2 });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Галерея                                                             */
/* ------------------------------------------------------------------ */

function photoBlock(
  slide: PresentationSlide,
  path: string,
  index: number,
  r: Rect,
  total: number,
  radius: number = GRID.radius,
): SpecImage {
  return {
    kind: "image",
    index,
    path,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    radius,
    fit: slide.content.photoFit ?? "cover",
    anchor: slide.content.photoAnchor ?? "center",
    alt: photoAlt({ slideTitle: slide.title, context: slide.subtitle, index, total }),
  };
}

function gallerySpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { slide, ts } = a;
  const photos = slidePhotos(slide);
  if (!photos.length) return header(a).blocks;

  if (variant === "fullbleed") {
    const frames = photoFrames({ x: 0, y: 0, w: SLIDE_W, h: SLIDE_H }, photos.length, {
      aspects: [], gap: photos.length > 1 ? 6 : 0,
    });
    const out: SpecBlock[] = frames.map((f, i) => photoBlock(slide, photos[i], i, f, photos.length, 0));
    out.push({ kind: "shade", from: FULL_BLEED_SHADE.from, alpha: FULL_BLEED_SHADE.alpha });
    out.push(text(slide.title, {
      id: "title", x: PAD_X, y: SLIDE_H - 150, w: CONTENT_W, size: ts.titleSection,
      font: "display", weight: 800, color: "onPhoto", placeholder: "Заголовок",
    }));
    if (slide.subtitle.trim()) {
      out.push(text(slide.subtitle, {
        id: "subtitle", x: PAD_X, y: SLIDE_H - 150 + ts.titleSection * 1.2, w: CONTENT_W,
        size: ts.subtitle, color: "onPhotoMuted",
      }));
    }
    return out;
  }

  const h = header(a, { rule: variant === "captions" });
  const out = [...h.blocks];
  const box = area(h.y);
  const frames = photoFrames(box, photos.length, { aspects: [], gap: 14 });
  frames.forEach((f, i) => {
    const capH = variant === "captions" ? ts.caption * 1.4 + 8 : 0;
    const r: Rect = { ...f, h: Math.max(40, f.h - capH) };
    out.push(photoBlock(slide, photos[i], i, r, photos.length));
    if (capH) {
      out.push(text(
        photoAlt({ slideTitle: slide.title, context: slide.subtitle, index: i, total: photos.length }),
        { x: r.x, y: r.y + r.h + 6, w: r.w, size: ts.caption, color: "muted", maxLines: 1 },
      ));
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Отзыв / цитата                                                      */
/* ------------------------------------------------------------------ */

function quoteSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { slide, ts } = a;
  const quote = slide.content.description.trim();
  const author = slide.subtitle.trim();
  const photos = slidePhotos(slide);
  const out: SpecBlock[] = [];

  const big = variant === "big";
  const size = big ? Math.round(ts.titleSection * 0.9) : ts.titleSlide * 0.82;
  let x = PAD_X;
  let w = CONTENT_W;
  let y = PAD_TOP + 40;

  if (variant === "side-photo" && photos.length) {
    const pw = 420;
    out.push(photoBlock(slide, photos[0], 0, { x: PAD_X, y: PAD_TOP, w: pw, h: BOTTOM - PAD_TOP }, photos.length));
    x = PAD_X + pw + 48;
    w = SLIDE_W - x - PAD_X;
  }

  if (variant === "card") {
    const card: Rect = { x: PAD_X, y: PAD_TOP + 20, w: CONTENT_W, h: BOTTOM - PAD_TOP - 60 };
    out.push(panel(card));
    x = card.x + 48;
    w = card.w - 96;
    y = card.y + 48;
  }

  const align = variant === "center" || variant === "minimal" ? "center" : "left";
  if (variant !== "minimal") {
    out.push(text("“", {
      x, y: y - 20, w, size: size * 2, lineHeight: 1, font: "display", weight: 800,
      color: "accent", align,
    }));
    y += size * 0.9;
  }

  const qh = heightOf(quote || "Текст отзыва", size, w, 1.25, "display");
  if (variant === "center" || variant === "big") {
    y = Math.max(y, PAD_TOP + (BOTTOM - PAD_TOP - qh) / 2 - 20);
  }
  out.push(text(quote, {
    id: "body", x, y, w, size, lineHeight: 1.25, font: "display", weight: big ? 800 : 600,
    align, placeholder: "Текст отзыва клиента",
  }));
  y += qh + 28;

  if (author) {
    out.push(text(slide.title, {
      id: "title", x, y, w, size: ts.subtitle, font: "display", weight: 700, align,
      placeholder: "Заголовок",
    }));
    out.push(text(author, {
      id: "subtitle", x, y: y + ts.subtitle * 1.3 + 4, w, size: ts.body, color: "muted", align,
      placeholder: "Имя, компания",
    }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Смета                                                               */
/* ------------------------------------------------------------------ */

function estimateSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts, slide } = a;
  const rows = slide.content.specs.filter((s) => s.label || s.value)
    .slice(0, variant === "compact" ? 10 : 7);
  const h = header(a);
  const out = [...h.blocks];
  const box = area(h.y);
  if (!rows.length) return out;

  const total = slide.content.price;
  const totalLabel = total != null && total > 0
    ? `${new Intl.NumberFormat("ru-BY", { maximumFractionDigits: 2 }).format(total)} BYN`
    : "";

  if (variant === "cards") {
    const perRow = rows.length > 4 ? 3 : 2;
    const count = Math.ceil(rows.length / perRow);
    const cardH = Math.min(160, (box.h - GAP * (count - 1)) / count);
    rows.forEach((r, i) => {
      const c = columns(box, perRow)[i % perRow];
      const y = box.y + Math.floor(i / perRow) * (cardH + GAP);
      out.push(panel({ x: c.x, y, w: c.w, h: cardH }));
      out.push(text(r.label, {
        x: c.x + 22, y: y + 20, w: c.w - 44, size: ts.body, weight: 600, maxLines: 2,
      }));
      out.push(text(r.value, {
        x: c.x + 22, y: y + cardH - 22 - ts.subtitle, w: c.w - 44, size: ts.subtitle,
        font: "display", weight: 800, color: "accent",
      }));
    });
    return out;
  }

  const listW = variant === "split" ? box.w * 0.62 : box.w;
  const step = Math.min(variant === "compact" ? 48 : 60, (box.h - 90) / rows.length);
  rows.forEach((r, i) => {
    const y = box.y + i * step;
    out.push(text(r.label, { x: box.x, y, w: listW * 0.68, size: ts.body, maxLines: 1 }));
    out.push(text(r.value, {
      x: box.x + listW * 0.68, y, w: listW * 0.32, size: ts.body, weight: 600, align: "right",
    }));
    out.push({
      kind: "rect", x: box.x, y: y + step - 12, w: listW, h: 1, radius: 1, color: "muted", opacity: 0.2,
    });
  });

  if (totalLabel && variant !== "compact") {
    if (variant === "split") {
      const r: Rect = { x: box.x + listW + 32, y: box.y, w: box.w - listW - 32, h: 190 };
      out.push(panel(r, "accent"));
      out.push(text("Итого", {
        x: r.x + 26, y: r.y + 28, w: r.w - 52, size: ts.label, color: "onAccent",
        uppercase: true, letterSpacing: 1,
      }));
      out.push(text(totalLabel, {
        x: r.x + 26, y: r.y + 28 + ts.label * 1.4 + 8, w: r.w - 52, size: ts.stat,
        font: "display", weight: 800, color: "onAccent", lineHeight: 1.1,
      }));
    } else {
      const y = box.y + rows.length * step + 18;
      const pillW = Math.max(300, measureText(totalLabel, ts.stat, "display") + 180);
      out.push({
        kind: "rect", x: box.x + listW - pillW, y, w: pillW, h: ts.stat * 1.7,
        radius: 14, color: variant === "total" ? "accent" : "panel",
      });
      const ink: SpecPaint = variant === "total" ? "onAccent" : "ink";
      out.push(text("Итого", {
        x: box.x + listW - pillW + 24, y: y + ts.stat * 0.5, w: 160, size: ts.body, color: ink,
      }));
      out.push(text(totalLabel, {
        x: box.x + listW - pillW + 24, y: y + ts.stat * 0.3, w: pillW - 48, size: ts.stat,
        font: "display", weight: 800, color: ink, align: "right",
      }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Логотипы партнёров                                                  */
/* ------------------------------------------------------------------ */

function logosSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { slide } = a;
  const photos = slidePhotos(slide);
  const h = header(a, { align: variant === "minimal" ? "center" : "left", rule: variant !== "minimal" });
  const out = [...h.blocks];
  const box = area(h.y);
  if (!photos.length) return out;

  const perRow = variant === "strip" ? Math.min(photos.length, 6)
    : variant === "rows" ? 6
      : variant === "cards" ? 4 : 5;
  const list = photos.slice(0, variant === "strip" ? 6 : 12);
  const rowsCount = Math.ceil(list.length / perRow);
  const cellW = (box.w - GAP * (perRow - 1)) / perRow;
  const cellH = Math.min(variant === "strip" ? 140 : 150, (box.h - GAP * (rowsCount - 1)) / rowsCount);

  list.forEach((p, i) => {
    const r: Rect = {
      x: box.x + (i % perRow) * (cellW + GAP),
      y: box.y + Math.floor(i / perRow) * (cellH + GAP),
      w: cellW,
      h: cellH,
    };
    if (variant === "cards") out.push(panel(r));
    const pad = variant === "cards" ? 18 : 8;
    out.push({
      ...photoBlock(slide, p, i, { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 }, list.length, 0),
      fit: "contain",
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Призыв к действию                                                   */
/* ------------------------------------------------------------------ */

function ctaSpec(a: LayoutSpecInput, variant: string): SpecBlock[] {
  const { ts, slide } = a;
  const steps = slide.content.includes.filter(Boolean).slice(0, 4);
  const out: SpecBlock[] = [];
  const center = variant === "center" || variant === "band";
  const titleSize = variant === "center" ? ts.titleHero * 0.85 : ts.titleSection;

  if (variant === "band") {
    out.push({
      kind: "rect", x: 0, y: SLIDE_H * 0.62, w: SLIDE_W, h: SLIDE_H * 0.38, radius: 0, color: "accent",
    });
  }
  if (variant === "card") {
    out.push(panel({ x: PAD_X, y: PAD_TOP, w: CONTENT_W, h: BOTTOM - PAD_TOP }));
  }

  const x = variant === "card" ? PAD_X + 48 : PAD_X;
  const w = variant === "card" ? CONTENT_W - 96 : variant === "split" ? CONTENT_W * 0.52 : CONTENT_W;
  const titleH = heightOf(slide.title || "Готовы начать?", titleSize, w, 1.1, "display");
  let y = variant === "band" ? PAD_TOP + 40
    : PAD_TOP + Math.max(0, (BOTTOM - PAD_TOP - titleH - 160) / 2);

  out.push(text(slide.title, {
    id: "title", x, y, w, size: titleSize, lineHeight: 1.1, font: "display", weight: 800,
    align: center ? "center" : "left", placeholder: "Призыв к действию",
  }));
  y += titleH + 16;

  if (slide.subtitle.trim()) {
    out.push(text(slide.subtitle, {
      id: "subtitle", x, y, w, size: ts.subtitle, color: "muted",
      align: center ? "center" : "left", placeholder: "Пояснение",
    }));
    y += heightOf(slide.subtitle, ts.subtitle, w, 1.3) + 28;
  }

  if (steps.length) {
    if (variant === "split" || variant === "steps") {
      const sx = variant === "split" ? PAD_X + CONTENT_W * 0.56 : PAD_X;
      const sw = variant === "split" ? CONTENT_W * 0.44 : CONTENT_W;
      const sy = variant === "split" ? PAD_TOP + 40 : y;
      if (variant === "steps") {
        const cols = columns({ x: sx, y: sy, w: sw, h: 160 }, steps.length);
        steps.forEach((s, i) => {
          out.push(panel({ ...cols[i], h: 150 }));
          out.push(text(String(i + 1).padStart(2, "0"), {
            x: cols[i].x + 20, y: sy + 20, w: cols[i].w - 40, size: ts.label, weight: 700, color: "accent",
          }));
          out.push(text(s, {
            x: cols[i].x + 20, y: sy + 20 + ts.label * 1.4 + 8, w: cols[i].w - 40,
            size: ts.body, weight: 500, maxLines: 3,
          }));
        });
      } else {
        steps.forEach((s, i) => {
          const iy = sy + i * 64;
          out.push({ kind: "circle", cx: sx + 8, cy: iy + ts.body * 0.6, r: 8, color: "accent", opacity: 1 });
          out.push(text(s, { x: sx + 30, y: iy, w: sw - 30, size: ts.body, maxLines: 2 }));
        });
      }
    } else {
      const joined = steps.join("    ·    ");
      out.push(text(joined, {
        x, y, w, size: ts.body, color: variant === "band" ? "onAccent" : "muted",
        align: center ? "center" : "left", maxLines: 2,
      }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Диспетчер                                                           */
/* ------------------------------------------------------------------ */

const BUILDERS: Record<LayoutSlideType, (a: LayoutSpecInput, v: string) => SpecBlock[]> = {
  agenda: agendaSpec,
  stats: statsSpec,
  timeline: timelineSpec,
  team: teamSpec,
  compare: compareSpec,
  gallery: gallerySpec,
  quote: quoteSpec,
  estimate: estimateSpec,
  logos: logosSpec,
  cta: ctaSpec,
};

/** Блоки структурного слайда с учётом выбранного варианта оформления. */
export function layoutSlideSpec(a: LayoutSpecInput): SpecBlock[] {
  const type = a.slide.type;
  if (!isLayoutSlideType(type)) return [];
  const variant = slideVariantId(type, a.slide.content.variant);
  const blocks = BUILDERS[type](a, variant);
  const onPhoto = type === "gallery" && variant === "fullbleed";
  blocks.push(...footerSpec({
    ts: a.ts.caption,
    brandName: a.footerLogo ? "" : a.brandName,
    index: a.index,
    total: a.total,
    color: onPhoto ? "onPhotoMuted" : "muted",
  }));
  return blocks;
}
