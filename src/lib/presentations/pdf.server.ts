// Экспорт презентации в PDF: альбомный формат 16:9 (960×540 pt), pdf-lib.
// Работает только на сервере. Шрифты — те же Inter/Space Grotesk, что и в
// остальных документах, чтобы PDF совпадал с превью.
import { photoDrawRectPdf } from "@/lib/presentations/photo-fit";
import {
  PDFDocument, rgb, clip, closePath, endPath, lineTo, moveTo,
  popGraphicsState, pushGraphicsState,
  type PDFFont, type PDFImage, type PDFPage,
} from "pdf-lib";

import fontkit from "@pdf-lib/fontkit";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import { hexToRgb01 } from "@/lib/documents/brand";
import type { Presentation, PresentationSlide, SlideBackground } from "@/lib/presentations/model";
import {
  isDarkBackground, MAX_SLIDE_PHOTOS, SLIDE_W, templatePalette, type Rect,
} from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { planSlideLogos, logoReserveRect, type LogoPlacementPlan } from "@/lib/presentations/logo-plan";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { pickDisplayFont } from "@/lib/documents/pdf/ctx.server";
import { resolveDocFont } from "@/lib/documents/doc-font";
import {
  createImageCache, embedImageUrl, type ImageCache,
} from "@/lib/documents/image-embed.server";

import {
  FULL_BLEED_SHADE, type SpecBlock, type SpecPaint,
} from "@/lib/presentations/slide-spec";
import { slideSpec } from "@/lib/presentations/spec";


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

