// PDF-генератор документов заказа (КП / Счёт / Договор / Акт).
// Используется только server-side. Рендерит pdf-lib + кастомные TTF
// (Inter Regular/Bold + Space Grotesk Bold — те же шрифты, что и в HTML-превью);
// кириллица в Standard 14 шрифтах PDF не работает, поэтому встраиваем TTF
// подмножеством (subset:true).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { DocOrder, DocItem, DocKind } from "@/lib/documents/build.server";
import { fmtDate } from "@/lib/formatters";
import { computeVat, vatConfig, vatRateLabel } from "@/lib/documents/vat";
import {
  BRAND_ACCENT,
  DOC_COLORS,
  DOC_FONT_PT,
  DOC_LAYOUT,
  hexToRgb01,
  mixWithWhite,
} from "@/lib/documents/brand";
import {
  BASE_PRINT_PRESET,
  mmToPt,
  resolvePrintPreset,
  type DocPrintPreset,
} from "@/lib/documents/print-preset";
import {
  DEFAULT_LOGO_LAYOUT,
  computeLogoPlacement,
  normalizeLogoLayout,
  type LogoLayout,
} from "@/lib/documents/logo-layout";

import {
  computePromoTotals,
  groupBySection,
  formatTotalQty,
  formatNumber,
  hasSecondUnit,
  isServiceOnlyRow,
  rateUnitLabel,
  lineTotal,
  promoNumberDisplay,
  type PromoItem as PromoItemT,
  type PromoQuote as PromoQuoteT,
} from "@/lib/promo-quote-model";

import { PRICE_LABEL } from "@/lib/documents/doc-layout";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { resolveDocFont, type DocFont } from "@/lib/documents/doc-font";

// Шрифты встроены в бандл (subset латиница+кириллица). Раньше они качались
// по сети с публичного адреса того же воркера — такой self-subrequest иногда
// зависал, и Cloudflare убивал запрос с 502.

/** В Space Grotesk нет кириллицы — для неё используем Bold основного шрифта. */
const CYRILLIC = /[\u0400-\u04FF]/;
function displayFont(ctx: DocCtx, text: string): PDFFont {
  if (ctx.displayCyrillic) return ctx.display;
  return CYRILLIC.test(text) ? ctx.bold : ctx.display;
}




// === Стили / токены — единая спецификация с HTML-превью (documents/brand.ts) ===
const c01 = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);

const ACCENT = c01(hexToRgb01(BRAND_ACCENT));
const ACCENT_SOFT = c01(mixWithWhite(BRAND_ACCENT, 0.12));   // фон шапки таблицы / итога
const ACCENT_BORDER = c01(mixWithWhite(BRAND_ACCENT, 0.4));  // рамка блока итогов
const TEXT = c01(hexToRgb01(DOC_COLORS.ink));
const MUTED = c01(hexToRgb01(DOC_COLORS.muted));
const LINE = c01(hexToRgb01(DOC_COLORS.line));
const SURFACE = c01(hexToRgb01(DOC_COLORS.surface));

// A4 в pt (72 dpi)
const PAGE_W = DOC_LAYOUT.pageWidthPt;
const PAGE_H = DOC_LAYOUT.pageHeightPt;
let MARGIN_X: number = DOC_LAYOUT.marginXPt;
let MARGIN_TOP: number = DOC_LAYOUT.marginTopPt;
let MARGIN_BOTTOM: number = DOC_LAYOUT.marginBottomPt;

// Межстрочные интервалы и множители отступов — задаются пресетом печати.
let LH: number = DOC_LAYOUT.lineHeight;       // базовый интервал (таблица, плотный текст)
let LH_TEXT = LH + 0.05;              // обычный текст
let LH_LOOSE = LH + 0.15;             // абзацы / карточки
let LH_TOTAL = LH + 0.2;              // строки блока «итого»
let LH_TIGHT = Math.max(1.05, LH - 0.1); // крупные заголовки
let GAP_K = 1;                        // множитель отступов между блоками
let ROW_K = 1;                        // множитель высоты строк таблицы
let FONT_K = 1;                       // множитель кеглей

// Кегли: те же, что в HTML-превью, переведённые в pt.
// Плотность (density) позволяет уплотнить документ, чтобы он влез в меньшее
// число листов: 1 = «комфортно» (как превью), 0.94 = «компактно», 0.88 = «плотно».
import { DOC_DENSITY_SCALE, DOC_DENSITY_LADDER, type DocDensity } from "@/lib/documents/density";
export { DOC_DENSITY_SCALE, type DocDensity };



/** Текущий множитель плотности (отступы, высоты строк). */
let D = 1;

let F11 = DOC_FONT_PT.small;
let F12 = DOC_FONT_PT.body;
let F13 = DOC_FONT_PT.section;
let F16 = DOC_FONT_PT.total;
let F22 = DOC_FONT_PT.brand;
let F_COVER = DOC_FONT_PT.coverTitle;
let F_DOC_KIND = DOC_FONT_PT.docKind;
let F_DOC_NUM = DOC_FONT_PT.docNum;
let F_DOC_DATE = DOC_FONT_PT.docDate;
let F_LABEL = DOC_FONT_PT.cardLabel;
let F_FOOTER = DOC_FONT_PT.footer;

/** Пересчитать шкалу кеглей и отступов под выбранную плотность. */
function applyDensity(density: DocDensity, preset: DocPrintPreset = BASE_PRINT_PRESET) {
  const k = DOC_DENSITY_SCALE[density];
  D = k;
  MARGIN_X = mmToPt(preset.marginXMm);
  MARGIN_TOP = mmToPt(preset.marginTopMm);
  MARGIN_BOTTOM = mmToPt(preset.marginBottomMm);
  LH = preset.lineHeight;
  LH_TEXT = LH + 0.05;
  LH_LOOSE = LH + 0.15;
  LH_TOTAL = LH + 0.2;
  LH_TIGHT = Math.max(1.05, LH - 0.1);
  GAP_K = preset.blockGap;
  ROW_K = preset.rowGap;
  FONT_K = preset.fontScale;
  const s = (v: number) => Math.round(v * (0.5 + k / 2) * FONT_K * 10) / 10; // кегли ужимаем мягче отступов
  F11 = s(DOC_FONT_PT.small);
  F12 = s(DOC_FONT_PT.body);
  F13 = s(DOC_FONT_PT.section);
  F16 = s(DOC_FONT_PT.total);
  F22 = s(DOC_FONT_PT.brand);
  F_COVER = s(DOC_FONT_PT.coverTitle);
  F_DOC_KIND = s(DOC_FONT_PT.docKind);
  F_DOC_NUM = s(DOC_FONT_PT.docNum);
  F_DOC_DATE = s(DOC_FONT_PT.docDate);
  F_LABEL = s(DOC_FONT_PT.cardLabel);
  F_FOOTER = s(DOC_FONT_PT.footer);
}


type FittedLogo = { img: PDFImage; w: number; h: number; aspect: number };

type DocCtx = {
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
const HEADER_LOGO_MAX_H = DEFAULT_LOGO_LAYOUT.maxH;
const HEADER_LOGO_MAX_W = DEFAULT_LOGO_LAYOUT.maxW;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

/**
 * Загружает логотип по URL и встраивает в PDF, вписывая в бокс maxW×maxH.
 * Ошибки сети/формата не ломают документ — логотип просто не рисуется.
 */
async function embedLogo(
  pdf: PDFDocument,
  url: string | null | undefined,
  maxW = HEADER_LOGO_MAX_W,
  maxH = HEADER_LOGO_MAX_H,
): Promise<FittedLogo | null> {
  const src = (url ?? "").trim();
  if (!src || !/^https?:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > MAX_LOGO_BYTES) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpg) return null; // SVG/WebP нормализуются в PNG на клиенте
    const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const k = Math.min(maxW / img.width, maxH / img.height);
    return { img, w: img.width * k, h: img.height * k, aspect: img.width / img.height };
  } catch {
    return null;
  }
}



function money(n: number): string {
  // Intl.NumberFormat в воркере доступен; не используем символ валюты в
  // префиксе — выводим явно "BYN".
  const fmt = new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${fmt} BYN`;
}

function safe(s: unknown): string {
  return String(s ?? "").replace(/\s+\n/g, "\n").trim();
}

/** Прямоугольник со скруглением (pdf-lib умеет только через path). */
function roundedRect(
  page: PDFPage,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    color?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
  },
) {
  const r = Math.max(0, Math.min(opts.radius ?? 6, opts.width / 2, opts.height / 2));
  const { x, width: w, height: h } = opts;
  // drawSvgPath использует SVG-координаты (ось Y вниз): передаём -y, чтобы
  // путь совпал с обычной системой координат PDF.
  const y = -opts.y;
  const k = 0.5523 * r;
  const d = [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `C ${x + w - r + k} ${y} ${x + w} ${y - r + k} ${x + w} ${y - r}`,
    `L ${x + w} ${y - h + r}`,
    `C ${x + w} ${y - h + r - k} ${x + w - r + k} ${y - h} ${x + w - r} ${y - h}`,
    `L ${x + r} ${y - h}`,
    `C ${x + r - k} ${y - h} ${x} ${y - h + r - k} ${x} ${y - h + r}`,
    `L ${x} ${y - r}`,
    `C ${x} ${y - r + k} ${x + r - k} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
  page.drawSvgPath(d, {
    x: 0,
    y: 0,
    ...(opts.color ? { color: opts.color } : {}),
    ...(opts.borderColor ? { borderColor: opts.borderColor } : {}),
    borderWidth: opts.borderWidth ?? 0,
    scale: 1,
  });

}

