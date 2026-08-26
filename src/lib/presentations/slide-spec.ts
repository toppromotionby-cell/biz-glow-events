// Единый «сценарий слайда»: геометрия статичных типов слайда (титул, раздел,
// контакты), футера и затемнения под фото — в координатах холста 1280×720.
// Один и тот же спек рисуют превью (SlideCanvas) и PDF (pdf.server), поэтому
// документ выглядит одинаково на экране и в файле.
import type { PhotoAnchor, PhotoFit } from "@/lib/presentations/photo-fit";
import { GRID, SLIDE_H, SLIDE_W, type SlideLayout, type TypeScale } from "@/lib/presentations/design";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import { photoAlt } from "@/lib/presentations/captions";
import { variantPlan } from "@/lib/presentations/variant-layout";
import {
  DEFAULT_LAYOUT_OVERRIDES, partTextScale, type PresentationSlide,
} from "@/lib/presentations/model";

export type SpecColor = "ink" | "muted" | "accent" | "onAccent";

/** Все цвета, которыми может быть окрашен блок спека. */
export type SpecPaint = SpecColor | "panel" | "onPhoto" | "onPhotoMuted";

/** Идентификаторы редактируемых частей слайда. */
export type SpecTextId = "title" | "subtitle" | "body";

export type SpecText = {
  kind: "text";
  /** Идентификатор блока для инлайн-редактирования в превью. */
  id?: SpecTextId;
  x: number;
  y: number;
  w: number;
  size: number;
  lineHeight: number;
  font: "display" | "body";
  weight: number;
  color: SpecPaint;
  text: string;
  placeholder?: string;
  align: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacing?: number;
  /** Заранее посчитанные строки (если заданы — рендерим их как есть). */
  lines?: string[];
};

export type SpecRect = {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  color: SpecPaint;
  opacity?: number;
};

export type SpecCircle = {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
  color: SpecColor;
  opacity: number;
};

/** Фотография слайда: путь в хранилище + индекс кадра (для PDF). */
export type SpecImage = {
  kind: "image";
  index: number;
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  /** Правило кадрирования — одинаковое в превью и PDF. */
  fit: PhotoFit;
  anchor: PhotoAnchor;
  /** Автоподпись/alt-текст для доступности и юзабилити. */
  alt: string;
};

/** Затемнение снизу под текстом (фото на весь слайд). */
export type SpecShade = { kind: "shade"; from: number; alpha: number };

/** Место под логотип компании в потоке контента (титульный слайд). */
export type SpecLogo = { kind: "logo"; x: number; y: number; w: number; h: number };

export type SpecBlock = SpecText | SpecRect | SpecCircle | SpecLogo | SpecImage | SpecShade;

/** Средняя ширина символа относительно кегля (как в fit.ts). */
const CHAR_W = 0.52;

export function estimateLines(text: string, size: number, width: number): number {
  if (!text.trim()) return 0;
  const perLine = Math.max(6, Math.floor(width / (size * CHAR_W)));
  return text
    .split("\n")
    .reduce((sum, para) => sum + Math.max(1, Math.ceil(para.length / perLine)), 0);
}

const textH = (t: string, size: number, w: number, lh: number): number =>
  Math.max(1, estimateLines(t, size, w)) * size * lh;

export const SPEC = {
  padX: GRID.marginX + 24,
  padTop: GRID.marginTop + 24,
  padBottom: GRID.marginBottom,
  footerBottom: 28,
  ruleRadius: 4,
  contactsMaxW: 900,
  contactCardGap: 20,
  contactCardPadX: 24,
  contactCardPadY: 20,
} as const;

/** Контактные строки компании (одинаковый порядок в превью и в PDF). */
export function contactRows(company: CompanyProfile | null): { label: string; value: string }[] {
  return [
    { label: "Телефон", value: company?.company_phone ?? "" },
    { label: "E-mail", value: company?.company_email ?? "" },
    { label: "Сайт", value: company?.company_website ?? "" },
    { label: "Адрес", value: company?.company_address ?? "" },
  ].filter((r) => r.value.trim());
}

/** Строки-«чипы» на титульном слайде. */
export function titleChips(company: CompanyProfile | null): string[] {
  return [
    company?.company_website,
    company?.company_phone,
    company?.company_email,
    company?.company_address,
  ].filter((v): v is string => !!v && !!v.trim());
}

