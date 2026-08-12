// Экспорт презентации в PDF: альбомный формат 16:9 (960×540 pt), pdf-lib.
// Работает только на сервере. Шрифты — те же Inter/Space Grotesk, что и в
// остальных документах, чтобы PDF совпадал с превью.
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import { hexToRgb01 } from "@/lib/documents/brand";
import type { Presentation, PresentationSlide } from "@/lib/presentations/model";
import { MAX_SLIDE_PHOTOS, SLIDE_W, templatePalette, type Rect } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { planSlideLogos, type LogoPlacementPlan } from "@/lib/presentations/logo-plan";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { resolveDocFont } from "@/lib/documents/doc-font";
import {
  FULL_BLEED_SHADE, staticSlideSpec, type SpecBlock,
} from "@/lib/presentations/slide-spec";


const W = 960;
const H = 540;
const PAD = 56;

type Theme = {
  bg: ReturnType<typeof rgb>;
  panel: ReturnType<typeof rgb>;
  ink: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  onAccent: ReturnType<typeof rgb>;
  /** Стопы фонового градиента (hex) — рисуются полосами. */
  stops: string[];
};

function color(hex: string): ReturnType<typeof rgb> {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

/** Полупрозрачные rgba() палитры сводим к плотному цвету на фоне слайда. */
function solid(css: string, fallback: string): string {
  return /^#?[0-9a-fA-F]{6}$/.test(css.trim()) ? css : fallback;
}

function themeOf(template: Presentation["template"], accentHex: string): Theme {
  const p = templatePalette(template, accentHex);
  const dark = template !== "light" && template !== "glow";
  return {
    bg: color(p.stops[0]),
    panel: color(solid(p.panel, dark ? "#1b2030" : "#f7f8fa")),
    ink: color(solid(p.ink, dark ? "#f8fafc" : "#111827")),
    muted: color(solid(p.muted, dark ? "#c8cede" : "#6b7280")),
    accent: color(p.accent ?? accentHex),
    onAccent: color(p.onAccent ?? accentHex),
    stops: p.stops,
  };
}

/** Плавный фон: интерполяция стопов горизонтальными полосами. */
function drawBackground(page: PDFPage, t: Theme): void {
  const stops = t.stops.map((c) => hexToRgb01(c));
  if (stops.length < 2 || t.stops.every((c) => c === t.stops[0])) {
    // Однотонный фон — просто заливаем весь слайд.
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: t.bg });
    return;
  }

  const bands = 96;
  const seg = stops.length - 1;
  for (let i = 0; i < bands; i += 1) {
    const p = i / (bands - 1);
    const f = p * seg;
    const idx = Math.min(seg - 1, Math.floor(f));
    const k = f - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    const h = H / bands;
    page.drawRectangle({
      x: 0,
      y: H - (i + 1) * h - 0.5,
      width: W,
      height: h + 1,
      color: rgb(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k),
    });
  }
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const cand = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(cand, size) <= maxWidth) line = cand;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out.filter((l, i, a) => l !== "" || i < a.length - 1);
}

