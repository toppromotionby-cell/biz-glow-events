// PDF корпоративного документа. Тот же набор блоков, что и в HTML-превью,
// поэтому состав и порядок совпадают. Кириллица — встроенные TTF (subset).
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { embedImageUrl } from "@/lib/documents/image-embed.server";
import { wrapText } from "@/lib/documents/pdf/draw.server";
import { hexToRgb01 } from "@/lib/documents/brand";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PwBlank, PwBlock, PwDocument } from "@/lib/paperwork/model";
import { fittedBlank, MIN_FONT_PT, PDF_FIT_STEPS, shrinkBlank } from "./fit-page";
import { blockTotals, formatMoney, lineTotal } from "@/lib/paperwork/totals";
import { requisitesFontPt, resolveLogoLayout } from "@/lib/documents/logo-layout";
import { companyRequisiteLines } from "@/lib/paperwork/html";
import { tableColFractions } from "@/lib/paperwork/table-cols";
import { SIGN_MEDIA_MM } from "@/lib/documents/signature";


const MM = 72 / 25.4;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
/** Размер листа с учётом ориентации (альбомный — для ведомостей и табеля). */
const pageSize = (landscape: boolean) =>
  landscape ? { w: PAGE_H, h: PAGE_W } : { w: PAGE_W, h: PAGE_H };

const CYR = /[\u0400-\u04FF]/;

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  display: PDFFont;
  displayCyrillic: boolean;
  left: number;
  right: number;
  bottom: number;
  top: number;
  base: number;
  accent: ReturnType<typeof rgb>;
  blank: PwBlank;
  pages: PDFPage[];
  pageW: number;
  pageH: number;
};

const TEXT = rgb(0.11, 0.12, 0.14);
const MUTED = rgb(0.36, 0.39, 0.44);
const LINE = rgb(0.85, 0.87, 0.9);
const HEAD_BG = rgb(0.957, 0.961, 0.969);

const clean = (s: unknown): string =>
  String(s ?? "").replace(/\u00ad/g, "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "");

function dispFont(ctx: Ctx, text: string): PDFFont {
  if (ctx.displayCyrillic) return ctx.display;
  return CYR.test(text) ? ctx.bold : ctx.display;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([ctx.pageW, ctx.pageH]);
  ctx.pages.push(ctx.page);
  ctx.y = ctx.pageH - ctx.top;
  if (ctx.blank.accentBar) {
    ctx.page.drawRectangle({ x: 0, y: ctx.pageH - 5, width: ctx.pageW, height: 5, color: ctx.accent });
  }
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < ctx.bottom) newPage(ctx);
}

function contentWidth(ctx: Ctx): number {
  return ctx.right - ctx.left;
}

function drawLines(
  ctx: Ctx,
  lines: string[],
  opts: { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; align?: string; indentFirst?: number; x?: number; width?: number },
) {
  const width = opts.width ?? contentWidth(ctx);
  const x0 = opts.x ?? ctx.left;
  const lh = opts.size * 1.42;
  lines.forEach((line, i) => {
    ensure(ctx, lh);
    let x = x0 + (i === 0 ? (opts.indentFirst ?? 0) : 0);
    if (opts.align === "center" || opts.align === "right") {
      const w = opts.font.widthOfTextAtSize(line, opts.size);
      x = opts.align === "center" ? x0 + (width - w) / 2 : x0 + width - w;
    }
    ctx.page.drawText(line, { x, y: ctx.y - opts.size, size: opts.size, font: opts.font, color: opts.color ?? TEXT });
    ctx.y -= lh;
  });
}

function paragraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; align?: string; color?: ReturnType<typeof rgb>; indent?: boolean; font?: PDFFont } = {},
) {
  const size = opts.size ?? ctx.base;
  const font = opts.font ?? (opts.bold ? ctx.bold : ctx.regular);
  const indentFirst = opts.indent ? 8 * MM : 0;
  for (const para of clean(text).split("\n")) {
    if (!para.trim()) {
      ctx.y -= size * 0.9;
      continue;
    }
    const lines = wrapText(font, para, size, contentWidth(ctx) - indentFirst);
    drawLines(ctx, lines, { font, size, color: opts.color, align: opts.align, indentFirst });
  }
}

/* --------------------------------- Шапка --------------------------------- */

