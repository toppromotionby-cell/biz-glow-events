// Контекст сборки PDF: шрифты, текущая страница и логотипы.
import { embedImageUrl } from "@/lib/documents/image-embed.server";
import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { DEFAULT_LOGO_LAYOUT, type LogoLayout } from "@/lib/documents/logo-layout";

export const CYRILLIC = /[\u0400-\u04FF]/;
export function displayFont(ctx: DocCtx, text: string): PDFFont {
  if (ctx.displayCyrillic) return ctx.display;
  return CYRILLIC.test(text) ? ctx.bold : ctx.display;
}

export type FittedLogo = { img: PDFImage; w: number; h: number; aspect: number };

export type DocCtx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  display: PDFFont;
  /** Есть ли кириллица в display-шрифте. */
  displayCyrillic: boolean;


  page: PDFPage;
  y: number;
  pageNum: number;

  /** Логотип компании в шапке (если загружен и доступен). */
  logo?: FittedLogo | null;
  /** Логотип клиента (промо-КП) — рисуется справа под шапкой. */
  clientLogo?: FittedLogo | null;
  /** Настройки размещения логотипа в шапке. */
  logoLayout: LogoLayout;
};

// Габариты логотипа в шапке (pt). Пропорции сохраняются, картинка вписывается.
export const HEADER_LOGO_MAX_H = DEFAULT_LOGO_LAYOUT.maxH;
export const HEADER_LOGO_MAX_W = DEFAULT_LOGO_LAYOUT.maxW;

/**
 * Загружает логотип по URL и встраивает в PDF, вписывая в бокс maxW×maxH.
 * Ошибки сети/формата не ломают документ — логотип просто не рисуется.
 */
export async function embedLogo(
  pdf: PDFDocument,
  url: string | null | undefined,
  maxW = HEADER_LOGO_MAX_W,
  maxH = HEADER_LOGO_MAX_H,
): Promise<FittedLogo | null> {
  const img = await embedImageUrl(pdf, url, { width: 800 });
  if (!img) return null;
  const k = Math.min(maxW / img.width, maxH / img.height);
  return { img, w: img.width * k, h: img.height * k, aspect: img.width / img.height };
}
