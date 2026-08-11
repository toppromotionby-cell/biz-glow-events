// Экспорт презентации в PDF: альбомный формат 16:9 (960×540 pt), pdf-lib.
// Работает только на сервере. Шрифты — те же Inter/Space Grotesk, что и в
// остальных документах, чтобы PDF совпадал с превью.
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import { hexToRgb01 } from "@/lib/documents/brand";
import type { Presentation, PresentationSlide } from "@/lib/presentations/model";
import { MAX_SLIDE_PHOTOS, SLIDE_W } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { resolveDocFont } from "@/lib/documents/doc-font";

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
};

function color(hex: string): ReturnType<typeof rgb> {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}


function themeOf(template: Presentation["template"], accentHex: string): Theme {
  const accent = color(accentHex);
  if (template === "dark") {
    return {
      bg: rgb(0.059, 0.067, 0.082),
      panel: rgb(0.13, 0.14, 0.16),
      ink: rgb(0.97, 0.98, 0.99),
      muted: rgb(0.65, 0.68, 0.72),
      accent,
      onAccent: rgb(0.059, 0.067, 0.082),
    };
  }
  if (template === "accent") {
    return {
      bg: accent,
      panel: rgb(1, 1, 1),
      ink: rgb(1, 1, 1),
      muted: rgb(0.93, 0.94, 0.96),
      accent: rgb(1, 1, 1),
      onAccent: accent,
    };
  }
  return {
    bg: rgb(1, 1, 1),
    panel: rgb(0.968, 0.973, 0.98),
    ink: rgb(0.067, 0.094, 0.153),
    muted: rgb(0.42, 0.45, 0.5),
    accent,
    onAccent: rgb(1, 1, 1),
  };
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
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: t.bg });
    page.drawText("Нет слайдов", { x: PAD, y: H / 2, size: 24, font: bold, color: t.ink });
    return await pdf.save();
  }

  for (const [index, slide] of visible.entries()) {
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: t.bg });
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



type Rect = { x: number; y: number; w: number; h: number };

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Габариты логотипа, вписанные в бокс с сохранением пропорций. */
function logoSize(img: PDFImage, maxW: number, maxH: number): { w: number; h: number } {
  const k = Math.min(maxW / img.width, maxH / img.height, 1.6);
  return { w: img.width * k, h: img.height * k };
}

/**
 * Кладёт логотип в первое свободное место из списка кандидатов
 * (координаты — от левого нижнего угла страницы, как в pdf-lib).
 */