async function drawHeader(
  ctx: Ctx,
  company: CompanyProfile | null,
  logo: PDFImage | null,
  clientLogo: PDFImage | null,
) {
  if (ctx.blank.headerLayout === "none") return;
  const startY = ctx.y;
  const centered = ctx.blank.headerLayout === "logo-center";
  const rightSide = ctx.blank.headerLayout === "logo-right";
  const align = centered ? "center" : rightSide ? "right" : "left";

  // Логотип клиента — компактный блок у противоположного края шапки.
  let clW = 0;
  let clH = 0;
  if (clientLogo && ctx.blank.clientLogo) {
    const k = Math.min((40 * MM) / clientLogo.width, (16 * MM) / clientLogo.height, 1);
    clW = clientLogo.width * k;
    clH = clientLogo.height * k;
  }

  // Размер логотипа компании — тем же авто-движком, что в КП.
  const aspect = logo ? logo.width / logo.height : 3;
  const layout = resolveLogoLayout({ ...ctx.blank.logoLayout, align }, aspect);
  const colW = Math.max(60, contentWidth(ctx) - (clW ? clW + 14 : 0));
  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const boxW = Math.min(layout.maxW, colW);
    logoH = Math.min(boxW / aspect, layout.maxH);
    logoW = logoH * aspect;
  }

  const reqLines = ctx.blank.headerRequisites ? companyRequisiteLines(company) : [];
  const reqSize = requisitesFontPt(Math.max(7.5, ctx.base - 2.5), reqLines.join(" "), colW);
  const wrapped = reqLines.flatMap((l) => wrapText(ctx.regular, l, reqSize, colW));

  // Горизонтальные координаты колонки бренда.
  const colLeft = centered ? ctx.left : rightSide ? ctx.left + (clW ? clW + 14 : 0) : ctx.left;
  const colRight = colLeft + colW;
  const posX = (w: number) =>
    centered ? ctx.left + (contentWidth(ctx) - w) / 2 : rightSide ? colRight - w : colLeft;

  let y = startY;
  if (logo) {
    ctx.page.drawImage(logo, { x: posX(logoW), y: y - logoH, width: logoW, height: logoH });
    y -= logoH + Math.max(4, layout.gap * 0.5);
  } else if (company) {
    const brand = company.company_brand || company.company_legal_name;
    const size = 15;
    const font = dispFont(ctx, brand);
    ctx.page.drawText(clean(brand), {
      x: posX(font.widthOfTextAtSize(clean(brand), size)),
      y: y - size,
      size,
      font,
      color: ctx.accent,
    });
    y -= size + 6;
  }

  for (const line of wrapped) {
    const w = ctx.regular.widthOfTextAtSize(line, reqSize);
    ctx.page.drawText(line, {
      x: posX(w),
      y: y - reqSize,
      size: reqSize,
      font: ctx.regular,
      color: MUTED,
    });
    y -= reqSize * 1.35;
  }

  if (clientLogo && clW) {
    const cx = rightSide ? ctx.left : ctx.right - clW;
    ctx.page.drawImage(clientLogo, { x: cx, y: startY - clH, width: clW, height: clH });
  }

  ctx.y = Math.min(y, startY - clH) - 8;

  ctx.page.drawLine({
    start: { x: ctx.left, y: ctx.y },
    end: { x: ctx.right, y: ctx.y },
    thickness: 0.6,
    color: LINE,
  });
  ctx.y -= 14;
}

/* -------------------------------- Таблица -------------------------------- */

function drawTable(ctx: Ctx, block: PwBlock) {
  const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length), 1);
  const total = contentWidth(ctx);
  // Ширины по содержимому — тот же расчёт, что в превью и DOCX.
  const fractions = tableColFractions(block.header, block.rows, cols);
  const widths = fractions.map((f) => f * total);
  const offsets = widths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + widths[i - 1]!);
    return acc;
  }, []);
  const size = Math.max(7.5, ctx.base - 1);
  const pad = 5;

  const cellLines = (text: string, font: PDFFont, w: number) =>
    wrapText(font, clean(text), size, Math.max(size, w - pad * 2));

  const drawRow = (cells: string[], isHead: boolean) => {
    const font = isHead ? ctx.bold : ctx.regular;
    const lines = Array.from({ length: cols }, (_, i) => cellLines(cells[i] ?? "", font, widths[i]!));
    const h = Math.max(...lines.map((l) => l.length)) * size * 1.32 + pad * 2;
    ensure(ctx, h);
    const top = ctx.y;
    if (isHead) {
      ctx.page.drawRectangle({ x: ctx.left, y: top - h, width: total, height: h, color: HEAD_BG });
    }
    for (let i = 0; i < cols; i++) {
      const x = ctx.left + offsets[i]!;
      ctx.page.drawRectangle({
        x,
        y: top - h,
        width: widths[i]!,
        height: h,
        borderColor: LINE,
        borderWidth: 0.6,
      });
      let ty = top - pad;
      for (const line of lines[i]) {
        ctx.page.drawText(line, { x: x + pad, y: ty - size, size, font, color: TEXT });
        ty -= size * 1.32;
      }
    }
    ctx.y = top - h;
  };

  if (block.header.length) drawRow(block.header, true);
  for (const row of block.rows) drawRow(row, false);
  ctx.y -= 8;
}