function money(n: number): string {
  const fmt = new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${fmt} BYN`;
}

async function embedImage(pdf: PDFDocument, url: string | null): Promise<PDFImage | null> {
  const src = (url ?? "").trim();
  if (!src || !/^https?:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpg) return null;
    return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** Слайд с уже разрешёнными абсолютными URL фотографий (до 5). */
export type ResolvedSlide = PresentationSlide & {
  resolved_image_url: string | null;
  resolved_images: string[];
};

export async function buildPresentationPdf(
  presentation: Presentation,
  slides: ResolvedSlide[],
  company: CompanyProfile | null,
  logoUrl: string | null,
  clientLogoUrl: string | null = null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const set = pdfFontSet(resolveDocFont(presentation.font_family));
  const regular = await pdf.embedFont(set.regular, { subset: true });
  const bold = await pdf.embedFont(set.bold, { subset: true });
  const display = await pdf.embedFont(set.display, { subset: true });

  pdf.setTitle(presentation.title);
  const t = themeOf(presentation.template, company?.accent_color ?? "#FF7500");
  const logo = await embedImage(pdf, logoUrl);
  const clientLogo = await embedImage(pdf, clientLogoUrl);
  const layout = presentation.logo_layout;
  const brand = company?.company_brand || company?.company_legal_name || company?.name || "";

  const visible = slides.filter((s) => s.is_visible);
  if (!visible.length) {
    const page = pdf.addPage([W, H]);
    drawBackground(page, t);
    page.drawText("Нет слайдов", { x: PAD, y: H / 2, size: 24, font: bold, color: t.ink });
    return await pdf.save();
  }

  for (const [index, slide] of visible.entries()) {
    const page = pdf.addPage([W, H]);
    drawBackground(page, t);
    const sources = slide.content.showImage
      ? (slide.resolved_images.length
          ? slide.resolved_images
          : [slide.resolved_image_url].filter((v): v is string => !!v))
      : [];
    const images: (PDFImage | null)[] = [];
    for (const src of sources.slice(0, MAX_SLIDE_PHOTOS)) {
      images.push(await embedImage(pdf, src));
    }
    await drawSlide({
      page, slide, images, logo, clientLogo, layout, brand, theme: t,
      fonts: { regular, bold, display },
      company, presentation,
      index, total: visible.length,
    });
  }

  return await pdf.save();
}






/** Рисует логотип в слоте, рассчитанном планировщиком (координаты pdf-lib). */
function drawPlannedLogo(page: PDFPage, img: PDFImage, plan: LogoPlacementPlan): void {
  const K = W / SLIDE_W;
  const maxW = plan.maxW * K;
  const maxH = plan.maxH * K;
  const k = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * k;
  const h = img.height * k;
  const right = W - PAD - w;
  switch (plan.slot) {
    case "free":
      // Свободная позиция: холст 1280×720 → координаты страницы (ось Y инвертирована).
      page.drawImage(img, { x: (plan.x ?? 0) * K, y: H - (plan.y ?? 0) * K - h, width: w, height: h });
      return;
    case "hero":

      page.drawImage(img, { x: PAD, y: H - PAD - h, width: w, height: h });
      return;
    case "footer":
      page.drawImage(img, { x: PAD, y: 22, width: w, height: h });
      return;
    case "tl":
      page.drawImage(img, { x: PAD, y: H - PAD - h, width: w, height: h });
      return;
    case "tr":
      page.drawImage(img, { x: right, y: H - PAD - h, width: w, height: h });
      return;
    case "bl":
      page.drawImage(img, { x: PAD, y: 72, width: w, height: h });
      return;
    case "br":
      page.drawImage(img, { x: right, y: 72, width: w, height: h });
      return;
  }
}

/** Дата на титульном слайде — тот же формат, что и в превью. */
function formatSlideDate(): string {
  return new Date().toLocaleDateString("ru-RU");
}

/** Плавное затемнение снизу для фото на весь слайд (как градиент в превью). */
function drawBottomShade(page: PDFPage): void {
  const bands = 48;
  const top = H * (1 - FULL_BLEED_SHADE.from);
  const h = top / bands;
  for (let i = 0; i < bands; i += 1) {
    const p = (i + 1) / bands;
    page.drawRectangle({
      x: 0,
      y: top - (i + 1) * h,
      width: W,
      height: h + 0.6,
      color: rgb(0, 0, 0),
      opacity: FULL_BLEED_SHADE.alpha * p,
    });
  }
}

/** Рисует блоки общего спека слайда (координаты холста 1280×720 → points). */
function drawSpecBlocks(
  page: PDFPage,
  blocks: SpecBlock[],
  t: Theme,
  fonts: { regular: PDFFont; bold: PDFFont; display: PDFFont },
  logo: PDFImage | null,
): void {
  const K = W / SLIDE_W;
  const paint = (c: "ink" | "muted" | "accent" | "onAccent" | "panel") =>
    c === "ink" ? t.ink : c === "muted" ? t.muted : c === "accent" ? t.accent : c === "onAccent" ? t.onAccent : t.panel;

  for (const b of blocks) {
    if (b.kind === "circle") {
      page.drawCircle({
        x: b.cx * K,
        y: H - b.cy * K,
        size: b.r * K,
        color: paint(b.color),
        opacity: b.opacity,
      });
      continue;
    }
    if (b.kind === "rect") {
      page.drawRectangle({
        x: b.x * K,
        y: H - (b.y + b.h) * K,
        width: b.w * K,
        height: b.h * K,
        color: paint(b.color),
        opacity: b.opacity ?? 1,
      });
      continue;
    }
    if (b.kind === "logo") {
      if (!logo) continue;
      const maxW = b.w * K;
      const maxH = b.h * K;
      const k = Math.min(maxW / logo.width, maxH / logo.height);
      const w = logo.width * k;
      const h = logo.height * k;
      page.drawImage(logo, { x: b.x * K, y: H - b.y * K - h, width: w, height: h });
      continue;
    }

    const font = b.font === "display" ? fonts.display : b.weight >= 600 ? fonts.bold : fonts.regular;
    const size = b.size * K;
    const width = b.w * K;
    const text = b.uppercase ? b.text.toUpperCase() : b.text;
    let y = H - b.y * K - size;
    for (const line of wrap(font, text, size, width)) {
      const lw = font.widthOfTextAtSize(line, size);
      const dx = b.align === "center" ? (width - lw) / 2 : b.align === "right" ? width - lw : 0;
      page.drawText(line, { x: b.x * K + dx, y, size, font, color: paint(b.color) });
      y -= size * b.lineHeight;
    }
  }
}



type DrawArgs = {
  page: PDFPage;
  slide: ResolvedSlide;
  images: (PDFImage | null)[];
  logo: PDFImage | null;
  clientLogo: PDFImage | null;
  layout: Presentation["logo_layout"];
  brand: string;
  theme: Theme;
  fonts: { regular: PDFFont; bold: PDFFont; display: PDFFont };
  company: CompanyProfile | null;
  presentation: Presentation;
  index: number;
  total: number;
};

async function drawSlide(a: DrawArgs) {
  const { page, slide, images, logo, clientLogo, layout, brand, theme: t, fonts, company, presentation, index, total } = a;
  const c = slide.content;
  const slideFit = fitSlide(slide);
  const plan = planSlideLogos({
    slideType: slide.type,
    frames: slideFit.layout.frames,
    placement: slideFit.layout.placement,
    layout,
    hasBrandLogo: !!logo,
    hasClientLogo: !!clientLogo,
    overrides: slide.content.layout,
    blocked: [slideFit.layout.textBox, slideFit.layout.priceBox].filter(Boolean) as Rect[],
  });
  const drawClientLogo = () => {
    if (clientLogo && plan.client) drawPlannedLogo(page, clientLogo, plan.client);
  };

  // Горизонтальное выравнивание текста слайда (для слайдов с текстовой колонкой).
  const alignMode =
    slide.type === "product" || slide.type === "text" ? slideFit.layout.textAlignX : "left";
  const alignBoxW = (slideFit.layout.textBox.w * W) / SLIDE_W;
  const alignX = (left: number, lineW: number) =>
    alignMode === "center"
      ? left + (alignBoxW - lineW) / 2
      : alignMode === "right"
        ? left + alignBoxW - lineW
        : left;

  const drawLines = (
    lines: string[],
    x: number,
    yStart: number,
    size: number,
    font: PDFFont,
    col: ReturnType<typeof rgb>,
    lh = 1.35,
  ) => {
    let y = yStart;
    for (const line of lines) {
      page.drawText(line, { x: alignX(x, font.widthOfTextAtSize(line, size)), y, size, font, color: col });
      y -= size * lh;
    }
    return y;
  };

  const footerSize = slideFit.type.caption * (W / SLIDE_W);
  const footer = (size = footerSize) => {
    // Базовая линия футера соответствует превью: 28 px от низа холста 1280×720.
    const fy = (28 * W) / SLIDE_W;
    if (logo && plan.brand?.slot === "footer") {
      drawPlannedLogo(page, logo, plan.brand);
    } else if (brand) {
      page.drawText(brand, { x: PAD, y: fy, size, font: fonts.regular, color: t.muted });
    }
    const label = `${index + 1} / ${total}`;
    const w = fonts.regular.widthOfTextAtSize(label, size);
    page.drawText(label, { x: W - PAD - w, y: fy, size, font: fonts.regular, color: t.muted });
  };


  if (slide.type === "title" || slide.type === "section" || slide.type === "contacts") {
    const heroPlan = plan.brand?.slot === "hero" ? plan.brand : null;
    const blocks = staticSlideSpec({
      slide,
      ts: slideFit.type,
      company,
      presentationTitle: presentation.title,
      brandName: brand,
      heroLogo: logo && heroPlan ? { w: heroPlan.maxW, h: heroPlan.maxH } : null,
      dateLabel: slide.type === "title" ? formatSlideDate() : "",
    });
    drawSpecBlocks(page, blocks, t, fonts, logo);
    drawClientLogo();
    if (logo && plan.brand && plan.brand.slot !== "hero") drawPlannedLogo(page, logo, plan.brand);
    if (slide.type !== "title") footer(slideFit.type.caption * (W / SLIDE_W));
    return;
  }


  // Общая раскладка (1280×720) переводится в points 960×540 коэффициентом K.
  const fit = slideFit;
  const K = W / SLIDE_W;
  const ts = fit.type;
  const px = (v: number) => v * K;

  fit.layout.frames.forEach((f, i) => {
    const image = images[i];
    if (!image) return;
    const fw = px(f.w);
    const fh = px(f.h);
    const k = Math.max(fw / image.width, fh / image.height);
    const w = image.width * k;
    const h = image.height * k;
    const cx = px(f.x) + fw / 2;
    const cy = H - px(f.y) - fh / 2;
    page.drawImage(image, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  });

  // Фото на весь слайд: снизу тёмный градиент и белый текст — как в превью.
  const isFullBleed = fit.layout.placement === "full";
  if (isFullBleed) drawBottomShade(page);
  const inkCol = isFullBleed ? rgb(1, 1, 1) : t.ink;
  const mutedCol = isFullBleed ? rgb(0.92, 0.92, 0.92) : t.muted;

  const box = fit.layout.textBox;
  const x = px(box.x);
  const maxW = px(box.w);
  const titleSize = px(ts.titleSlide);
  const subSize = px(ts.subtitle);
  const bodySize = px(ts.body);
  const bulletSize = px(ts.bullet);
  let y = H - px(box.y) - titleSize;

  y = drawLines(wrap(fonts.display, slide.title, titleSize, maxW), x, y, titleSize, fonts.display, inkCol, 1.14);
  if (slide.subtitle) {
    y = drawLines(wrap(fonts.regular, slide.subtitle, subSize, maxW), x, y - 6, subSize, fonts.regular, mutedCol);
  }
  if (!isFullBleed) {
    page.drawRectangle({ x: alignX(x, 52), y: y - 14, width: 52, height: 2.5, color: t.accent });
  }
  y -= px(ts.blockGap) + 14;



  if (c.showDescription && c.description.trim()) {
    y = drawLines(wrap(fonts.regular, c.description, bodySize, maxW), x, y, bodySize, fonts.regular, inkCol, ts.lineGap);
    y -= px(ts.blockGap) * 0.6;
  }

  if (c.showIncludes && c.includes.length) {
    if (slide.type === "product") {
      page.drawText("ЧТО ВХОДИТ", { x, y, size: px(ts.label), font: fonts.bold, color: mutedCol });
      y -= px(ts.label) * 1.8;
    }
    for (const item of c.includes.slice(0, 9)) {
      if (alignMode === "left") {
        const lines = wrap(fonts.regular, item, bulletSize, maxW - 14);
        page.drawText("•", { x, y, size: bulletSize, font: fonts.regular, color: t.accent });
        y = drawLines(lines, x + 14, y, bulletSize, fonts.regular, inkCol, ts.lineGap);
      } else {
        const lines = wrap(fonts.regular, `• ${item}`, bulletSize, maxW);
        y = drawLines(lines, x, y, bulletSize, fonts.regular, inkCol, ts.lineGap);
      }
      y -= 2;
    }
    y -= px(ts.blockGap) * 0.5;
  }

  if (c.showSpecs && c.specs.length) {
    const chip = px(ts.chip);
    let cx = x;
    for (const s of c.specs) {
      const text = `${s.label}: ${s.value}`;
      const w = fonts.regular.widthOfTextAtSize(text, chip) + 20;
      if (cx + w > x + maxW) { cx = x; y -= chip * 2.4; }
      page.drawRectangle({ x: cx, y: y - 6, width: w, height: chip * 2.1, color: t.panel, opacity: 0.9 });
      page.drawText(text, { x: cx + 10, y, size: chip, font: fonts.regular, color: inkCol });
      cx += w + 8;
    }
    y -= chip * 3;
  }





  if (c.showPrice && c.price != null && c.price > 0) {
    // Плашка цены повторяет превью: кегль ts.stat, единица — ts.caption.
    const statSize = px(ts.stat);
    const unitSize = px(ts.caption);
    const sum = money(c.price);
    const unit = `/ ${c.priceUnit}`;
    const padX = px(20);
    const padY = px(10);
    const gap = px(10);
    const w = fonts.display.widthOfTextAtSize(sum, statSize)
      + gap + fonts.regular.widthOfTextAtSize(unit, unitSize) + padX * 2;
    const h = statSize * 1.25 + padY * 2;
    const pb = slideFit.layout.priceBox;
    const bx = pb ? px(pb.x) : alignX(x, w);
    const by = pb ? H - px(pb.y) - h : y - h;
    page.drawRectangle({ x: bx, y: by, width: w, height: h, color: t.accent });
    page.drawText(sum, { x: bx + padX, y: by + padY + statSize * 0.16, size: statSize, font: fonts.display, color: t.onAccent });
    page.drawText(unit, {
      x: bx + padX + fonts.display.widthOfTextAtSize(sum, statSize) + gap,
      y: by + padY + statSize * 0.16,
      size: unitSize,
      font: fonts.regular,
      color: t.onAccent,
      opacity: 0.85,
    });
    if (!pb) y = by - px(ts.blockGap);
  }

  if (c.sku.trim()) {
    const size = px(ts.caption);
    page.drawText(`Артикул: ${c.sku}`, { x, y: y - size, size, font: fonts.regular, color: mutedCol });
  }


  // Логотипы: ровно один логотип компании и один клиента, слоты уже посчитаны.
  drawClientLogo();
  if (logo && plan.brand && plan.brand.slot !== "footer") drawPlannedLogo(page, logo, plan.brand);

  footer();
}