function placeLogo(
  page: PDFPage,
  img: PDFImage,
  occupied: Rect[],
  maxW: number,
  maxH: number,
  candidates: ("top-right" | "top-left" | "bottom-right" | "bottom-left")[],
  force: boolean,
): Rect | null {
  const { w, h } = logoSize(img, maxW, maxH);
  const pad = 18;
  const spots: Record<string, Rect> = {
    "top-right": { x: W - PAD - w, y: H - PAD - h, w, h },
    "top-left": { x: PAD, y: H - PAD - h, w, h },
    "bottom-right": { x: W - PAD - w, y: 20, w, h },
    "bottom-left": { x: PAD, y: 20, w, h },
  };
  for (const key of candidates) {
    const spot = spots[key];
    const padded = { x: spot.x - pad, y: spot.y - pad, w: spot.w + pad * 2, h: spot.h + pad * 2 };
    if (occupied.some((r) => intersects(padded, r))) continue;
    page.drawImage(img, spot);
    return spot;
  }
  if (!force) return null;
  const spot = spots[candidates[0] ?? "top-right"];
  page.drawImage(img, { ...spot, opacity: 0.92 });
  return spot;
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
      page.drawText(line, { x, y, size, font, color: col });
      y -= size * lh;
    }
    return y;
  };

  const footer = () => {
    if (logo) {
      const k = Math.min(90 / logo.width, 22 / logo.height);
      page.drawImage(logo, { x: PAD, y: 22, width: logo.width * k, height: logo.height * k });
    } else if (brand) {
      page.drawText(brand, { x: PAD, y: 26, size: 10, font: fonts.regular, color: t.muted });
    }
    const label = `${index + 1} / ${total}`;
    const w = fonts.regular.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: W - PAD - w, y: 26, size: 10, font: fonts.regular, color: t.muted });
  };

  if (slide.type === "title") {
    let y = H - 130;
    if (logo) {
      const k = Math.min(180 / logo.width, 52 / logo.height);
      page.drawImage(logo, { x: PAD, y: H - 110, width: logo.width * k, height: logo.height * k });
    } else if (brand) {
      page.drawText(brand, { x: PAD, y: H - 96, size: 18, font: fonts.bold, color: t.ink });
    }
    const title = slide.title || presentation.title;
    y = drawLines(wrap(fonts.display, title, 40, W - PAD * 2 - 120), PAD, y - 40, 40, fonts.display, t.ink, 1.2);
    if (slide.subtitle) {
      y = drawLines(wrap(fonts.regular, slide.subtitle, 17, W - PAD * 2 - 140), PAD, y - 12, 17, fonts.regular, t.muted);
    }
    page.drawRectangle({ x: PAD, y: y - 22, width: 84, height: 3, color: t.accent });
    const contacts = [company?.company_phone, company?.company_email, company?.company_website, company?.company_address]
      .filter((v): v is string => !!v && !!v.trim())
      .join("   ·   ");
    if (contacts) {
      page.drawText(contacts, { x: PAD, y: y - 58, size: 11, font: fonts.regular, color: t.muted });
    }
    return;
  }

  if (slide.type === "section") {
    page.drawRectangle({ x: PAD, y: H / 2 + 46, width: 66, height: 3, color: t.accent });
    let y = drawLines(wrap(fonts.display, slide.title, 34, W - PAD * 2), PAD, H / 2, 34, fonts.display, t.ink, 1.2);
    if (slide.subtitle) drawLines(wrap(fonts.regular, slide.subtitle, 16, W - PAD * 2 - 100), PAD, y - 14, 16, fonts.regular, t.muted);
    footer();
    return;
  }

  // Общая раскладка (1280×720) переводится в points 960×540 коэффициентом K.
  const fit = fitSlide(slide);
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

  const box = fit.layout.textBox;
  const x = px(box.x);
  const maxW = px(box.w);
  const titleSize = px(ts.titleSlide);
  const subSize = px(ts.subtitle);
  const bodySize = px(ts.body);
  const bulletSize = px(ts.bullet);
  let y = H - px(box.y) - titleSize;

  y = drawLines(wrap(fonts.display, slide.title, titleSize, maxW), x, y, titleSize, fonts.display, t.ink, 1.14);
  if (slide.subtitle) {
    y = drawLines(wrap(fonts.regular, slide.subtitle, subSize, maxW), x, y - 6, subSize, fonts.regular, t.muted);
  }
  page.drawRectangle({ x, y: y - 14, width: 52, height: 2.5, color: t.accent });
  y -= px(ts.blockGap) + 14;


  if (c.showDescription && c.description.trim()) {
    y = drawLines(wrap(fonts.regular, c.description, bodySize, maxW), x, y, bodySize, fonts.regular, t.ink, ts.lineGap);
    y -= px(ts.blockGap) * 0.6;
  }

  if (c.showIncludes && c.includes.length) {
    if (slide.type === "product") {
      page.drawText("ЧТО ВХОДИТ", { x, y, size: px(ts.label), font: fonts.bold, color: t.muted });
      y -= px(ts.label) * 1.8;
    }
    for (const item of c.includes.slice(0, 9)) {
      const lines = wrap(fonts.regular, item, bulletSize, maxW - 14);
      page.drawText("•", { x, y, size: bulletSize, font: fonts.regular, color: t.accent });
      y = drawLines(lines, x + 14, y, bulletSize, fonts.regular, t.ink, ts.lineGap);
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
      page.drawText(text, { x: cx + 10, y, size: chip, font: fonts.regular, color: t.ink });
      cx += w + 8;
    }
    y -= chip * 3;
  }


  if (slide.type === "contacts") {
    const rows = [
      company?.company_phone && `Телефон: ${company.company_phone}`,
      company?.company_email && `E-mail: ${company.company_email}`,
      company?.company_website && `Сайт: ${company.company_website}`,
      company?.company_address && `Адрес: ${company.company_address}`,
    ].filter((v): v is string => !!v);
    for (const row of rows) {
      page.drawText(row, { x, y, size: 14, font: fonts.regular, color: t.ink });
      y -= 26;
    }
  }

  if (c.showPrice && c.price != null && c.price > 0) {
    const label = `${money(c.price)} / ${c.priceUnit}`;
    const w = fonts.bold.widthOfTextAtSize(label, 15) + 32;
    page.drawRectangle({ x, y: 64, width: w, height: 34, color: t.accent });
    page.drawText(label, { x: x + 16, y: 75, size: 15, font: fonts.bold, color: t.onAccent });
  }

  footer();
}