export type StaticSpecInput = {
  slide: PresentationSlide;
  ts: TypeScale;
  company: CompanyProfile | null;
  presentationTitle: string;
  brandName: string;
  /** Габариты логотипа компании, если он рисуется в контенте (слот hero). */
  heroLogo: { w: number; h: number } | null;
  /** Дата на титульном слайде (уже отформатированная). */
  dateLabel: string;
  /** Раскладка слайда: фото и текстовая колонка варианта оформления. */
  layout?: SlideLayout;
};

type Stack = { blocks: SpecBlock[]; height: number };

/** Кегли заголовка и подзаголовка статичного слайда с учётом ручного масштаба. */
function partSizesOf(slide: PresentationSlide, title: number, subtitle: number) {
  const ov = slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES;
  return {
    title: title * partTextScale(ov.titleScale),
    subtitle: subtitle * partTextScale(ov.subtitleScale),
  };
}

/** Общая для всех статичных слайдов «сцена»: фото варианта, текстовая колонка, цвета. */
type Scene = {
  photos: SpecBlock[];
  box: { x: number; y: number; w: number; h: number };
  ink: SpecPaint;
  muted: SpecPaint;
  isFull: boolean;
  align: "left" | "center" | "right";
};

function scene(a: StaticSpecInput): Scene {
  const vp = variantPlan(a.slide.type, a.slide.content.variant);
  const l = a.layout;
  const photos: SpecBlock[] = [];
  const c = a.slide.content;

  if (l && l.photos.length) {
    l.frames.forEach((f, i) => {
      const path = l.photos[i];
      if (!path) return;
      const fullEdge = f.x === 0 || f.w >= SLIDE_W;
      photos.push({
        kind: "image", index: i, path, x: f.x, y: f.y, w: f.w, h: f.h,
        radius: fullEdge ? 0 : GRID.radius,
        fit: c.photoFit ?? "cover",
        anchor: c.photoAnchor ?? "center",
        alt: photoAlt({
          slideTitle: a.slide.title,
          context: a.slide.subtitle,
          index: i,
          total: l.photos.length,
        }),
      });
    });
  }

  const isFull = !!photos.length && l?.placement === "full";
  if (isFull) photos.push({ kind: "shade", from: FULL_BLEED_SHADE.from, alpha: FULL_BLEED_SHADE.alpha });

  const defaultBox = {
    x: SPEC.padX,
    y: SPEC.padTop,
    w: SLIDE_W - SPEC.padX * 2,
    h: SLIDE_H - SPEC.padTop - SPEC.padBottom,
  };
  const box = photos.length && l ? { ...l.textBox } : defaultBox;
  const align = l ? l.textAlignX : vp.alignX;
  return {
    photos,
    box,
    ink: isFull ? "onPhoto" : "ink",
    muted: isFull ? "onPhotoMuted" : "muted",
    isFull,
    align,
  };
}

/** Вертикально центрирует набор блоков в текстовой области сцены. */
function centerIn(stack: Stack, box: Scene["box"]): SpecBlock[] {
  const dy = Math.max(0, (box.h - stack.height) / 2);
  return stack.blocks.map((b) =>
    b.kind === "circle" || b.kind === "shade" || b.kind === "image"
      ? b
      : { ...b, y: b.y + box.y + dy },
  );
}

/** Смещение блока ширины `w` внутри колонки по выравниванию сцены. */
const dx = (align: Scene["align"], boxW: number, w: number): number =>
  align === "center" ? Math.max(0, (boxW - w) / 2) : align === "right" ? Math.max(0, boxW - w) : 0;