/** Верхняя акцентная полоса — как градиент в HTML-превью (набор сегментов). */
function drawTopBar(page: PDFPage) {
  const w = PAGE_W - MARGIN_X * 2;
  const y = PAGE_H - MARGIN_TOP + 14;
  const steps = 24;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const c = c01(mixWithWhite(BRAND_ACCENT, t * 0.55));
    page.drawRectangle({
      x: MARGIN_X + (w / steps) * i,
      y,
      width: w / steps + 0.6,
      height: 3.2,
      color: c,
    });
  }
}

function newPage(ctx: DocCtx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  ctx.y = PAGE_H - MARGIN_TOP;
  drawTopBar(ctx.page);
}

function ensureSpace(ctx: DocCtx, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) newPage(ctx);
}


function drawText(
  ctx: DocCtx,
  text: string,
  opts: {
    x?: number;
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right" | "center";
    width?: number; // для align right/center
  } = {},
) {
  const size = opts.size ?? F12;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const color = opts.color ?? TEXT;
  const txt = safe(text);
  const lines = txt.split("\n");
  for (const line of lines) {
    ensureSpace(ctx, size * LH_LOOSE);
    let x = opts.x ?? MARGIN_X;
    if (opts.align && opts.width) {
      const w = font.widthOfTextAtSize(line, size);
      if (opts.align === "right") x = (opts.x ?? MARGIN_X) + opts.width - w;
      else if (opts.align === "center") x = (opts.x ?? MARGIN_X) + (opts.width - w) / 2;
    }
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size * LH_TEXT;
  }
}

// Перенос длинной строки по ширине
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) line = cand;
    else {
      if (line) out.push(line);
      // одиночное длинное слово — режем посимвольно
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let cur = "";
        for (const ch of w) {
          const cn = cur + ch;
          if (font.widthOfTextAtSize(cn, size) > maxWidth) {
            out.push(cur);
            cur = ch;
          } else cur = cn;
        }
        line = cur;
      } else line = w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

function drawParagraph(
  ctx: DocCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {},
) {
  const size = opts.size ?? F12;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const color = opts.color ?? TEXT;
  const indent = opts.indent ?? 0;
  const maxW = PAGE_W - MARGIN_X * 2 - indent;
  const paragraphs = safe(text).split("\n");
  for (const p of paragraphs) {
    const lines = wrapText(font, p, size, maxW);
    for (const line of lines) {
      ensureSpace(ctx, size * LH_LOOSE);
      ctx.page.drawText(line, { x: MARGIN_X + indent, y: ctx.y - size, size, font, color });
      ctx.y -= size * LH_LOOSE;
    }
  }
}

/**
 * Финальное примечание (условия/срок действия). В отличие от drawParagraph
 * не переносится на новую страницу из-за пары строк: сначала пробуем ужать
 * кегль и занять нижнее поле до линии футера.
 */
function drawTrailingNote(
  ctx: DocCtx,
  text: string,
  opts: { size?: number; color?: ReturnType<typeof rgb> } = {},
) {
  const clean = safe(text).trim();
  if (!clean) return;
  const base = opts.size ?? 9.5;
  const color = opts.color ?? MUTED;
  const maxW = PAGE_W - MARGIN_X * 2;
  const floor = MARGIN_BOTTOM - 6; // чуть выше линии футера
  for (const size of [base, base - 0.5, base - 1, base - 1.5]) {
    if (size < 7.5) break;
    const lines = wrapText(ctx.regular, clean, size, maxW);
    const h = lines.length * size * LH_TEXT;
    if (ctx.y - h < floor) continue;
    for (const line of lines) {
      ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y - size, size, font: ctx.regular, color });
      ctx.y -= size * LH_TEXT;
    }
    return;
  }
  drawParagraph(ctx, clean, { size: base, color });
}

function divider(ctx: DocCtx, color = LINE) {
  ensureSpace(ctx, 8);
  ctx.y -= 4;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.6,
    color,
  });
  ctx.y -= 8;
}

function gap(ctx: DocCtx, n: number) {
  ctx.y -= n * D * GAP_K;
}


/** Ширина строки с межбуквенным интервалом (как letter-spacing в CSS). */
function trackedWidth(font: PDFFont, text: string, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + Math.max(text.length - 1, 0) * tracking;
}

/** Отрисовать строку капсом с межбуквенным интервалом. */
function drawTracked(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; tracking: number },
) {
  let x = opts.x;
  for (const ch of text) {
    page.drawText(ch, { x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
    x += opts.font.widthOfTextAtSize(ch, opts.size) + opts.tracking;
  }
}

function drawHeader(
  ctx: DocCtx,
  kind: string,
  num: string,
  date: string,
  settings: DocumentSettings,
  extra: { validUntil?: string } = {},
) {
  // Логотип — позиция, размер и отступы задаются в настройках документа
  const logo = ctx.logo ?? null;
  const layout = ctx.logoLayout ?? DEFAULT_LOGO_LAYOUT;
  const place = logo ? computeLogoPlacement(layout, logo.aspect) : null;
  const leftX: number = MARGIN_X;
  if (logo && place) {
    ctx.page.drawImage(logo.img, {
      x: place.x,
      y: PAGE_H - MARGIN_TOP - place.top - place.h + 2,
      width: place.w,
      height: place.h,
    });
  }

  // Тип/номер/дата справа — считаем первыми, чтобы знать ширину левой колонки
  const rightX = PAGE_W - MARGIN_X;
  const kindUpper = kind.toUpperCase();
  const kindTracking = F_DOC_KIND * 0.14;
  const kindW = trackedWidth(ctx.bold, kindUpper, F_DOC_KIND, kindTracking);
  const numText = `№ ${num}`;
  const numFont = displayFont(ctx, numText);
  const numW = numFont.widthOfTextAtSize(numText, F_DOC_NUM);
  const dateText = `от ${date}`;
  const dateW = ctx.regular.widthOfTextAtSize(dateText, F_DOC_DATE);
  const validText = extra.validUntil ? `действительно до ${extra.validUntil}` : "";
  const validW = validText ? ctx.regular.widthOfTextAtSize(validText, F_DOC_DATE) : 0;
  const rightBlockW = Math.max(kindW, numW, dateW, validW);
  const rightBlockH = validText ? 60 : 46;

  // Текстовый блок (бренд + реквизиты) — всегда под логотипом, выравнивание как у логотипа.
  const textAlign = place ? place.textAlign : "left";
  const textTop = place ? place.textTop : 0;
  // Пока текст идёт вровень с правой колонкой — ограничиваем ширину, ниже неё занимаем всю строку.
  const textMaxW =
    textTop < rightBlockH
      ? Math.max(120, rightX - rightBlockW - 20 - leftX)
      : rightX - leftX;
  const alignedX = (lineW: number) =>
    textAlign === "center"
      ? leftX + (textMaxW - lineW) / 2
      : textAlign === "right"
        ? leftX + textMaxW - lineW
        : leftX;

  // Бренд — дисплейным шрифтом, как в HTML-превью.
  // Логотип заменяет текстовое название бренда: пишем бренд только когда логотипа нет.
  const brand = safe(settings.company_brand);
  const showBrand = !logo;
  let textY = PAGE_H - MARGIN_TOP - textTop;
  if (showBrand) {
    const bFont = displayFont(ctx, brand);
    textY -= F22 * 0.8;
    ctx.page.drawText(brand, {
      x: alignedX(bFont.widthOfTextAtSize(brand, F22)),
      y: textY,
      size: F22,
      font: bFont,
      color: TEXT,
    });
    textY -= 14;
  } else {
    textY -= DOC_FONT_PT.small;
  }

  // Юрлицо + УНП и адрес — двумя строками, с переносом по ширине колонки
  const legalLine = `${safe(settings.company_legal_name)}${
    safe(settings.company_unp) ? ` · УНП ${safe(settings.company_unp)}` : ""
  }`;
  const subLines = [
    ...wrapText(ctx.regular, legalLine, DOC_FONT_PT.small, textMaxW),
    ...wrapText(ctx.regular, safe(settings.company_address), DOC_FONT_PT.small, textMaxW),
  ].filter((l) => l.trim() !== "");
  let subY = textY;
  for (const line of subLines) {
    ctx.page.drawText(line, {
      x: alignedX(ctx.regular.widthOfTextAtSize(line, DOC_FONT_PT.small)),
      y: subY,
      size: DOC_FONT_PT.small,
      font: ctx.regular,
      color: MUTED,
    });
    subY -= DOC_FONT_PT.small * LH_TEXT;
  }


  drawTracked(ctx.page, kindUpper, {
    x: rightX - kindW,
    y: PAGE_H - MARGIN_TOP - 4,
    size: F_DOC_KIND,
    font: ctx.bold,
    color: ACCENT,
    tracking: kindTracking,
  });
  ctx.page.drawText(numText, {
    x: rightX - numW,
    y: PAGE_H - MARGIN_TOP - 24,
    size: F_DOC_NUM,
    font: numFont,
    color: TEXT,
  });
  ctx.page.drawText(dateText, {
    x: rightX - dateW,
    y: PAGE_H - MARGIN_TOP - 40,
    size: F_DOC_DATE,
    font: ctx.regular,
    color: MUTED,
  });
  if (validText) {
    ctx.page.drawText(validText, {
      x: rightX - validW,
      y: PAGE_H - MARGIN_TOP - 54,
      size: F_DOC_DATE,
      font: ctx.regular,
      color: MUTED,
    });
  }

  // Высокий логотип может «вылезти» ниже текста — учитываем это
  const leftBottom = PAGE_H - subY;
  ctx.y = PAGE_H - Math.max(MARGIN_TOP + (validText ? 66 : 58), leftBottom + 6, MARGIN_TOP + (place?.reserve ?? 0) + 14);
  divider(ctx);


  // Логотип клиента (промо-КП) — справа под разделителем
  const cl = ctx.clientLogo ?? null;
  if (cl) {
    ctx.y -= 6;
    ctx.page.drawImage(cl.img, {
      x: PAGE_W - MARGIN_X - cl.w,
      y: ctx.y - cl.h,
      width: cl.w,
      height: cl.h,
    });
    ctx.y -= cl.h + 6;
  }
}


function drawFooter(ctx: DocCtx, settings: DocumentSettings) {
  const footer = `${settings.company_legal_name} · ${settings.company_phone} · ${settings.company_email} · ${settings.company_website}`;
  const total = ctx.pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = ctx.pdf.getPage(i);
    p.drawLine({
      start: { x: MARGIN_X, y: MARGIN_BOTTOM - 12 },
      end: { x: PAGE_W - MARGIN_X, y: MARGIN_BOTTOM - 12 },
      thickness: 0.4,
      color: LINE,
    });
    p.drawText(safe(footer), {
      x: MARGIN_X,
      y: MARGIN_BOTTOM - 24,
      size: F_FOOTER,
      font: ctx.regular,
      color: MUTED,
    });
    const pageLabel = `${i + 1} / ${total}`;
    const w = ctx.regular.widthOfTextAtSize(pageLabel, F_FOOTER);
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN_X - w,
      y: MARGIN_BOTTOM - 24,
      size: F_FOOTER,
      font: ctx.regular,
      color: MUTED,
    });
  }
}

