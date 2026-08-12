// Экспорт презентации в PPTX (pptxgenjs, только в браузере, динамический импорт).
import { createSignedMediaUrl } from "@/components/MediaShield";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  presentationFileName,
  type Presentation,
  type PresentationSlide,
} from "@/lib/presentations/model";
import { SLIDE_H, SLIDE_W, templatePalette, type Rect } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { planSlideLogos, type LogoPlacementPlan } from "@/lib/presentations/logo-plan";

const W = 10; // дюймы, 16:9 => 10 x 5.625
const H = 5.625;

function hex(color: string, fallback = "FF7500"): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  return m ? m[1].toUpperCase() : fallback;
}

/** rgba()/полупрозрачные значения заменяем плотным цветом. */
function solidHex(css: string, fallback: string): string {
  return /^#?[0-9a-fA-F]{6}$/.test(css.trim()) ? hex(css, fallback) : hex(fallback, fallback);
}

function themeOf(template: Presentation["template"], accent: string) {
  const p = templatePalette(template, `#${hex(accent)}`);
  const dark = template !== "light" && template !== "glow";
  return {
    bg: hex(p.stops[0]),
    ink: solidHex(p.ink, dark ? "F8FAFC" : "111827"),
    muted: solidHex(p.muted, dark ? "C8CEDE" : "6B7280"),
    accent: hex(p.accent ?? `#${hex(accent)}`),
    onAccent: hex(p.onAccent ?? `#${hex(accent)}`),
    stops: p.stops.map((c) => hex(c)),
  };
}

