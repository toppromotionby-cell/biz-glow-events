// Экспорт презентации в PPTX (pptxgenjs, только в браузере, динамический импорт).
import { createSignedMediaUrl } from "@/components/MediaShield";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  presentationFileName,
  type Presentation,
  type PresentationSlide,
} from "@/lib/presentations/model";

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

    let imgData: string | null = null;
    if (c.showImage && s.image_url && (s.type === "product" || s.type === "text")) {
      const url = await resolveImage(s.image_url);
      imgData = url ? await toDataUrl(url) : null;
    }

    const textLeft = imgData ? 4.4 : 0.7;
    const textW = imgData ? W - textLeft - 0.6 : W - 1.4;

    if (imgData) {
      slide.addImage({ data: imgData, x: 0, y: 0, w: 4.0, h: H, sizing: { type: "cover", w: 4.0, h: H } });
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

    slide.addText(s.title, {
      x: textLeft, y: 0.55, w: textW, h: 0.9, fontSize: s.type === "section" ? 34 : 26, bold: true, color: t.ink,
    });
    if (s.subtitle) {
      slide.addText(s.subtitle, { x: textLeft, y: 1.35, w: textW, h: 0.5, fontSize: 14, color: t.muted });
    }

    let y = s.subtitle ? 1.95 : 1.6;
    if (c.showDescription && c.description) {
      slide.addText(c.description, { x: textLeft, y, w: textW, h: 1.2, fontSize: 13, color: t.ink });
      y += 1.3;
    }
    if (c.showIncludes && c.includes.length) {
      slide.addText(
        c.includes.slice(0, 8).map((v) => ({ text: v, options: { bullet: true } })),
        { x: textLeft, y, w: textW, h: 1.6, fontSize: 12, color: t.ink },
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