// Карточка-карман с тонкой границей и заголовком
function drawCard(
  ctx: DocCtx,
  label: string,
  title: string,
  lines: (string | null | undefined)[],
  opts: { x?: number; width?: number } = {},
) {
  const x = opts.x ?? MARGIN_X;
  const width = opts.width ?? PAGE_W - MARGIN_X * 2;
  const innerW = width - 24;
  const cleanLines = lines.filter((l): l is string => !!l && l.trim() !== "");

  // считаем нужную высоту
  const titleLines = wrapText(displayFont(ctx, title), title, F13, innerW);
  const bodyLineHeights = cleanLines.flatMap((l) => wrapText(ctx.regular, l, F11, innerW));
  const height = 14 + 14 + titleLines.length * (F13 * LH) + bodyLineHeights.length * (F11 * LH_TEXT) + 12;

  ensureSpace(ctx, height + 6);
  // фон карточки (скруглённые углы — как в превью)
  roundedRect(ctx.page, {
    x,
    y: ctx.y - height,
    width,
    height,
    radius: 10,
    color: SURFACE,
    borderColor: LINE,
    borderWidth: 0.6,
  });
  let cy = ctx.y - 14;
  drawTracked(ctx.page, label.toUpperCase(), {
    x: x + 12,
    y: cy - 9,
    size: F_LABEL,
    font: ctx.bold,
    color: ACCENT,
    tracking: F_LABEL * 0.12,
  });
  cy -= 18;
  for (const t of titleLines) {
    ctx.page.drawText(t, { x: x + 12, y: cy - F13, size: F13, font: displayFont(ctx, t), color: TEXT });
    cy -= F13 * LH;
  }

  cy -= 2;
  for (const l of bodyLineHeights) {
    ctx.page.drawText(l, { x: x + 12, y: cy - F11, size: F11, font: ctx.regular, color: MUTED });
    cy -= F11 * LH_TEXT;
  }
  ctx.y -= height + 6;
}

/**
 * Карточка с таблицей «ключ — значение» (как `.info-table` в HTML-превью):
 * подписи слева серым, значения справа. Используется для блока «Мероприятие»,
 * чтобы PDF совпадал с превью по подписям и сетке.
 */
function drawInfoCard(
  ctx: DocCtx,
  label: string,
  rows: Array<[string, string]>,
  note?: string | null,
  opts: { x?: number; width?: number } = {},
) {
  const x = opts.x ?? MARGIN_X;
  const width = opts.width ?? PAGE_W - MARGIN_X * 2;
  const innerW = width - 24;
  const keyW = Math.min(150, innerW * 0.38);
  const valW = innerW - keyW - 8;
  const clean = rows.filter(([, v]) => !!v && String(v).trim() !== "");
  const list: Array<[string, string]> = clean.length ? clean : [["Детали", "уточняются"]];

  const wrapped = list.map(([k, v]) => ({
    k,
    lines: wrapText(ctx.regular, v, F11, valW),
  }));
  const noteLines = note ? wrapText(ctx.regular, note, F11, innerW) : [];
  const rowsH = wrapped.reduce((s, r) => s + Math.max(1, r.lines.length) * F11 * LH_LOOSE, 0);
  const height =
    14 * D + 16 * D + rowsH + (noteLines.length ? 6 * D + noteLines.length * F11 * LH_TEXT : 0) + 12 * D;

  ensureSpace(ctx, height + 6 * D);
  roundedRect(ctx.page, {
    x,
    y: ctx.y - height,
    width,
    height,
    radius: 10,
    color: SURFACE,
    borderColor: LINE,
    borderWidth: 0.6,
  });

  let cy = ctx.y - 14 * D;
  drawTracked(ctx.page, label.toUpperCase(), {
    x: x + 12,
    y: cy - 9,
    size: F_LABEL,
    font: ctx.bold,
    color: ACCENT,
    tracking: F_LABEL * 0.12,
  });
  cy -= 16 * D;

  for (const r of wrapped) {
    ctx.page.drawText(r.k, { x: x + 12, y: cy - F11, size: F11, font: ctx.regular, color: MUTED });
    let vy = cy;
    for (const line of r.lines) {
      ctx.page.drawText(line, {
        x: x + 12 + keyW + 8,
        y: vy - F11,
        size: F11,
        font: ctx.bold,
        color: TEXT,
      });
      vy -= F11 * LH_LOOSE;
    }
    cy -= Math.max(1, r.lines.length) * F11 * LH_LOOSE;
  }

  if (noteLines.length) {
    cy -= 6 * D;
    for (const line of noteLines) {
      ctx.page.drawText(line, { x: x + 12, y: cy - F11, size: F11, font: ctx.regular, color: MUTED });
      cy -= F11 * LH_TEXT;
    }
  }

  ctx.y -= height + 6 * D;
}



// === Таблица позиций ===
type Col = {
  title: string;
  width: number;
  align?: "left" | "right" | "center";
  valign?: "top" | "middle";
  key: string;
};

/**
 * Строка таблицы. Служебные поля (с префиксом `_`) повторяют оформление
 * HTML-превью: заголовок раздела, подытог раздела, описание и список
 * «что входит» под названием позиции.
 */
type TableSpan = { from: string; to: string; text: string };

type TableRow = Record<string, string | string[] | TableSpan | undefined> & {
  _kind?: "section" | "subtotal";
  _desc?: string;
  _bullets?: string[];
  /** Объединение соседних колонок в одну ячейку (например «услуга»). */
  _span?: { from: string; to: string; text: string };
};

/**
 * Подгоняет ширины узких колонок под самый длинный текст, а остаток отдаёт
 * «Наименованию» и «Примечаниям» (примечаниям — большая доля).
 */
function fitTableCols(ctx: DocCtx, cols: Col[], rows: TableRow[], tableW: number) {
  const flexKeys = new Set(["title", "note"]);
  const pad = 20;
  const measured = new Map<string, number>();
  let narrow = 0;
  for (const c of cols) {
    if (flexKeys.has(c.key)) continue;
    let w = Math.max(
      ...c.title.toUpperCase().split(" ").map((word) => trackedWidth(ctx.bold, word, F_DOC_KIND, F_DOC_KIND * 0.08)),
    );
    const MERGED = new Set(["unit", "qty", "rate_unit", "multiplier"]);
    for (const r of rows) {
      if (r._span && MERGED.has(c.key)) continue;
      const v = typeof r[c.key] === "string" ? (r[c.key] as string) : "";
      if (v) w = Math.max(w, ctx.regular.widthOfTextAtSize(v, F11));
    }
    const width = Math.min(tableW * 0.18, w + pad);
    measured.set(c.key, width);
    narrow += width;
  }
  const flexCols = cols.filter((c) => flexKeys.has(c.key));
  if (!flexCols.length) return;
  const hasNote = flexCols.some((c) => c.key === "note");
  const rest = Math.max(tableW * (hasNote ? 0.42 : 0.24), tableW - narrow);
  const scale = (tableW - rest) / (narrow || 1);
  for (const c of cols) {
    if (flexKeys.has(c.key)) c.width = hasNote ? rest * (c.key === "note" ? 0.56 : 0.44) : rest;
    else c.width = (measured.get(c.key) ?? 0) * scale;
  }
}