/** Градиентная подложка: PPTX не умеет градиенты, эмулируем полосами. */
function addBackground(
  slide: { addShape: (t: unknown, o: Record<string, unknown>) => void },
  shapeType: unknown,
  stops: string[],
  w: number,
  h: number,
): void {
  const parse = (c: string) => [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const rgbs = stops.map(parse);
  const bands = 24;
  const seg = rgbs.length - 1;
  for (let i = 0; i < bands; i += 1) {
    const t = (i / (bands - 1)) * seg;
    const idx = Math.min(seg - 1, Math.floor(t));
    const k = t - idx;
    const c = rgbs[idx].map((v, j) => Math.round(v + (rgbs[idx + 1][j] - v) * k));
    const col = c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    slide.addShape(shapeType, {
      x: 0, y: (i * h) / bands, w, h: h / bands + 0.02, fill: { color: col }, line: { width: 0 },
    });
  }
}

async function resolveImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^(https?:|data:)/i.test(path)) return path;
  return await createSignedMediaUrl(path, 900);
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPresentationPptx(
  presentation: Presentation,
  slides: PresentationSlide[],
  company: CompanyProfile | null,
): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = presentation.title;
  pptx.company = company?.company_brand || company?.company_legal_name || "";

  const accent = hex(company?.accent_color ?? "#FF7500");
  const t = themeOf(presentation.template, accent);
  const visible = slides.filter((s) => s.is_visible);

  const logoUrl = await resolveImage(presentation.logo_url ?? company?.logo_url ?? null);
  const logoData = logoUrl ? await toDataUrl(logoUrl) : null;
  const clientLogoUrl = await resolveImage(presentation.client_logo_url ?? null);
  const clientLogoData = clientLogoUrl ? await toDataUrl(clientLogoUrl) : null;

  const PAD_IN = 0.7;
  /** Слот планировщика -> позиция в дюймах на слайде 10 x 5.625. */
  const logoBox = (p: LogoPlacementPlan) => {
    const w = (p.maxW / SLIDE_W) * W;
    const h = (p.maxH / SLIDE_H) * H;
    const right = W - PAD_IN - w;
    switch (p.slot) {
      case "hero":
      case "tl":
        return { x: PAD_IN, y: 0.5, w, h };
      case "tr":
        return { x: right, y: 0.5, w, h };
      case "footer":
      case "bl":
        return { x: PAD_IN, y: H - 0.75, w, h };
      case "br":
        return { x: right, y: H - 0.75, w, h };
    }
  };
  const addLogo = (slide: { addImage: (o: Record<string, unknown>) => void }, data: string | null, p: LogoPlacementPlan | null) => {
    if (!data || !p) return;
    const b = logoBox(p);
    slide.addImage({ data, x: b.x, y: b.y, w: b.w, h: b.h, sizing: { type: "contain", w: b.w, h: b.h } });
  };

  for (const [i, s] of visible.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };
    if (t.stops.length > 1 && !t.stops.every((c) => c === t.stops[0])) {
      addBackground(slide, pptx.ShapeType.rect, t.stops, W, H);
    }
    const c = s.content;

    // Та же раскладка, что в превью и PDF: переводим пиксели 1280×720 в дюймы.
    const fit = fitSlide(s);
    const plan = planSlideLogos({
      slideType: s.type,
      frames: fit.layout.frames,
      placement: fit.layout.placement,
      layout: presentation.logo_layout,
      overrides: s.content.layout,
      hasBrandLogo: !!logoData,
      hasClientLogo: !!clientLogoData,
      blocked: [fit.layout.textBox, fit.layout.priceBox].filter(Boolean) as Rect[],
    });
    const IN = W / SLIDE_W;
    const pt = (v: number) => v * 0.75; // px -> pt для кеглей
    const gallery: { data: string; x: number; y: number; w: number; h: number }[] = [];
    if (s.type === "product" || s.type === "text") {
      for (const [k, path] of fit.layout.photos.entries()) {
        const frame = fit.layout.frames[k];
        if (!frame) continue;
        const url = await resolveImage(path);
        const data = url ? await toDataUrl(url) : null;
        if (!data) continue;
        gallery.push({
          data,
          x: frame.x * IN,
          y: frame.y * IN,
          w: frame.w * IN,
          h: frame.h * IN,
        });
      }
    }

    const box = fit.layout.textBox;
    const textLeft = gallery.length ? box.x * IN : 0.7;
    const textW = gallery.length ? box.w * IN : W - 1.4;

    for (const g of gallery) {
      slide.addImage({ data: g.data, x: g.x, y: g.y, w: g.w, h: g.h, sizing: { type: "cover", w: g.w, h: g.h } });
    }

    if (s.type === "title") {
      addLogo(slide, logoData, plan.brand);
      addLogo(slide, clientLogoData, plan.client);
      slide.addText(s.title || presentation.title, {
        x: 0.7, y: 1.7, w: W - 1.6, h: 1.4, fontSize: 40, bold: true, color: t.ink,
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, { x: 0.7, y: 3.0, w: W - 1.6, h: 0.7, fontSize: 18, color: t.muted });
      }
      const contacts = [company?.company_phone, company?.company_email, company?.company_website]
        .filter(Boolean)
        .join("   ·   ");
      if (contacts) {
        slide.addText(contacts, { x: 0.7, y: 4.4, w: W - 1.6, h: 0.5, fontSize: 12, color: t.muted });
      }
      continue;
    }

    const ts = fit.type;
    const topY = gallery.length ? box.y * IN : 0.55;
    // Горизонтальная выключка текста — из той же раскладки, что и превью с PDF.
    const alignX = fit.layout.textAlignX;
    slide.addText(s.title, {
      x: textLeft, y: topY, w: textW, h: 0.9, align: alignX,
      fontSize: pt(s.type === "section" ? ts.titleSection : ts.titleSlide),
      bold: true, color: t.ink,
    });
    if (s.subtitle) {
      slide.addText(s.subtitle, { x: textLeft, y: topY + 0.8, w: textW, h: 0.5, fontSize: pt(ts.subtitle), color: t.muted, align: alignX });
    }

    let y = topY + (s.subtitle ? 1.4 : 1.05);
    if (c.showDescription && c.description) {
      slide.addText(c.description, { x: textLeft, y, w: textW, h: 1.2, fontSize: pt(ts.body), color: t.ink, align: alignX });
      y += 1.3;
    }
    if (c.showIncludes && c.includes.length) {
      slide.addText(
        c.includes.slice(0, 8).map((v) => ({ text: v, options: { bullet: true } })),
        { x: textLeft, y, w: textW, h: 1.6, fontSize: pt(ts.bullet), color: t.ink, align: alignX },
      );
      y += Math.min(c.includes.length, 8) * 0.24 + 0.2;
    }
    if (c.showSpecs && c.specs.length) {
      slide.addText(c.specs.map((sp) => `${sp.label}: ${sp.value}`).join("    "), {
        x: textLeft, y, w: textW, h: 0.5, fontSize: 11, color: t.muted, align: alignX,
      });
      y += 0.6;
    }
    if (s.type === "contacts") {
      const rows = [
        company?.company_phone && `Телефон: ${company.company_phone}`,
        company?.company_email && `E-mail: ${company.company_email}`,
        company?.company_website && `Сайт: ${company.company_website}`,
        company?.company_address && `Адрес: ${company.company_address}`,
      ].filter(Boolean) as string[];
      if (rows.length) {
        slide.addText(rows.join("\n"), { x: textLeft, y, w: textW, h: 2, fontSize: 15, color: t.ink, lineSpacingMultiple: 1.4, align: alignX });
      }
    }
    if (c.showPrice && c.price != null && c.price > 0) {
      const pb = fit.layout.priceBox;
      slide.addText(`${c.price.toFixed(2)} BYN / ${c.priceUnit}`, {
        x: pb ? pb.x * IN : textLeft, y: pb ? pb.y * IN : H - 1.25, w: 3.2, h: 0.5, fontSize: 16, bold: true,
        color: t.onAccent, fill: { color: t.accent }, align: "center",
      });
    }

    addLogo(slide, logoData, plan.brand);
    addLogo(slide, clientLogoData, plan.client);

    slide.addText(`${i + 1} / ${visible.length}`, {
      x: W - 1.4, y: H - 0.6, w: 0.9, h: 0.3, fontSize: 10, color: t.muted, align: "right",
    });
  }

  await pptx.writeFile({ fileName: presentationFileName(presentation.title, "pptx") });
}