function themeOf(
  template: Presentation["template"],
  accentHex: string,
  background?: SlideBackground | null,
): Theme {
  const p = templatePalette(template, accentHex, background);
  const dark = isDarkBackground(p.stops);
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

async function embedImage(
  pdf: PDFDocument,
  url: string | null,
  cache?: ImageCache,
): Promise<PDFImage | null> {
  return await embedImageUrl(pdf, url, { cache });
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
  const accentHex = company?.accent_color ?? "#FF7500";
  const t = themeOf(presentation.template, accentHex);
  const cache = createImageCache();
  const logo = await embedImage(pdf, logoUrl, cache);
  const clientLogo = await embedImage(pdf, clientLogoUrl, cache);
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
    // Фон слайда может быть переопределён — тогда и токены текста считаются от него.
    const st = themeOf(presentation.template, accentHex, slide.content.background);
    drawBackground(page, st);
    // Список уже отфильтрован и упорядочен в loadPresentationBundle (slidePhotos).
    const sources = slide.resolved_images.length
      ? slide.resolved_images
      : (slide.content.showImage
          ? [slide.resolved_image_url].filter((v): v is string => !!v)
          : []);
    // Фото грузятся параллельно — сборка PDF не упирается в сеть.
    const images: (PDFImage | null)[] = await Promise.all(
      sources.slice(0, MAX_SLIDE_PHOTOS).map((src) => embedImage(pdf, src, cache)),
    );

    await drawSlide({
      page, slide, images, logo, clientLogo, layout, brand, theme: st,
      fonts: { regular, bold, display, displayCyrillic: set.displayCyrillic },
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

type SlideFonts = {
  regular: PDFFont;
  bold: PDFFont;
  display: PDFFont;
  /** Есть ли кириллица в display-шрифте набора. */
  displayCyrillic: boolean;
};

/** Рисует блоки общего спека слайда (координаты холста 1280×720 → points). */
function drawSpecBlocks(
  page: PDFPage,
  blocks: SpecBlock[],
  t: Theme,
  fonts: SlideFonts,
  logo: PDFImage | null,
  photos: (PDFImage | null)[] = [],
): void {
  const K = W / SLIDE_W;
  const paint = (c: SpecPaint) =>
    c === "ink" ? t.ink
      : c === "muted" ? t.muted
        : c === "accent" ? t.accent
          : c === "onAccent" ? t.onAccent
            : c === "onPhoto" ? rgb(1, 1, 1)
              : c === "onPhotoMuted" ? rgb(0.92, 0.92, 0.92)
                : t.panel;

  for (const b of blocks) {
    if (b.kind === "shade") {
      drawBottomShade(page);
      continue;
    }
    if (b.kind === "image") {
      const img = photos[b.index] ?? null;
      const fw = b.w * K;
      const fh = b.h * K;
      const fx = b.x * K;
      const fy = H - (b.y + b.h) * K;
      if (!img) {
        // Фото не загрузилось — аккуратная плашка, чтобы композиция не разъехалась.
        page.drawRectangle({
          x: fx, y: fy, width: fw, height: fh,
          color: t.panel, borderColor: t.muted, borderWidth: 0.5, opacity: 0.9,
        });
        continue;
      }
      // Кадрирование считает общий модуль — превью и PDF совпадают пиксель в пиксель.
      const dr = photoDrawRectPdf(
        { x: fx, y: fy, w: fw, h: fh }, img.width, img.height,
        b.fit ?? "cover", b.anchor ?? "center",
      );
      // object-fit: cover — лишнее обрезаем рамкой, иначе фото «вылезает»
      // за свою колонку и наезжает на текст (в превью этого не происходит).
      page.pushOperators(
        pushGraphicsState(),
        moveTo(fx, fy), lineTo(fx + fw, fy), lineTo(fx + fw, fy + fh), lineTo(fx, fy + fh),
        closePath(), clip(), endPath(),
      );
      page.drawImage(img, { x: dr.x, y: dr.y, width: dr.w, height: dr.h });
      page.pushOperators(popGraphicsState());
      continue;

    }
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

    const font = b.font === "display"
      ? pickDisplayFont(b.text, fonts)
      : b.weight >= 600 ? fonts.bold : fonts.regular;
    const size = b.size * K;
    const width = b.w * K;
    const cast = (s: string) => (b.uppercase ? s.toUpperCase() : s);
    // Строки уже посчитаны общими метриками — берём их, чтобы PDF совпал с превью.
    const lines = (b.lines ?? wrap(font, b.text, size, width)).map(cast);
    let y = H - b.y * K - size;
    for (const line of lines) {
      // Страховка от рассинхрона метрик: если строка всё же шире блока
      // (плашка, цена, узкая колонка) — ужимаем кегль, но не рвём вёрстку.
      let s = size;
      let lw = font.widthOfTextAtSize(line, s);
      while (lw > width + 0.5 && s > size * 0.6) {
        s -= size * 0.02;
        lw = font.widthOfTextAtSize(line, s);
      }
      const dx = b.align === "center" ? (width - lw) / 2 : b.align === "right" ? width - lw : 0;
      page.drawText(line, { x: b.x * K + dx, y, size: s, font, color: paint(b.color) });
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
  fonts: SlideFonts;
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


  const heroPlan = plan.brand?.slot === "hero" ? plan.brand : null;
  const spec = slideSpec({
    slide,
    fit: slideFit,
    company,
    presentationTitle: presentation.title,
    brandName: brand,
    heroLogo: logo && heroPlan ? { w: heroPlan.maxW, h: heroPlan.maxH } : null,
    footerLogo: plan.brand?.slot === "footer" && !!logo,
    dateLabel: formatSlideDate(),
    index,
    total,
    reserved: [logoReserveRect(plan.client), logoReserveRect(plan.brand)],
  });

  drawSpecBlocks(page, spec.blocks, t, fonts, logo, images);

  // Логотипы: ровно один логотип компании и один клиента, слоты уже посчитаны.
  drawClientLogo();
  if (logo && plan.brand && !(spec.kind === "static" && plan.brand.slot === "hero")) {
    drawPlannedLogo(page, logo, plan.brand);
  }
  if (spec.footer) footer();
}


