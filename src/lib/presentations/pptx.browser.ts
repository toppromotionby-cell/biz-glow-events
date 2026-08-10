// Экспорт презентации в PPTX (pptxgenjs, только в браузере, динамический импорт).
import { createSignedMediaUrl } from "@/components/MediaShield";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  presentationFileName,
  type Presentation,
  type PresentationSlide,
} from "@/lib/presentations/model";
import { SLIDE_W } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";

const W = 10; // дюймы, 16:9 => 10 x 5.625
const H = 5.625;

function hex(color: string, fallback = "FF7500"): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  return m ? m[1].toUpperCase() : fallback;
}

function themeOf(template: Presentation["template"], accent: string) {
  if (template === "dark") return { bg: "0F1115", ink: "F8FAFC", muted: "9CA3AF", accent, onAccent: "0F1115" };
  if (template === "accent") return { bg: accent, ink: "FFFFFF", muted: "F3F4F6", accent: "FFFFFF", onAccent: accent };
  return { bg: "FFFFFF", ink: "111827", muted: "6B7280", accent, onAccent: "FFFFFF" };
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

  const logoUrl = await resolveImage(company?.logo_url ?? null);
  const logoData = logoUrl ? await toDataUrl(logoUrl) : null;

  for (const [i, s] of visible.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };
    const c = s.content;

    // Та же раскладка, что в превью и PDF: переводим пиксели 1280×720 в дюймы.
    const fit = fitSlide(s);
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
      if (logoData) slide.addImage({ data: logoData, x: 0.7, y: 0.6, w: 1.8, h: 0.55, sizing: { type: "contain", w: 1.8, h: 0.55 } });
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
    slide.addText(s.title, {
      x: textLeft, y: topY, w: textW, h: 0.9,
      fontSize: pt(s.type === "section" ? ts.titleSection : ts.titleSlide),
      bold: true, color: t.ink,
    });
    if (s.subtitle) {
      slide.addText(s.subtitle, { x: textLeft, y: topY + 0.8, w: textW, h: 0.5, fontSize: pt(ts.subtitle), color: t.muted });
    }

    let y = topY + (s.subtitle ? 1.4 : 1.05);
    if (c.showDescription && c.description) {
      slide.addText(c.description, { x: textLeft, y, w: textW, h: 1.2, fontSize: pt(ts.body), color: t.ink });
      y += 1.3;
    }
    if (c.showIncludes && c.includes.length) {
      slide.addText(
        c.includes.slice(0, 8).map((v) => ({ text: v, options: { bullet: true } })),
        { x: textLeft, y, w: textW, h: 1.6, fontSize: pt(ts.bullet), color: t.ink },
      );
      y += Math.min(c.includes.length, 8) * 0.24 + 0.2;
    }
    if (c.showSpecs && c.specs.length) {
      slide.addText(c.specs.map((sp) => `${sp.label}: ${sp.value}`).join("    "), {
        x: textLeft, y, w: textW, h: 0.5, fontSize: 11, color: t.muted,
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
        slide.addText(rows.join("\n"), { x: textLeft, y, w: textW, h: 2, fontSize: 15, color: t.ink, lineSpacingMultiple: 1.4 });
      }
    }
    if (c.showPrice && c.price != null && c.price > 0) {
      slide.addText(`${c.price.toFixed(2)} BYN / ${c.priceUnit}`, {
        x: textLeft, y: H - 1.25, w: 3.2, h: 0.5, fontSize: 16, bold: true,
        color: t.onAccent, fill: { color: t.accent }, align: "center",
      });
    }

    slide.addText(`${i + 1} / ${visible.length}`, {
      x: W - 1.4, y: H - 0.6, w: 0.9, h: 0.3, fontSize: 10, color: t.muted, align: "right",
    });
  }

  await pptx.writeFile({ fileName: presentationFileName(presentation.title, "pptx") });
}