/** Титульный слайд. */
function titleSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const vp = variantPlan("title", a.slide.content.variant);
  const s = scene(a);
  const x = s.box.x;
  const w = s.box.w;
  const blocks: SpecBlock[] = [];
  let y = 0;

  if (a.heroLogo) {
    blocks.push({ kind: "logo", x: x + dx(s.align, w, a.heroLogo.w), y, w: a.heroLogo.w, h: a.heroLogo.h });
    y += a.heroLogo.h;
  } else if (a.brandName) {
    blocks.push({
      kind: "text", x, y, w, size: 30, lineHeight: 1.2, font: "display",
      weight: 700, color: s.ink, text: a.brandName, align: s.align,
    });
    y += 30 * 1.2;
  }

  const title = a.slide.title || a.presentationTitle;
  const sz = partSizesOf(a.slide, ts.titleHero * vp.titleBoost, ts.subtitle);
  const titleW = Math.min(900, w);
  y += 40;
  blocks.push({
    kind: "text", id: "title", x: x + dx(s.align, w, titleW), y, w: titleW, size: sz.title,
    lineHeight: 1.05, font: "display", weight: 800, color: s.ink, text: title,
    placeholder: "Название презентации", align: s.align,
  });
  y += textH(title, sz.title, titleW, 1.05);

  if (a.slide.subtitle.trim()) {
    const subW = Math.min(820, w);
    y += 20;
    blocks.push({
      kind: "text", id: "subtitle", x: x + dx(s.align, w, subW), y, w: subW, size: sz.subtitle,
      lineHeight: 1.3, font: "body", weight: 400, color: s.muted, text: a.slide.subtitle,
      placeholder: "Подзаголовок или слоган", align: s.align,
    });
    y += textH(a.slide.subtitle, sz.subtitle, subW, 1.3);
  }

  y += 40;
  blocks.push({
    kind: "rect", x: x + dx(s.align, w, 120), y, w: 120, h: 4,
    radius: SPEC.ruleRadius, color: "accent",
  });
  y += 4;

  const chips = titleChips(a.company);
  if (chips.length) {
    y += 30;
    const text = chips.join("    ·    ");
    blocks.push({
      kind: "text", x, y, w, size: ts.chip, lineHeight: 1.4, font: "body",
      weight: 400, color: s.muted, text, align: s.align,
    });
    y += textH(text, ts.chip, w, 1.4);
  }

  if (a.dateLabel) {
    y += 20;
    blocks.push({
      kind: "text", x, y, w, size: ts.caption, lineHeight: 1.3, font: "body",
      weight: 400, color: s.muted, text: a.dateLabel, align: s.align,
    });
    y += ts.caption * 1.3;
  }

  const out = [...s.photos, ...centerIn({ blocks, height: y }, s.box)];
  // Декоративный круг уместен только в «спокойных» вариантах без фото.
  if (vp.decor && !s.photos.length) {
    out.push({ kind: "circle", cx: SLIDE_W - 100, cy: 100, r: 260, color: "accent", opacity: 0.12 });
  }
  return out;
}

/** Слайд-раздел. */
function sectionSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const vp = variantPlan("section", a.slide.content.variant);
  const s = scene(a);
  const x = s.box.x;
  const w = s.box.w;
  const blocks: SpecBlock[] = [];
  let y = 0;

  const sz = partSizesOf(a.slide, ts.titleSection * vp.titleBoost, ts.subtitle);

  if (vp.numbered) {
    // Крупный номер главы вместо акцентной линии.
    const num = String((a.slide.position ?? 0) + 1).padStart(2, "0");
    const size = sz.title * 1.6;
    blocks.push({
      kind: "text", x: x + dx(s.align, w, w), y, w, size, lineHeight: 1,
      font: "display", weight: 800, color: "accent", text: num, align: s.align, lines: [num],
    });
    y += size + 18;
  } else if (vp.band) {
    blocks.push({ kind: "rect", x, y, w, h: 10, radius: 5, color: "accent" });
    y += 10 + 28;
  } else if (!vp.decor || s.align === "center") {
    y += 0;
  } else {
    blocks.push({
      kind: "rect", x: x + dx(s.align, w, 88), y, w: 88, h: 4,
      radius: SPEC.ruleRadius, color: "accent",
    });
    y += 4 + 26;
  }

  blocks.push({
    kind: "text", id: "title", x, y, w, size: sz.title, lineHeight: 1.14,
    font: "display", weight: 800, color: s.ink, text: a.slide.title,
    placeholder: "Название раздела", align: s.align,
  });
  y += textH(a.slide.title, sz.title, w, 1.14);

  if (a.slide.subtitle.trim()) {
    const subW = Math.min(860, w);
    y += 16;
    blocks.push({
      kind: "text", id: "subtitle", x: x + dx(s.align, w, subW), y, w: subW, size: sz.subtitle,
      lineHeight: 1.3, font: "body", weight: 400, color: s.muted, text: a.slide.subtitle,
      placeholder: "Короткое пояснение", align: s.align,
    });
    y += textH(a.slide.subtitle, sz.subtitle, subW, 1.3);
  }

  return [...s.photos, ...centerIn({ blocks, height: y }, s.box)];
}

