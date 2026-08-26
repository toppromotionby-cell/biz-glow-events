// Единый «сценарий слайда»: геометрия статичных типов слайда (титул, раздел,
// контакты), футера и затемнения под фото — в координатах холста 1280×720.
// Один и тот же спек рисуют превью (SlideCanvas) и PDF (pdf.server), поэтому
// документ выглядит одинаково на экране и в файле.
import type { PhotoAnchor, PhotoFit } from "@/lib/presentations/photo-fit";
import { GRID, SLIDE_H, SLIDE_W, type TypeScale } from "@/lib/presentations/design";
import type { CompanyProfile } from "@/lib/documents/company-profile";
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

/** Вертикально центрирует набор блоков в области контента. */
function center(stack: Stack): SpecBlock[] {
  const top = SPEC.padTop;
  const areaH = SLIDE_H - SPEC.padTop - SPEC.padBottom;
  const dy = Math.max(0, (areaH - stack.height) / 2);
  return stack.blocks.map((b) =>
    b.kind === "circle" || b.kind === "shade" ? b : { ...b, y: b.y + top + dy },
  );
}

/** Титульный слайд. */
function titleSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const x = SPEC.padX;
  const w = SLIDE_W - SPEC.padX * 2;
  const blocks: SpecBlock[] = [];
  let y = 0;

  if (a.heroLogo) {
    blocks.push({ kind: "logo", x, y, w: a.heroLogo.w, h: a.heroLogo.h });
    y += a.heroLogo.h;
  } else if (a.brandName) {
    blocks.push({
      kind: "text", x, y, w, size: 30, lineHeight: 1.2, font: "display",
      weight: 700, color: "ink", text: a.brandName, align: "left",
    });
    y += 30 * 1.2;
  }

  const title = a.slide.title || a.presentationTitle;
  const sz = partSizesOf(a.slide, ts.titleHero, ts.subtitle);
  const titleW = Math.min(900, w);
  y += 40;
  blocks.push({
    kind: "text", id: "title", x, y, w: titleW, size: sz.title, lineHeight: 1.05,
    font: "display", weight: 800, color: "ink", text: title,
    placeholder: "Название презентации", align: "left",
  });
  y += textH(title, sz.title, titleW, 1.05);

  if (a.slide.subtitle.trim()) {
    const subW = Math.min(820, w);
    y += 20;
    blocks.push({
      kind: "text", id: "subtitle", x, y, w: subW, size: sz.subtitle, lineHeight: 1.3,
      font: "body", weight: 400, color: "muted", text: a.slide.subtitle,
      placeholder: "Подзаголовок или слоган", align: "left",
    });
    y += textH(a.slide.subtitle, sz.subtitle, subW, 1.3);
  }

  y += 40;
  blocks.push({ kind: "rect", x, y, w: 120, h: 4, radius: SPEC.ruleRadius, color: "accent" });
  y += 4;

  const chips = titleChips(a.company);
  if (chips.length) {
    y += 30;
    blocks.push({
      kind: "text", x, y, w, size: ts.chip, lineHeight: 1.4, font: "body",
      weight: 400, color: "muted", text: chips.join("    ·    "), align: "left",
    });
    y += textH(chips.join("    ·    "), ts.chip, w, 1.4);
  }

  if (a.dateLabel) {
    y += 20;
    blocks.push({
      kind: "text", x, y, w, size: ts.caption, lineHeight: 1.3, font: "body",
      weight: 400, color: "muted", text: a.dateLabel, align: "left",
    });
    y += ts.caption * 1.3;
  }

  const out = center({ blocks, height: y });
  // Декоративный круг в правом верхнем углу (позиция фиксированная).
  out.push({ kind: "circle", cx: SLIDE_W - 100, cy: 100, r: 260, color: "accent", opacity: 0.12 });
  return out;
}