function drawTable(ctx: DocCtx, cols: Col[], rows: TableRow[]) {
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN_X;
  const cellPadX = 6;
  const RD = D * ROW_K;
  const headerH = 22 * RD;
  const rowMinH = 18 * RD;
  const SMALL = F11 - 1;

  const headTracking = F_DOC_KIND * 0.08;
  const headLines = cols.map((c) => {
    const title = c.title.toUpperCase();
    const avail = c.width - cellPadX * 2;
    if (trackedWidth(ctx.bold, title, F_DOC_KIND, headTracking) <= avail) return [title];
    const words = title.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && trackedWidth(ctx.bold, next, F_DOC_KIND, headTracking) > avail) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  });
  const headRows = Math.max(1, ...headLines.map((l) => l.length));
  const headH = Math.max(headerH, headRows * (F_DOC_KIND + 4) + 10);

  const drawHead = () => {
    ctx.page.drawRectangle({
      x: startX,
      y: ctx.y - headH,
      width: totalW,
      height: headH,
      color: ACCENT_SOFT,
    });
    let hx = startX;
    cols.forEach((c, ci) => {
      const lines = headLines[ci] ?? [c.title.toUpperCase()];
      const lineH = F_DOC_KIND + 4;
      const blockH = lines.length * lineH;
      let ly = ctx.y - headH + (headH - blockH) / 2 + blockH - lineH + 1;
      for (const line of lines) {
        const w = trackedWidth(ctx.bold, line, F_DOC_KIND, headTracking);
        let tx = hx + cellPadX;
        if (c.align === "right") tx = hx + c.width - cellPadX - w;
        else if (c.align === "center") tx = hx + (c.width - w) / 2;
        drawTracked(ctx.page, line, {
          x: tx,
          y: ly,
          size: F_DOC_KIND,
          font: ctx.bold,
          color: TEXT,
          tracking: headTracking,
        });
        ly -= lineH;
      }
      hx += c.width;
    });
    ctx.y -= headH;
  };

  // header (шапка повторяется на каждой новой странице таблицы)
  ensureSpace(ctx, headH + rowMinH);
  drawHead();

  /** Перенос строки таблицы на новую страницу с повтором шапки. */
  const ensureRow = (needed: number) => {
    if (ctx.y - needed < MARGIN_BOTTOM) {
      newPage(ctx);
      drawHead();
    }
  };

  // «Богатая» колонка (название позиции) — может быть не первой, если есть №
  const richIdx = Math.max(0, cols.findIndex((c) => c.key === "title"));
  const firstCol = cols[richIdx];
  const richX = startX + cols.slice(0, richIdx).reduce((s, c) => s + c.width, 0);

  const cellOf = (r: TableRow, key: string) =>
    typeof r[key] === "string" ? (r[key] as string) : "";

  /** Высота строки без отрисовки — нужна, чтобы не отрывать заголовок раздела. */
  const measure = (r: TableRow): number => {
    const kind = r._kind;
    if (kind === "section" || kind === "subtotal") {
      const isSub = kind === "subtotal";
      const label = cellOf(r, firstCol.key);
      const font = isSub ? ctx.regular : displayFont(ctx, label);
      const size = isSub ? SMALL : F12;
      const labelW = totalW - (cols.at(-1)?.width ?? 0) - cellPadX * 2;
      const lines = wrapText(font, label, size, labelW);
      return Math.max((isSub ? 18 : 24) * RD, lines.length * size * LH + (isSub ? 8 : 12) * RD);
    }
    const titleW = firstCol.width - cellPadX * 2;
    const titleLines = wrapText(ctx.bold, cellOf(r, firstCol.key), F11, titleW);
    const descLines = r._desc ? wrapText(ctx.regular, r._desc, SMALL, titleW) : [];
    const bulletLines = (r._bullets ?? []).flatMap((b) =>
      wrapText(ctx.regular, `•  ${b}`, SMALL, titleW - 8),
    );
    const firstBlockH =
      titleLines.length * F11 * LH + (descLines.length + bulletLines.length) * SMALL * LH;
    const restH =
      Math.max(
        ...cols.map((c, i) =>
          i === richIdx ? 0 : wrapText(ctx.regular, cellOf(r, c.key), F11, c.width - cellPadX * 2).length,
        ),
        1,
      ) *
      F11 *
      1.3;
    return Math.max(rowMinH, Math.max(firstBlockH, restH) + 9 * RD);
  };

  // rows
  for (let ri = 0; ri < rows.length; ri += 1) {
    const r = rows[ri];
    const kind = r._kind;
    const cell = (key: string) => cellOf(r, key);
    const rowH = measure(r);

    // keep-with-next: заголовок раздела всегда переносим вместе с первой
    // строкой раздела, а обычную строку — вместе со следующим подытогом.
    const next = rows[ri + 1];
    const glued =
      kind === "section" && next
        ? measure(next)
        : kind !== "subtotal" && next?._kind === "subtotal"
          ? measure(next)
          : 0;
    ensureRow(rowH + glued);

    if (kind === "section" || kind === "subtotal") {
      const label = cell(firstCol.key);
      const isSub = kind === "subtotal";
      const font = isSub ? ctx.regular : displayFont(ctx, label);
      const size = isSub ? SMALL : F12;
      const labelW = totalW - (cols.at(-1)?.width ?? 0) - cellPadX * 2;
      const lines = wrapText(font, label, size, labelW);
      if (isSub) {
        ctx.page.drawRectangle({ x: startX, y: ctx.y - rowH, width: totalW, height: rowH, color: SURFACE });
      }
      ctx.page.drawLine({
        start: { x: startX, y: ctx.y - rowH },
        end: { x: startX + totalW, y: ctx.y - rowH },
        thickness: 0.4,
        color: LINE,
      });
      let ly = ctx.y - (isSub ? 5 : 8) * RD;
      for (const line of lines) {
        ctx.page.drawText(line, {
          x: startX + cellPadX,
          y: ly - size,
          size,
          font,
          color: isSub ? MUTED : TEXT,
        });
        ly -= size * LH;
      }
      // сумма подытога — справа
      const last = cols.at(-1);
      const lastVal = last ? cell(last.key) : "";
      if (last && lastVal) {
        const vFont = isSub ? ctx.bold : ctx.regular;
        const vSize = isSub ? SMALL : F11;
        const w = vFont.widthOfTextAtSize(lastVal, vSize);
        ctx.page.drawText(lastVal, {
          x: startX + totalW - cellPadX - w,
          y: ctx.y - (isSub ? 5 : 8) * RD - vSize,
          size: vSize,
          font: vFont,
          color: TEXT,
        });
      }
      ctx.y -= rowH;
      continue;
    }

    // обычная позиция: название — полужирным, описание и «что входит» — мельче и серым
    const titleText = cell(firstCol.key);
    const titleW = firstCol.width - cellPadX * 2;
    const titleLines = wrapText(ctx.bold, titleText, F11, titleW);
    const descLines = r._desc ? wrapText(ctx.regular, r._desc, SMALL, titleW) : [];
    const bulletLines = (r._bullets ?? []).flatMap((b) =>
      wrapText(ctx.regular, `•  ${b}`, SMALL, titleW - 8),
    );
    const restWrapped = cols.map((c, i) =>
      i === richIdx ? [] : wrapText(ctx.regular, cell(c.key), F11, c.width - cellPadX * 2),
    );

    ctx.page.drawLine({
      start: { x: startX, y: ctx.y - rowH },
      end: { x: startX + totalW, y: ctx.y - rowH },
      thickness: 0.4,
      color: LINE,
    });

    // колонка с названием
    let cy = ctx.y - 5 * RD;
    for (const line of titleLines) {
      ctx.page.drawText(line, { x: richX + cellPadX, y: cy - F11, size: F11, font: ctx.bold, color: TEXT });
      cy -= F11 * LH;
    }
    for (const line of descLines) {
      ctx.page.drawText(line, { x: richX + cellPadX, y: cy - SMALL, size: SMALL, font: ctx.regular, color: MUTED });
      cy -= SMALL * LH;
    }
    for (const line of bulletLines) {
      ctx.page.drawText(line, { x: richX + cellPadX + 8, y: cy - SMALL, size: SMALL, font: ctx.regular, color: MUTED });
      cy -= SMALL * LH;
    }

    // объединённые колонки (например «услуга» вместо пустых единиц и количеств)
    const spanFrom = r._span ? cols.findIndex((c) => c.key === r._span!.from) : -1;
    const spanTo = r._span ? cols.findIndex((c) => c.key === r._span!.to) : -1;
    if (r._span && spanFrom >= 0 && spanTo >= spanFrom) {
      const sx = startX + cols.slice(0, spanFrom).reduce((s2, c) => s2 + c.width, 0);
      const sw = cols.slice(spanFrom, spanTo + 1).reduce((s2, c) => s2 + c.width, 0);
      const text = r._span.text;
      const w = ctx.regular.widthOfTextAtSize(text, F11);
      ctx.page.drawText(text, {
        x: sx + (sw - w) / 2,
        y: ctx.y - 5 * RD - F11,
        size: F11,
        font: ctx.regular,
        color: TEXT,
      });
    }

    // остальные колонки
    let cx = startX;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (i === richIdx || (spanFrom >= 0 && i >= spanFrom && i <= spanTo)) {
        cx += c.width;
        continue;
      }
      const lines = restWrapped[i];
      const blockH = Math.max(lines.length, 1) * F11 * LH;
      let ly = c.valign === "middle" ? ctx.y - Math.max(5 * RD, (rowH - blockH) / 2) : ctx.y - 5 * RD;
      const color = c.key === "idx" ? MUTED : TEXT;
      for (const line of lines) {
        let tx = cx + cellPadX;
        if (c.align === "right") {
          const w = ctx.regular.widthOfTextAtSize(line, F11);
          tx = cx + c.width - cellPadX - w;
        } else if (c.align === "center") {
          const w = ctx.regular.widthOfTextAtSize(line, F11);
          tx = cx + (c.width - w) / 2;
        }
        ctx.page.drawText(line, { x: tx, y: ly - F11, size: F11, font: ctx.regular, color });
        ly -= F11 * LH;
      }
      cx += c.width;
    }

    ctx.y -= rowH;
  }
}