/** Слайд «Контакты»: заголовок и контакты в раскладке варианта. */
function contactsSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const vp = variantPlan("contacts", a.slide.content.variant);
  const s = scene(a);
  const x = s.box.x;
  const w = s.box.w;
  const blocks: SpecBlock[] = [];
  let y = 0;

  const sz = partSizesOf(a.slide, ts.titleSection, ts.subtitle);

  if (vp.band) {
    blocks.push({ kind: "rect", x, y, w, h: 10, radius: 5, color: "accent" });
    y += 10 + 26;
  }

  blocks.push({
    kind: "text", id: "title", x, y, w, size: sz.title, lineHeight: 1.14,
    font: "display", weight: 800, color: s.ink, text: a.slide.title,
    placeholder: "Свяжитесь с нами", align: s.align,
  });
  y += textH(a.slide.title, sz.title, w, 1.14);

  if (a.slide.subtitle.trim()) {
    y += 14;
    blocks.push({
      kind: "text", id: "subtitle", x, y, w, size: sz.subtitle, lineHeight: 1.3,
      font: "body", weight: 400, color: s.muted, text: a.slide.subtitle,
      placeholder: "Подзаголовок", align: s.align,
    });
    y += textH(a.slide.subtitle, sz.subtitle, w, 1.3);
  }

  const rows = contactRows(a.company);
  if (rows.length) {
    y += 40;
    const mode = vp.contacts;

    if (mode === "center" || mode === "band") {
      // Без плашек: контакты крупной строкой одна под другой.
      for (const r of rows) {
        blocks.push({
          kind: "text", x, y, w, size: ts.label, lineHeight: 1.3, font: "body",
          weight: 400, color: s.muted, text: r.label, align: s.align,
          uppercase: true, letterSpacing: 1, lines: [r.label],
        });
        y += ts.label * 1.3 + 4;
        blocks.push({
          kind: "text", x, y, w, size: sz.subtitle, lineHeight: 1.3, font: "body",
          weight: 600, color: s.ink, text: r.value, align: s.align,
        });
        y += textH(r.value, sz.subtitle, w, 1.3) + 18;
      }
      y -= 18;
    } else {
      const cols = mode === "columns" ? 3 : mode === "split" ? 1 : 2;
      const gridW = mode === "split" ? Math.min(520, w) : Math.min(SPEC.contactsMaxW, w);
      const gx = x + dx(s.align, w, gridW);
      const cardW = (gridW - SPEC.contactCardGap * (cols - 1)) / cols;
      const innerW = cardW - SPEC.contactCardPadX * 2;
      const valueH = Math.max(
        ...rows.map((r) => textH(r.value, ts.subtitle, innerW, 1.3)),
        ts.subtitle * 1.3,
      );
      const cardH = SPEC.contactCardPadY * 2 + ts.label * 1.3 + 6 + valueH;
      rows.forEach((r, i) => {
        const cx = gx + (i % cols) * (cardW + SPEC.contactCardGap);
        const cy = y + Math.floor(i / cols) * (cardH + SPEC.contactCardGap);
        blocks.push({
          kind: "rect", x: cx, y: cy, w: cardW, h: cardH, radius: GRID.radius, color: "panel",
        });
        blocks.push({
          kind: "text", x: cx + SPEC.contactCardPadX, y: cy + SPEC.contactCardPadY,
          w: innerW, size: ts.label, lineHeight: 1.3, font: "body", weight: 400,
          color: "muted", text: r.label, align: "left", uppercase: true, letterSpacing: 1,
        });
        blocks.push({
          kind: "text", x: cx + SPEC.contactCardPadX,
          y: cy + SPEC.contactCardPadY + ts.label * 1.3 + 6,
          w: innerW, size: ts.subtitle, lineHeight: 1.3, font: "body", weight: 600,
          color: "ink", text: r.value, align: "left",
        });
      });
      y += Math.ceil(rows.length / cols) * (cardH + SPEC.contactCardGap) - SPEC.contactCardGap;
    }
  }

  return [...s.photos, ...centerIn({ blocks, height: y }, s.box)];
}

/** Блоки статичного слайда (титул / раздел / контакты). */
export function staticSlideSpec(a: StaticSpecInput): SpecBlock[] {
  if (a.slide.type === "title") return titleSpec(a);
  if (a.slide.type === "section") return sectionSpec(a);
  return contactsSpec(a);
}

/** Затемнение под текстом для фото на весь слайд. */
export const FULL_BLEED_SHADE = { from: 0.45, alpha: 0.72 } as const;