/** Слайд-раздел. */
function sectionSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const x = SPEC.padX;
  const w = SLIDE_W - SPEC.padX * 2;
  const blocks: SpecBlock[] = [];
  let y = 0;

  const sz = partSizesOf(a.slide, ts.titleSection, ts.subtitle);
  blocks.push({ kind: "rect", x, y, w: 88, h: 4, radius: SPEC.ruleRadius, color: "accent" });
  y += 4 + 26;

  blocks.push({
    kind: "text", id: "title", x, y, w, size: sz.title, lineHeight: 1.14,
    font: "display", weight: 800, color: "ink", text: a.slide.title,
    placeholder: "Название раздела", align: "left",
  });
  y += textH(a.slide.title, sz.title, w, 1.14);

  if (a.slide.subtitle.trim()) {
    const subW = Math.min(860, w);
    y += 16;
    blocks.push({
      kind: "text", id: "subtitle", x, y, w: subW, size: sz.subtitle, lineHeight: 1.3,
      font: "body", weight: 400, color: "muted", text: a.slide.subtitle,
      placeholder: "Короткое пояснение", align: "left",
    });
    y += textH(a.slide.subtitle, sz.subtitle, subW, 1.3);
  }

  return center({ blocks, height: y });
}

/** Слайд «Контакты»: заголовок + карточки 2×2. */
function contactsSpec(a: StaticSpecInput): SpecBlock[] {
  const { ts } = a;
  const x = SPEC.padX;
  const w = SLIDE_W - SPEC.padX * 2;
  const blocks: SpecBlock[] = [];
  let y = 0;

  const sz = partSizesOf(a.slide, ts.titleSection, ts.subtitle);
  blocks.push({
    kind: "text", id: "title", x, y, w, size: sz.title, lineHeight: 1.14,
    font: "display", weight: 800, color: "ink", text: a.slide.title,
    placeholder: "Свяжитесь с нами", align: "left",
  });
  y += textH(a.slide.title, sz.title, w, 1.14);

  if (a.slide.subtitle.trim()) {
    y += 14;
    blocks.push({
      kind: "text", id: "subtitle", x, y, w, size: sz.subtitle, lineHeight: 1.3,
      font: "body", weight: 400, color: "muted", text: a.slide.subtitle,
      placeholder: "Подзаголовок", align: "left",
    });
    y += textH(a.slide.subtitle, sz.subtitle, w, 1.3);
  }

  const rows = contactRows(a.company);
  if (rows.length) {
    y += 40;
    const gridW = Math.min(SPEC.contactsMaxW, w);
    const cardW = (gridW - SPEC.contactCardGap) / 2;
    const innerW = cardW - SPEC.contactCardPadX * 2;
    // Значение может занять несколько строк (например длинный адрес) —
    // высота карточек единая и рассчитывается по самому длинному значению.
    const valueH = Math.max(
      ...rows.map((r) => textH(r.value, ts.subtitle, innerW, 1.3)),
      ts.subtitle * 1.3,
    );
    const cardH = SPEC.contactCardPadY * 2 + ts.label * 1.3 + 6 + valueH;
    rows.forEach((r, i) => {
      const cx = x + (i % 2) * (cardW + SPEC.contactCardGap);
      const cy = y + Math.floor(i / 2) * (cardH + SPEC.contactCardGap);
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
    y += Math.ceil(rows.length / 2) * (cardH + SPEC.contactCardGap) - SPEC.contactCardGap;
  }

  return center({ blocks, height: y });
}

/** Блоки статичного слайда (титул / раздел / контакты). */
export function staticSlideSpec(a: StaticSpecInput): SpecBlock[] {
  if (a.slide.type === "title") return titleSpec(a);
  if (a.slide.type === "section") return sectionSpec(a);
  return contactsSpec(a);
}

/** Затемнение под текстом для фото на весь слайд. */
export const FULL_BLEED_SHADE = { from: 0.45, alpha: 0.72 } as const;