// === Сводный блок «итого» (как в HTML-превью: справа, белый фон, акцентная строка «Итого») ===
function drawSummary(
  ctx: DocCtx,
  rows: Array<{ label: string; value: string; emphasis?: boolean }>,
) {
  const width = Math.min(360 * 0.92, PAGE_W - MARGIN_X * 2);
  const x = PAGE_W - MARGIN_X - width;
  const padX = 13;
  const rowH = (r: { emphasis?: boolean }) => (r.emphasis ? F16 : F12) * LH_TOTAL + 8 * D;
  const height = rows.reduce((s, r) => s + rowH(r), 0);

  ensureSpace(ctx, height + 10 * D);
  roundedRect(ctx.page, {
    x,
    y: ctx.y - height,
    width,
    height,
    radius: 10,
    color: rgb(1, 1, 1),
    borderColor: ACCENT_BORDER,
    borderWidth: 0.7,
  });

  let cy = ctx.y;
  const lastIdx = rows.length - 1;
  for (const [i, r] of rows.entries()) {
    const h = rowH(r);
    const size = r.emphasis ? F16 : F12;
    if (r.emphasis) {
      const isLast = i === lastIdx;
      roundedRect(ctx.page, {
        x: x + 0.7,
        y: cy - h,
        width: width - 1.4,
        height: h,
        radius: isLast ? 9 : 0,
        color: ACCENT_SOFT,
      });
    }

    const labelFont = r.emphasis ? displayFont(ctx, r.label) : ctx.regular;
    const valueFont = r.emphasis ? displayFont(ctx, r.value) : ctx.regular;
    const baseline = cy - (h + size * 0.72) / 2;
    const labelW = labelFont.widthOfTextAtSize(r.label, size);
    ctx.page.drawText(r.label, {
      x: x + padX,
      y: baseline,
      size,
      font: labelFont,
      color: r.emphasis ? TEXT : MUTED,
    });
    // значение не должно вылезать за рамку и наезжать на подпись:
    // если места мало — уменьшаем кегль значения.
    const avail = width - padX * 2 - labelW - 8;
    let vSize = size;
    let w = valueFont.widthOfTextAtSize(r.value, vSize);
    while (w > avail && vSize > size * 0.7) {
      vSize -= 0.4;
      w = valueFont.widthOfTextAtSize(r.value, vSize);
    }
    ctx.page.drawText(r.value, {
      x: x + width - padX - w,
      y: baseline,
      size: vSize,

      font: valueFont,
      color: TEXT,
    });
    cy -= h;
  }
  ctx.y -= height + 10 * D;
}

// === Подпись (две колонки) ===
function drawSignatures(
  ctx: DocCtx,
  left: { title: string; lines: string[]; signName: string },
  right: { title: string; lines: string[]; signName: string },
) {
  const colW = (PAGE_W - MARGIN_X * 2 - 24) / 2;
  // Подпись нельзя рвать между страницами: считаем реальную высоту заранее.
  const measureCol = (b: { lines: string[] }) =>
    16 +
    b.lines.filter(Boolean).reduce((s, l) => s + wrapText(ctx.regular, l, F11, colW).length * F11 * LH_TEXT, 0) +
    28 +
    F11 * 2 +
    10;
  ensureSpace(ctx, 14 + Math.max(measureCol(left), measureCol(right)));
  ctx.y -= 14;
  const yStart = ctx.y;
  // Линия подписи в обеих колонках на одном уровне — независимо от числа строк.
  const linesH = (b: typeof left) =>
    b.lines.filter(Boolean).reduce((s, l) => s + wrapText(ctx.regular, l, F11, colW).length * F11 * LH_TEXT, 0);
  const blockH = Math.max(linesH(left), linesH(right));
  const drawCol = (x: number, b: typeof left) => {
    let cy = yStart;
    drawTracked(ctx.page, b.title.toUpperCase(), {
      x,
      y: cy - 9,
      size: F_LABEL,
      font: ctx.bold,
      color: ACCENT,
      tracking: F_LABEL * 0.12,
    });
    cy -= 16;
    for (const l of b.lines.filter(Boolean)) {
      const wrapped = wrapText(ctx.regular, l, F11, colW);
      for (const line of wrapped) {
        ctx.page.drawText(line, { x, y: cy - F11, size: F11, font: ctx.regular, color: TEXT });
        cy -= F11 * LH_TEXT;
      }
    }
    cy = yStart - 16 - blockH - 28;

    ctx.page.drawLine({
      start: { x, y: cy },
      end: { x: x + colW, y: cy },
      thickness: 0.6,
      color: LINE,
    });
    ctx.page.drawText(b.signName, {
      x,
      y: cy - F11 - 2,
      size: F11,
      font: ctx.regular,
      color: MUTED,
    });
    return yStart - (cy - F11 - 6); // фактически занятая высота
  };
  const usedL = drawCol(MARGIN_X, left);
  const usedR = drawCol(MARGIN_X + colW + 24, right);
  ctx.y -= Math.max(usedL, usedR);
}

// === Утилиты ===
function header(order: DocOrder) {
  const numFromDb = ((order as { order_number?: string | null }).order_number ?? "").trim();
  return {
    num: numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase(),
    date: fmtDate(new Date()),
  };
}

async function createCtx(
  logoUrl?: string | null,
  clientLogoUrl?: string | null,
  logoLayoutRaw?: unknown,
  font: DocFont = "brand",
): Promise<DocCtx> {
  const logoLayout = normalizeLogoLayout(logoLayoutRaw);
  const set = pdfFontSet(font);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // subset:true → встраиваем только использованные глифы (минимизируем вес).
  const regular = await pdf.embedFont(set.regular, { subset: true });
  const bold = await pdf.embedFont(set.bold, { subset: true });
  const display = await pdf.embedFont(set.display, { subset: true });
  // ставим как default fallback на StandardFonts (на всякий случай — для emoji не нужно).
  void StandardFonts;
  const [logo, clientLogo] = await Promise.all([
    embedLogo(pdf, logoUrl, logoLayout.maxW, logoLayout.maxH),
    embedLogo(pdf, clientLogoUrl, 120, 28),
  ]);
  const ctx: DocCtx = {
    pdf, regular, bold, display,
    displayCyrillic: set.displayCyrillic,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: 0,
    pageNum: 1,
    logo,
    clientLogo,
    logoLayout,
  };



  ctx.y = PAGE_H - MARGIN_TOP;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: ACCENT });
  return ctx;
}


// === Builders для каждого вида документа ===