/* -------------------------------- Подпись -------------------------------- */

function drawSignature(ctx: Ctx, block: PwBlock, sig: PDFImage | null, stamp: PDFImage | null) {
  ensure(ctx, 60);
  ctx.y -= 10;
  const size = ctx.base;
  const baseY = ctx.y - size;
  const title = clean(block.signerTitle);
  const name = clean(block.signerName);
  ctx.page.drawText(title, { x: ctx.left, y: baseY, size, font: ctx.regular, color: TEXT });
  const lineX1 = ctx.left + 55 * MM;
  const lineX2 = ctx.right - 55 * MM;
  ctx.page.drawLine({
    start: { x: lineX1, y: baseY - 1 },
    end: { x: lineX2, y: baseY - 1 },
    thickness: 0.6,
    color: rgb(0.6, 0.63, 0.68),
  });
  const nameW = ctx.regular.widthOfTextAtSize(name, size);
  ctx.page.drawText(name, { x: ctx.right - nameW, y: baseY, size, font: ctx.regular, color: TEXT });

  if (block.withSignature && sig) {
    const h = SIGN_MEDIA_MM.signatureH * MM;
    const k = h / sig.height;
    ctx.page.drawImage(sig, { x: lineX1 + 6, y: baseY + SIGN_MEDIA_MM.signatureLift, width: sig.width * k, height: h, opacity: 0.95 });
  }
  if (block.withStamp && stamp) {
    const h = SIGN_MEDIA_MM.stampH * MM;
    const k = h / stamp.height;
    ctx.page.drawImage(stamp, {
      x: lineX1 + SIGN_MEDIA_MM.stampOffsetX * MM,
      y: baseY - h * SIGN_MEDIA_MM.stampOverlap,
      width: stamp.width * k,
      height: h,
      opacity: 0.85,
    });
  }
  ctx.y = baseY - 22;
}

/* --------------------------------- Сборка --------------------------------- */

type PwPdfOpts = {
  doc: Pick<PwDocument, "title" | "doc_number" | "doc_date">;
  blocks: PwBlock[];
  company: CompanyProfile | null;
  blank: PwBlank;
  clientLogoUrl?: string | null;
  /** Альбомный лист A4. */
  landscape?: boolean;
};

/**
 * Один проход вёрстки. Возвращает файл и число страниц — по нему решаем,
 * нужно ли пересобрать документ со сжатием, чтобы уместить его на один лист.
 */