async function buildQuote(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Коммерческое предложение", num, date, settings);

  drawCard(ctx, "Заказчик", order.client_company || order.client_name, [
    order.client_company ? `Контакт: ${order.client_name}` : null,
    order.client_phone,
    order.client_email,
    order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
  ]);

  gap(ctx, 6);
  const tableW = PAGE_W - MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "Позиция", key: "title", width: tableW * 0.55 },
      { title: "Кол-во", key: "qty", width: tableW * 0.13, align: "center", valign: "middle" },
      { title: "Цена", key: "price", width: tableW * 0.16, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.16, align: "right" },
    ],
    items.length
      ? items.map((it) => ({
          title: safe(it.title),
          qty: String(it.qty),
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ title: "Позиции не добавлены", qty: "", price: "", sum: "" }],
  );

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  gap(ctx, 6);
  drawSummary(ctx, [{ label: "Итого", value: money(total), emphasis: true }]);

  if (order.notes) {
    gap(ctx, 4);
    drawText(ctx, "Комментарий", { bold: true, size: F12, color: ACCENT });
    drawParagraph(ctx, order.notes, { size: F11 });
  }

  gap(ctx, 8);
  drawTrailingNote(
    ctx,
    `${settings.quote_footer} Предложение действительно ${settings.quote_validity_days} дней. ${settings.vat_note}.`,
    { size: 9.5, color: MUTED },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildInvoice(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Счёт-фактура", num, date, settings);

  const colW = (PAGE_W - MARGIN_X * 2 - 12) / 2;
  const cardY = ctx.y;
  drawCard(
    ctx,
    "Исполнитель",
    settings.company_legal_name,
    [
      `УНП: ${settings.company_unp}`,
      settings.company_address,
      settings.bank_account ? `р/с ${settings.bank_account}` : null,
      settings.bank_name || null,
      settings.bank_bic ? `БИК: ${settings.bank_bic}` : null,
      `${settings.company_phone} · ${settings.company_email}`,
    ],
    { x: MARGIN_X, width: colW },
  );
  const leftEndY = ctx.y;
  ctx.y = cardY;
  drawCard(
    ctx,
    "Плательщик",
    order.client_company || order.client_name,
    [
      order.client_company ? `Контакт: ${order.client_name}` : null,
      order.client_phone,
      order.client_email,
      order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
    ],
    { x: MARGIN_X + colW + 12, width: colW },
  );
  ctx.y = Math.min(leftEndY, ctx.y);

  gap(ctx, 8);
  const tableW = PAGE_W - MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "№", key: "n", width: tableW * 0.06, align: "right" },
      { title: "Наименование", key: "title", width: tableW * 0.49 },
      { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
      { title: "Ед.", key: "u", width: tableW * 0.06, align: "center" },
      { title: "Цена", key: "price", width: tableW * 0.14, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.15, align: "right" },
    ],
    items.length
      ? items.map((it, i) => ({
          n: String(i + 1),
          title: safe(it.title),
          qty: String(it.qty),
          u: "шт.",
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ n: "", title: "Позиции не добавлены", qty: "", u: "", price: "", sum: "" }],
  );

  const base = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const v = computeVat(base, vatConfig(settings));
  const total = v.gross;
  const paid = Number(order.paid ?? 0);
  const debt = Math.max(0, total - paid);
  gap(ctx, 6);
  drawSummary(ctx, [
    ...(v.enabled
      ? [
          { label: "Сумма без НДС", value: money(v.net) },
          { label: `НДС ${vatRateLabel(v.rate)}%`, value: money(v.vat) },
        ]
      : [{ label: `Итого, ${settings.vat_note}`, value: money(total) }]),
    { label: "К ОПЛАТЕ", value: money(total), emphasis: true },
    ...(paid > 0 ? [{ label: "Оплачено", value: money(paid) }] : []),
    ...(paid > 0 && debt > 0 ? [{ label: "Остаток", value: money(debt) }] : []),
  ]);

  gap(ctx, 8);
  drawParagraph(
    ctx,
    `${settings.invoice_footer} Срок оплаты: ${settings.invoice_validity_days} банковских дней.`,
    { size: 9.5, color: MUTED },
  );

  drawSignatures(
    ctx,
    {
      title: "Исполнитель",
      lines: ["Подпись: _______________"],
      signName: `${settings.signer_name} / ${settings.signer_title}`,
    },
    {
      title: "Заказчик",
      lines: ["Подпись: _______________"],
      signName: order.client_name,
    },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildContract(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Договор", num, date, settings);

  drawText(ctx, `ДОГОВОР ОКАЗАНИЯ УСЛУГ № ${num}`, {
    bold: true,
    size: F16,
    align: "center",
    x: MARGIN_X,
    width: PAGE_W - MARGIN_X * 2,
  });
  drawText(ctx, `г. ${settings.contract_jurisdiction_city} · ${date}`, {
    size: DOC_FONT_PT.small,
    color: MUTED,
    align: "center",
    x: MARGIN_X,
    width: PAGE_W - MARGIN_X * 2,
  });
  gap(ctx, 8);

  drawParagraph(
    ctx,
    `${settings.company_legal_name} (далее — «Исполнитель») в лице ${settings.signer_title} ${settings.signer_name}, действующего на основании ${settings.signer_basis}, с одной стороны, и ${order.client_company || order.client_name}${order.client_company ? ` в лице ${order.client_name}` : ""} (далее — «Заказчик»), с другой стороны, заключили настоящий Договор о нижеследующем.`,
    { size: F11 },
  );
  gap(ctx, 6);

  const eventDate = order.event_date ? fmtDate(order.event_date) : "по согласованию сторон";
  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);

  const section = (n: string, title: string) => {
    gap(ctx, 6);
    drawText(ctx, `${n}. ${title}`, { bold: true, size: F13, color: ACCENT });
    gap(ctx, 2);
  };

  section("1", "Предмет договора");
  drawParagraph(ctx, `1.1. Исполнитель обязуется оказать Заказчику услуги по организации и техническому обеспечению мероприятия, проводимого ${eventDate}, а Заказчик — принять и оплатить услуги.`, { size: F11 });
  drawParagraph(ctx, "1.2. Перечень услуг и их стоимость:", { size: F11 });
  for (const it of items.length ? items : [{ title: "Услуги уточняются дополнительным соглашением.", qty: 0, price: 0 } as DocItem]) {
    const sum = Number(it.price) * Number(it.qty);
    const line = `  • ${safe(it.title)}${it.qty ? ` — ${it.qty} шт. × ${money(Number(it.price))} = ${money(sum)}` : ""}`;
    drawParagraph(ctx, line, { size: F11 });
  }

  section("2", "Стоимость услуг и порядок расчётов");
  drawParagraph(
    ctx,
    (() => {
      const cv = computeVat(total, vatConfig(settings));
      return `2.1. Общая стоимость услуг по Договору составляет ${money(cv.gross)}, ${
        cv.enabled ? `в том числе НДС ${vatRateLabel(cv.rate)}% — ${money(cv.vat)}` : settings.vat_note
      }.`;
    })(),
    { size: F11 },
  );
  drawParagraph(ctx, `2.2. Заказчик вносит предоплату в размере ${settings.contract_prepayment_pct}% от стоимости в течение ${settings.contract_prepayment_days} банковских дней с момента подписания Договора.`, { size: F11 });
  drawParagraph(ctx, "2.3. Окончательный расчёт производится не позднее даты проведения мероприятия.", { size: F11 });
  drawParagraph(ctx, "2.4. Оплата осуществляется безналичным перечислением на расчётный счёт Исполнителя.", { size: F11 });

  section("3", "Ответственность");
  drawParagraph(ctx, `3.1. За нарушение сроков оплаты Заказчик уплачивает пеню в размере ${settings.contract_late_fee_pct}% от просроченной суммы за каждый день просрочки.`, { size: F11 });
  drawParagraph(ctx, `3.2. В случае отказа Заказчика от услуг менее чем за ${settings.contract_cancel_days} дней до даты мероприятия предоплата не возвращается.`, { size: F11 });
  drawParagraph(ctx, `3.3. Споры разрешаются в суде по месту нахождения Исполнителя (г. ${settings.contract_jurisdiction_city}).`, { size: F11 });

  (settings.contract_sections ?? []).forEach((s, i) => {
    section(String(i + 4), s.title);
    for (const p of s.paragraphs ?? []) drawParagraph(ctx, p, { size: F11 });
  });

  gap(ctx, 8);
  drawSignatures(
    ctx,
    {
      title: "Исполнитель",
      lines: [
        settings.company_legal_name,
        `УНП ${settings.company_unp}`,
        settings.company_address,
        settings.bank_account ? `р/с ${settings.bank_account}` : "",
      ],
      signName: `${settings.signer_name}, ${settings.signer_title}`,
    },
    {
      title: "Заказчик",
      lines: [
        order.client_company || order.client_name,
        order.client_phone ?? "",
        order.client_email ?? "",
      ],
      signName: order.client_name,
    },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildAct(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Акт оказанных услуг", num, date, settings);

  const colW = (PAGE_W - MARGIN_X * 2 - 12) / 2;
  const startY = ctx.y;
  drawCard(
    ctx,
    "Исполнитель",
    settings.company_legal_name,
    [
      `УНП: ${settings.company_unp}`,
      settings.company_address,
      `${settings.company_phone} · ${settings.company_email}`,
    ],
    { x: MARGIN_X, width: colW },
  );
  const leftEnd = ctx.y;
  ctx.y = startY;
  drawCard(
    ctx,
    "Заказчик",
    order.client_company || order.client_name,
    [
      order.client_company ? `Контакт: ${order.client_name}` : null,
      order.client_phone,
      order.client_email,
    ],
    { x: MARGIN_X + colW + 12, width: colW },
  );
  ctx.y = Math.min(leftEnd, ctx.y);

  gap(ctx, 8);
  drawParagraph(ctx, settings.act_intro, { size: F11 });

  gap(ctx, 6);
  const eventDate = order.event_date ? fmtDate(order.event_date) : "—";
  drawText(ctx, `Дата оказания услуг: ${eventDate}`, { size: F11, bold: true });
  gap(ctx, 4);

  const tableW = PAGE_W - MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "№", key: "n", width: tableW * 0.06, align: "right" },
      { title: "Наименование", key: "title", width: tableW * 0.49 },
      { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
      { title: "Ед.", key: "u", width: tableW * 0.06, align: "center" },
      { title: "Цена", key: "price", width: tableW * 0.14, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.15, align: "right" },
    ],
    items.length
      ? items.map((it, i) => ({
          n: String(i + 1),
          title: safe(it.title),
          qty: String(it.qty),
          u: "шт.",
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ n: "", title: "Позиции не добавлены", qty: "", u: "", price: "", sum: "" }],
  );

  const actBase = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const actVat = computeVat(actBase, vatConfig(settings));
  const total = actVat.gross;
  gap(ctx, 6);
  drawSummary(ctx, [
    ...(actVat.enabled
      ? [
          { label: "Сумма без НДС", value: money(actVat.net) },
          { label: `НДС ${vatRateLabel(actVat.rate)}%`, value: money(actVat.vat) },
        ]
      : []),
    { label: "ИТОГО оказано услуг на сумму", value: money(total), emphasis: true },
    ...(actVat.enabled ? [] : [{ label: settings.vat_note, value: "—" }]),
  ]);

  gap(ctx, 6);
  drawParagraph(ctx, "Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.", { size: F11 });

  drawSignatures(
    ctx,
    {
      title: "Сдал — Исполнитель",
      lines: [settings.company_legal_name, `УНП ${settings.company_unp}`],
      signName: `${settings.signer_name}, ${settings.signer_title}`,
    },
    {
      title: "Принял — Заказчик",
      lines: [order.client_company || order.client_name],
      signName: order.client_name,
    },
  );

  gap(ctx, 4);
  drawParagraph(
    ctx,
    `${settings.act_footer} Срок приёмки: ${settings.act_validity_days} рабочих дней.`,
    { size: 9.5, color: MUTED },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

export async function buildOrderDocPdf(
  kind: DocKind,
  order: DocOrder,
  items: DocItem[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  applyDensity("comfortable");
  if (kind === "quote") return buildQuote(order, items, settings);

  if (kind === "invoice") return buildInvoice(order, items, settings);
  if (kind === "contract") return buildContract(order, items, settings);
  return buildAct(order, items, settings);
}

export const DOC_PDF_FILENAMES: Record<DocKind, string> = {
  quote: "Коммерческое_предложение",
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
};

// Понятное имя файла на основе данных заказа.
// Пример: "КП №ABCD1234 Иванов.pdf" / "Договор №ABCD1234 ООО Ромашка.pdf"
const DOC_SHORT_LABEL: Record<DocKind, string> = {
  quote: "КП",
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
};
export function buildAttachmentFilename(
  kind: DocKind,
  order: { id: string; order_number?: string | null; client_name?: string | null; client_company?: string | null },
): string {
  const numFromDb = (order.order_number ?? "").trim();
  const orderShort = numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase();
  const owner = (order.client_company || order.client_name || "").trim();
  let suffix = owner;
  if (!order.client_company && owner) suffix = owner.split(/\s+/)[0];
  suffix = suffix.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 48).trim();
  const base = `${DOC_SHORT_LABEL[kind]} №${orderShort}${suffix ? ` ${suffix}` : ""}`;
  return `${base}.pdf`;
}

// === Standalone КП (раздел «Документы → КП») ===
import type { Quote, QuoteItem } from "@/lib/quotes-model";
import { computeTotals, amountToWords } from "@/lib/quotes-model";
import { applyCompanyOverrides } from "@/lib/documents/company";
import { quoteNumberDisplay, quoteValidUntil, buildPlaceholderValues, buildNumericValues, effectiveBlocks, blockText } from "@/lib/documents/quote-html";
import { applyPlaceholders } from "@/lib/quote-blocks";

function bulletList(ctx: DocCtx, text: string) {
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    drawParagraph(ctx, `•  ${line}`, { size: F11, indent: 6 });
  }
}

/**
 * Автоподбор плотности: сначала «комфортно» (1:1 с превью), затем компактнее —
 * чтобы КП не растягивалось на лишние листы (по умолчанию цель — 2 листа).
 */
export async function buildStandaloneQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
  opts: { density?: DocDensity | "auto"; maxPages?: number } = {},
): Promise<Uint8Array> {
  const preset = resolvePrintPreset(
    quote.template,
    (settings as { quote_print_presets?: unknown }).quote_print_presets as never,
    quote.design as unknown as Record<string, unknown>,
  );
  const requested = opts.density ?? "auto";
  const maxPages = opts.maxPages ?? preset.maxPages;
  if (requested !== "auto") return (await renderQuotePdf(quote, items, settings, requested, preset)).bytes;

  const ladder: DocDensity[] = DOC_DENSITY_LADDER;
  let last: { bytes: Uint8Array; pages: number } | null = null;
  for (const density of ladder) {
    last = await renderQuotePdf(quote, items, settings, density, preset);
    if (last.pages <= maxPages) return last.bytes;
  }
  return last!.bytes;
}

async function renderQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
  density: DocDensity,
  preset: DocPrintPreset = BASE_PRINT_PRESET,
): Promise<{ bytes: Uint8Array; pages: number }> {
  applyDensity(density, preset);
  const eff = applyCompanyOverrides(settings, quote.company_overrides);

  const c = {
    legal: eff.company_legal_name,
    brand: eff.company_brand,
    unp: eff.company_unp,
    address: eff.company_address,
    phone: eff.company_phone,
    email: eff.company_email,
    website: eff.company_website,
    bank_name: eff.bank_name,
    bank_bic: eff.bank_bic,
    bank_account: eff.bank_account,
    signer_name: eff.signer_name,
    signer_title: eff.signer_title,
    signer_basis: eff.signer_basis,
  };

  const ctx = await createCtx(
    quote.design.show_logo ? (quote.logo_url || settings.logo_url) : null,
    null,
    quote.logo_layout,
    resolveDocFont(quote.font_family, (settings as { font_family?: unknown }).font_family),
  );

  drawHeader(ctx, "Коммерческое предложение", quoteNumberDisplay(quote), fmtDate(quote.doc_date), eff, {
    validUntil: quoteValidUntil(quote),
  });


  const map = buildPlaceholderValues(quote, items, settings);
  const numbers = buildNumericValues(quote, items);
  const t = computeTotals(quote, items);
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const colW = (PAGE_W - MARGIN_X * 2 - 12) / 2;

  const hidden = new Set<string>();
  if (!quote.design.show_cover) hidden.add("cover");
  if (!quote.design.show_requisites) hidden.add("requisites");
  if (!quote.design.show_signature) hidden.add("signature");

  const heading = (title: string) => {
    gap(ctx, 8);
    ensureSpace(ctx, F13 * 2);
    drawTracked(ctx.page, title.toUpperCase(), {
      x: MARGIN_X,
      y: ctx.y - F13,
      size: F13,
      font: ctx.bold,
      color: ACCENT,
      tracking: F13 * 0.05,
    });
    ctx.y -= F13 * LH_LOOSE;
    gap(ctx, 2);
  };

  for (const b of effectiveBlocks(quote, items, settings)) {
    if (hidden.has(b.type)) continue;
    const text = blockText(b, quote, map, numbers);

    switch (b.type) {
      case "cover": {
        // Обложка — карточка с мягкой акцентной заливкой, как в превью
        const coverTitle = applyPlaceholders(
          quote.title || "Предложение по организации мероприятия",
          map,
          numbers,
        );
        const innerW = PAGE_W - MARGIN_X * 2 - 40;
        const tFont = displayFont(ctx, coverTitle);
        const tLines = wrapText(tFont, coverTitle, F_COVER, innerW);
        const pLines = text ? wrapText(ctx.regular, text, F11, innerW) : [];
        const boxH = 18 + tLines.length * F_COVER * LH_TIGHT + (pLines.length ? 8 + pLines.length * F11 * LH_LOOSE : 0) + 18;
        gap(ctx, 6);
        ensureSpace(ctx, boxH + 8);
        roundedRect(ctx.page, {
          x: MARGIN_X,
          y: ctx.y - boxH,
          width: PAGE_W - MARGIN_X * 2,
          height: boxH,
          radius: 12,
          color: c01(mixWithWhite(BRAND_ACCENT, 0.9)),
          borderColor: ACCENT_BORDER,
          borderWidth: 0.6,
        });
        let cyc = ctx.y - 18;
        for (const line of tLines) {
          ctx.page.drawText(line, { x: MARGIN_X + 20, y: cyc - F_COVER, size: F_COVER, font: tFont, color: TEXT });
          cyc -= F_COVER * LH_TIGHT;
        }
        if (pLines.length) cyc -= 8;
        for (const line of pLines) {
          ctx.page.drawText(line, { x: MARGIN_X + 20, y: cyc - F11, size: F11, font: ctx.regular, color: MUTED });
          cyc -= F11 * LH_LOOSE;
        }
        ctx.y -= boxH + 8;
        break;
      }

      case "client": {
        gap(ctx, 6);
        drawCard(
          ctx,
          b.title || "Заказчик",
          quote.client_company || quote.client_name || "—",
          [
            quote.client_company && quote.client_name ? `Контакт: ${quote.client_name}` : null,
            quote.client_unp ? `УНП ${quote.client_unp}` : null,
            quote.client_phone,
            quote.client_email,
            quote.client_address,
          ],
          { x: MARGIN_X, width: colW * 2 + 12 },
        );
        break;
      }
      case "event": {
        gap(ctx, 6);
        // те же подписи и сетка, что в HTML-превью (.info-table)
        drawInfoCard(
          ctx,
          b.title || "Мероприятие",
          [
            ["Дата мероприятия", quote.event_date ? fmtDate(quote.event_date) : ""],
            ["Время", [quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — ")],
            ["Площадка", quote.venue || ""],
            ["Гостей", quote.guests_count != null ? String(quote.guests_count) : ""],
            ["Формат", quote.event_format || ""],
            ["Монтаж / демонтаж", quote.setup_note || ""],
          ],
          quote.event_notes || null,
        );
        break;
      }

      case "items": {
        heading(b.title || "Состав предложения");
        drawTable(
          ctx,
          [
            { title: "", width: 24, key: "idx" },
            { title: "Позиция", width: PAGE_W - MARGIN_X * 2 - 24 - 70 - 80 - 90, key: "title" },
            { title: "Кол-во", width: 70, align: "center", valign: "middle", key: "qty" },
            { title: "Цена", width: 80, align: "right", key: "price" },
            { title: "Сумма", width: 90, align: "right", key: "sum" },
          ],
          (() => {
            const showIncludes = quote.design?.show_item_includes !== false;
            const showSubtotals = quote.design?.show_section_subtotals !== false;
            const groups = new Map<string, typeof sorted>();
            for (const it of sorted) {
              const key = (it.section || "").trim();
              if (!groups.has(key)) groups.set(key, [] as unknown as typeof sorted);
              groups.get(key)!.push(it);
            }
            const rows: TableRow[] = [];
            for (const [section, list] of groups) {
              if (section) rows.push({ _kind: "section", idx: "", title: section, qty: "", price: "", sum: "" });
              list.forEach((it, i) => {
                rows.push({
                  idx: String(i + 1),
                  title: it.title,
                  _desc: it.description || undefined,
                  _bullets:
                    showIncludes && it.includes?.length
                      ? it.includes.map((inc) => `${inc.text}${inc.note ? ` — ${inc.note}` : ""}`)
                      : undefined,
                  qty: `${it.qty} ${it.unit ?? ""}`.trim(),
                  price: money(Number(it.price)),
                  sum: money(Number(it.price) * Number(it.qty)),
                });
              });
              if (showSubtotals && section && list.length > 1) {
                rows.push({
                  _kind: "subtotal",
                  idx: "",
                  title: `Итого по разделу «${section}»`,
                  qty: "",
                  price: "",
                  sum: money(list.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0)),
                });
              }
            }
            if (t.vatEnabled && quote.vat_as_line) {
              rows.push({
                _kind: "subtotal",
                idx: "",
                title: t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
                qty: "",
                price: "",
                sum: money(t.vat),
              });
            }
            return rows;
          })(),
        );


        break;
      }
      case "totals": {
        gap(ctx, 8);
        drawSummary(ctx, [
          { label: `Стоимость позиций${t.vatEnabled ? " (без НДС)" : ""}`, value: money(t.subtotal) },
          ...(t.discount ? [{ label: "Скидка", value: `− ${money(t.discount)}` }] : []),
          ...(t.delivery ? [{ label: "Доставка и логистика", value: money(t.delivery) }] : []),
          ...(t.vatEnabled
            ? [
                ...(t.discount || t.delivery ? [{ label: "Сумма без НДС", value: money(t.net) }] : []),
                { label: `НДС ${vatRateLabel(t.vatRate)}%`, value: money(t.vat) },
              ]
            : []),
          { label: t.vatEnabled ? "Итого с НДС" : "Итого", value: money(t.total), emphasis: true },
          ...(t.prepayment
            ? [
                { label: "Предоплата", value: money(t.prepayment) },
                { label: "Остаток", value: money(t.balance) },
              ]
            : []),
        ]);
        drawParagraph(
          ctx,
          `${amountToWords(t.total)}. ${
            t.vatEnabled ? `В том числе НДС ${vatRateLabel(t.vatRate)}% — ${money(t.vat)}` : quote.vat_note || settings.vat_note
          }`,
          { size: 9.5, color: MUTED },
        );
        break;
      }
      case "included":
      case "excluded": {
        if (!text) break;
        heading(b.title);
        bulletList(ctx, text);
        break;
      }
      case "timeline":
      case "terms":
      case "text": {
        if (!text) break;
        heading(b.title);
        drawParagraph(ctx, text, { size: F11 });
        break;
      }
      case "requisites": {
        gap(ctx, 10);
        drawCard(ctx, b.title || "Реквизиты исполнителя", c.legal, [
          c.unp ? `УНП ${c.unp}` : null,
          c.address,
          c.bank_account ? `р/с ${c.bank_account}` : null,
          c.bank_name,
          c.bank_bic ? `БИК ${c.bank_bic}` : null,
          [c.phone, c.email, c.website].filter(Boolean).join(" · "),
        ]);
        break;
      }
      case "signature": {
        drawSignatures(
          ctx,
          {
            title: "Исполнитель",
            lines: [c.legal, c.unp ? `УНП ${c.unp}` : ""],
            signName: `${c.signer_name}${c.signer_title ? `, ${c.signer_title}` : ""}`,
          },
          {
            title: "Заказчик",
            lines: [quote.client_company || quote.client_name || ""],
            signName: quote.client_name || "",
          },
        );
        break;
      }
      default:
        break;
    }
  }

  gap(ctx, 4);
  const footerText = applyPlaceholders(quote.texts.footer || settings.quote_footer, map, numbers);
  // срок действия добавляем только если его нет в тексте подвала — иначе фраза дублируется
  const validity =
    quote.validity_days && !/действительн/i.test(footerText)
      ? `Предложение действительно ${quote.validity_days} дней. `
      : "";
  drawTrailingNote(ctx, `${validity}${footerText}`, { size: 9.5, color: MUTED });

  drawFooter(ctx, eff);
  const pages = ctx.pdf.getPageCount();
  return { bytes: await ctx.pdf.save(), pages };

}


// ===================== Промо-КП =====================
export async function buildPromoQuotePdf(
  quote: PromoQuoteT,
  items: PromoItemT[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  applyDensity(
    "comfortable",
    resolvePrintPreset(
      "classic",
      (settings as { quote_print_presets?: unknown }).quote_print_presets as never,
      (quote as { design?: Record<string, unknown> }).design,
    ),
  );
  const eff = applyCompanyOverrides(settings, quote.company_overrides);
  const ctx = await createCtx(
    quote.logo_url || eff.logo_url,
    quote.client_logo_url,
    quote.logo_layout,
    resolveDocFont(quote.font_family, (settings as { font_family?: unknown }).font_family),
  );

  const t = computePromoTotals(quote, items);
  drawHeader(
    ctx,
    "Коммерческое предложение",
    promoNumberDisplay(quote),
    fmtDate(quote.created_at || new Date().toISOString()),
    eff,
  );

  drawCard(ctx, "Проект", quote.project || "—", [
    quote.client_name ? `Клиент: ${quote.client_name}` : null,
    quote.period ? `Период: ${quote.period}` : null,
    quote.venue ? `Место проведения: ${quote.venue}` : null,
    quote.contact_name || quote.contact_phone || quote.contact_email
      ? `Контактное лицо: ${[quote.contact_name, quote.contact_role].filter(Boolean).join(", ")}${
          quote.contact_phone ? `; ${quote.contact_phone}` : ""
        }${quote.contact_email ? `; ${quote.contact_email}` : ""}`
      : null,
  ]);

  gap(ctx, 6);
  const tableW = PAGE_W - MARGIN_X * 2;
  const showNotes = quote.show_notes;
  // Вторая единица («час», «смена») — отдельные колонки, только если она задана.
  const dual = hasSecondUnit(items);
  const priceTitle = PRICE_LABEL;
  const dualCols: Col[] = dual
    ? [
        { title: "Ед. изм.", key: "unit2", width: tableW * 0.08, align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty2", width: tableW * 0.08, align: "center", valign: "middle" },
      ]
    : [];
  const cols: Col[] = showNotes
    ? [
        { title: "Наименование", key: "title", width: tableW * (dual ? 0.24 : 0.3) },
        { title: "Ед. изм.", key: "unit", width: tableW * (dual ? 0.09 : 0.11), align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty", width: tableW * 0.08, align: "center", valign: "middle" },
        ...dualCols,
        { title: priceTitle, key: "price", width: tableW * 0.12, align: "center", valign: "middle" },
        { title: "Сумма", key: "sum", width: tableW * 0.13, align: "center", valign: "middle" },
        { title: "Примечания", key: "note", width: tableW * (dual ? 0.18 : 0.26), valign: "middle" },
      ]
    : [
        { title: "Наименование", key: "title", width: tableW * (dual ? 0.34 : 0.46) },
        { title: "Ед. изм.", key: "unit", width: tableW * (dual ? 0.11 : 0.14), align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
        ...dualCols,
        { title: priceTitle, key: "price", width: tableW * 0.15, align: "center", valign: "middle" },
        { title: "Сумма", key: "sum", width: tableW * 0.15, align: "center", valign: "middle" },
      ];


  const rows: TableRow[] = [];
  for (const sec of groupBySection(items)) {
    if (sec.name) rows.push({ _kind: "section", title: sec.name, unit: "", qty: "", price: "", sum: "", note: "" });
    for (const it of sec.items) {
      rows.push({
        title: safe(it.title),
        _bullets:
          quote.show_item_includes && it.includes.length
            ? it.includes.map((inc) => `${safe(inc.text)}${inc.note ? ` — ${safe(inc.note)}` : ""}`)
            : undefined,
        unit: safe(it.unit),
        qty: dual ? formatNumber(it.qty) : formatTotalQty(it),
        unit2: rateUnitLabel(it) || "—",
        qty2: rateUnitLabel(it) ? formatNumber(it.multiplier) : "—",
        _span: isServiceOnlyRow(it)
          ? { from: "unit", to: dual ? "qty2" : "qty", text: safe(it.unit) || "услуга" }
          : undefined,
        price: it.price ? money(it.price) : "",
        sum: lineTotal(it) ? money(lineTotal(it)) : "",
        note: safe(it.note),
      });
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      rows.push({
        _kind: "subtotal",
        title: `Итого по разделу «${sec.name}»`,
        unit: "",
        qty: "",
        price: "",
        sum: money(sec.items.reduce((s, it) => s + lineTotal(it), 0)),
        note: "",
      });
    }
  }

  if (quote.management_enabled) {
    rows.push({
      title: quote.management_label,
      unit: "услуга",
      qty: "—",
      unit2: "—",
      qty2: "—",
      price: "",
      sum: money(t.management),
      note: "",
      _span: { from: "unit", to: dual ? "qty2" : "qty", text: "услуга" },
    });
  }
  if (quote.commission_enabled) {
    rows.push({
      title: quote.commission_label,
      unit: "—",
      qty: "—",
      price: "",
      sum: money(t.commission),
      note: `${quote.commission_rate}%`,
    });
  }
  if (t.vatEnabled && quote.vat_as_line) {
    rows.push({
      title: t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
      unit: "—",
      qty: "—",
      price: "",
      sum: money(t.vat),
      note: "",
    });
  }
  const tableRows = rows.length
    ? rows
    : [{ title: "Позиции не добавлены", unit: "", qty: "", price: "", sum: "", note: "" }];
  fitTableCols(ctx, cols, tableRows, tableW);
  drawTable(ctx, cols, tableRows);

  gap(ctx, 6);
  drawSummary(ctx, [
    { label: t.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего", value: money(t.net) },
    ...(t.vatEnabled ? [{ label: `НДС ${vatRateLabel(t.vatRate)}%`, value: money(t.vat) }] : []),
    { label: `Итого${t.vatEnabled ? ", с НДС" : ""}`, value: money(t.totalWithVat), emphasis: true },
  ]);

  if (quote.footer_note) {
    gap(ctx, 4);
    drawTrailingNote(ctx, quote.footer_note, { size: 9.5, color: MUTED });
  }

  drawFooter(ctx, eff);
  return await ctx.pdf.save();
}