async function renderPaperworkPdf(opts: PwPdfOpts): Promise<{ bytes: Uint8Array; pages: number }> {
  const { doc, blocks, company, blank } = opts;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const set = pdfFontSet(blank.font);
  const regular = await pdf.embedFont(set.regular, { subset: true });
  const bold = await pdf.embedFont(set.bold, { subset: true });
  const display = await pdf.embedFont(set.display, { subset: true });

  const pg = pageSize(opts.landscape === true);
  const a = hexToRgb01(blank.accentColor || "#FF7500");
  const ctx: Ctx = {
    pdf,
    page: null as unknown as PDFPage,
    y: 0,
    regular,
    bold,
    display,
    displayCyrillic: set.displayCyrillic,
    left: blank.marginXMm * MM,
    right: pg.w - blank.marginXMm * MM,
    top: blank.marginTopMm * MM,
    bottom: blank.marginBottomMm * MM,
    base: blank.fontSizePt,
    accent: rgb(a.r, a.g, a.b),
    blank,
    pages: [],
    pageW: pg.w,
    pageH: pg.h,
  };
  newPage(ctx);

  const [logo, sig, stamp, bg, clientLogo] = await Promise.all([
    embedImageUrl(pdf, company?.logo_url ?? null),
    embedImageUrl(pdf, company?.signature_url ?? null),
    embedImageUrl(pdf, company?.stamp_url ?? null),
    embedImageUrl(pdf, blank.backgroundUrl),
    embedImageUrl(pdf, opts.clientLogoUrl ?? null),
  ]);

  if (bg) {
    const w = 120 * MM;
    const h = (bg.height / bg.width) * w;
    ctx.page.drawImage(bg, {
      x: (ctx.pageW - w) / 2,
      y: (ctx.pageH - h) / 2,
      width: w,
      height: h,
      opacity: blank.backgroundOpacity,
    });
  }

  await drawHeader(ctx, company, logo, clientLogo);

  // Номер и дата
  const dateLabel = (() => {
    const d = new Date(`${doc.doc_date}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? doc.doc_date
      : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  })();
  const metaSize = Math.max(8, ctx.base - 1.5);
  ensure(ctx, metaSize * 2);
  if (doc.doc_number) {
    ctx.page.drawText(`№ ${clean(doc.doc_number)}`, {
      x: ctx.left,
      y: ctx.y - metaSize,
      size: metaSize,
      font: ctx.regular,
      color: MUTED,
    });
  }
  const dw = ctx.regular.widthOfTextAtSize(clean(dateLabel), metaSize);
  ctx.page.drawText(clean(dateLabel), {
    x: ctx.right - dw,
    y: ctx.y - metaSize,
    size: metaSize,
    font: ctx.regular,
    color: MUTED,
  });
  ctx.y -= metaSize * 2.2;

  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        ctx.y -= 6;
        const font = dispFont(ctx, b.text);
        paragraph(ctx, b.text, { size: ctx.base + 2.5, align: b.align, font });
        ctx.y -= 4;
        break;
      }
      case "recipient":
        paragraph(ctx, b.text, { size: ctx.base - 0.5, align: b.align || "right" });
        ctx.y -= 8;
        break;
      case "note": {
        const size = Math.max(8, ctx.base - 1.5);
        const lines = clean(b.text)
          .split("\n")
          .flatMap((l) => wrapText(ctx.regular, l, size, contentWidth(ctx) - 16));
        const h = lines.length * size * 1.4 + 12;
        ensure(ctx, h);
        const top = ctx.y;
        ctx.page.drawRectangle({ x: ctx.left, y: top - h, width: contentWidth(ctx), height: h, color: HEAD_BG });
        ctx.page.drawRectangle({ x: ctx.left, y: top - h, width: 2.5, height: h, color: ctx.accent });
        let ty = top - 6;
        for (const line of lines) {
          ctx.page.drawText(line, { x: ctx.left + 10, y: ty - size, size, font: ctx.regular, color: MUTED });
          ty -= size * 1.4;
        }
        ctx.y = top - h - 8;
        break;
      }
      case "list": {
        const size = ctx.base;
        b.items.forEach((item, i) => {
          const marker = b.ordered ? `${i + 1}.` : "•";
          const mw = ctx.regular.widthOfTextAtSize(`${marker} `, size);
          const lines = wrapText(ctx.regular, clean(item), size, contentWidth(ctx) - mw - 6 * MM);
          lines.forEach((line, li) => {
            ensure(ctx, size * 1.42);
            if (li === 0) {
              ctx.page.drawText(marker, { x: ctx.left + 4 * MM, y: ctx.y - size, size, font: ctx.regular, color: TEXT });
            }
            ctx.page.drawText(line, {
              x: ctx.left + 4 * MM + mw,
              y: ctx.y - size,
              size,
              font: ctx.regular,
              color: TEXT,
            });
            ctx.y -= size * 1.42;
          });
        });
        ctx.y -= 6;
        break;
      }
      case "table":
        drawTable(ctx, b);
        break;
      case "lineitems": {
        const t = blockTotals(b);
        drawTable(ctx, {
          ...b,
          header: ["№", "Наименование", "Кол-во", "Ед.", "Цена", "Сумма"],
          rows: b.lines.map((l, i) => [
            String(i + 1),
            l.name,
            String(l.qty),
            l.unit,
            formatMoney(l.price),
            formatMoney(lineTotal(l)),
          ]),
        });
        const size = Math.max(8, ctx.base - 0.5);
        const totalLines = [
          `Итого без НДС: ${formatMoney(t.net)} ${b.currency}`,
          ...(b.vatPct > 0 ? [`НДС ${b.vatPct}%: ${formatMoney(t.vat)} ${b.currency}`] : []),
          `Всего к оплате: ${formatMoney(t.gross)} ${b.currency}`,
        ];
        for (const line of totalLines) {
          ensure(ctx, size * 1.5);
          const isLast = line === totalLines[totalLines.length - 1];
          const font = isLast ? ctx.bold : ctx.regular;
          const w = font.widthOfTextAtSize(clean(line), size);
          ctx.page.drawText(clean(line), { x: ctx.right - w, y: ctx.y - size, size, font, color: TEXT });
          ctx.y -= size * 1.5;
        }
        if (b.totalWords) {
          ctx.y -= 2;
          paragraph(ctx, `Сумма прописью: ${t.words}`, {
            size: Math.max(8, ctx.base - 1),
          });
        }
        ctx.y -= 6;
        break;
      }
      case "parties": {
        const size = Math.max(8, ctx.base - 1);
        const colW = (contentWidth(ctx) - 8 * MM) / 2;
        const cols: { title: string; text: string; x: number }[] = [
          { title: b.leftTitle, text: b.leftText, x: ctx.left },
          { title: b.rightTitle, text: b.rightText, x: ctx.left + colW + 8 * MM },
        ];
        const wrapped = cols.map((c) => [
          ...(c.title ? [clean(c.title)] : []),
          ...clean(c.text).split("\n").flatMap((l) => wrapText(ctx.regular, l, size, colW)),
        ]);
        const h = Math.max(...wrapped.map((w) => w.length)) * size * 1.4 + 8;
        ensure(ctx, h);
        const top = ctx.y;
        cols.forEach((c, ci) => {
          let ty = top;
          wrapped[ci].forEach((line, li) => {
            const font = li === 0 && c.title ? ctx.bold : ctx.regular;
            ctx.page.drawText(line, { x: c.x, y: ty - size, size, font, color: TEXT });
            ty -= size * 1.4;
          });
        });
        ctx.y = top - h;
        break;
      }
      case "signature":
        drawSignature(ctx, b, sig, stamp);
        break;
      case "spacer":
        ctx.y -= b.size;
        break;
      default:
        paragraph(ctx, b.text, { align: b.align, indent: b.indent });
        ctx.y -= 4;
    }
  }

  // Футер и нумерация на всех страницах
  const footerText =
    blank.footerText ||
    [company?.company_legal_name, company?.company_address, company?.company_phone]
      .filter(Boolean)
      .join(" · ");
  const fSize = 7.5;
  ctx.pages.forEach((page, i) => {
    const y = ctx.bottom - 14;
    if (blank.footer && footerText) {
      const lines = wrapText(regular, clean(footerText), fSize, contentWidth(ctx));
      const line = lines[0] ?? "";
      const w = regular.widthOfTextAtSize(line, fSize);
      page.drawText(line, { x: (ctx.pageW - w) / 2, y, size: fSize, font: regular, color: MUTED });
    }
    if (ctx.pages.length > 1) {
      const label = `${i + 1} / ${ctx.pages.length}`;
      const w = regular.widthOfTextAtSize(label, fSize);
      page.drawText(label, { x: ctx.pageW - ctx.blank.marginXMm * MM - w, y, size: fSize, font: regular, color: MUTED });
    }
  });

  return { bytes: await pdf.save(), pages: ctx.pages.length };
}

export async function buildPaperworkPdf(opts: PwPdfOpts): Promise<Uint8Array> {
  // Первый проход — с уже оценённой подгонкой (тот же расчёт, что в превью).
  const fitted = fittedBlank(opts.blocks, opts.blank, opts.landscape === true);
  const first = await renderPaperworkPdf({ ...opts, blank: fitted });
  if (first.pages <= 1 || opts.blank.fitOnePage === false) return first.bytes;
  // Реальная вёрстка переполнилась на одну страницу — пробуем дожать.
  if (first.pages > 2) return first.bytes;
  for (const k of PDF_FIT_STEPS) {
    const blank = shrinkBlank(opts.blank, k);
    if (blank.fontSizePt < MIN_FONT_PT) break;
    const r = await renderPaperworkPdf({ ...opts, blank });
    if (r.pages <= 1) return r.bytes;
  }
  return first.bytes;
}
