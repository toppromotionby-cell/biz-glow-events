// PDF-генератор документов заказа (КП / Счёт / Договор / Акт).
// Используется только server-side. Рендерит pdf-lib + кастомные TTF
// (Inter Regular/Bold + Space Grotesk Bold — те же шрифты, что и в HTML-превью);
// кириллица в Standard 14 шрифтах PDF не работает, поэтому встраиваем TTF
// подмножеством (subset:true).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { DocOrder, DocItem, DocKind } from "@/lib/documents/build.server";
import { fmtDate } from "@/lib/formatters";
import {
  computePromoTotals,
  groupBySection,
  lineQty,
  lineTotal,
  promoNumberDisplay,
  type PromoItem as PromoItemT,
  type PromoQuote as PromoQuoteT,
} from "@/lib/promo-quote-model";

import { INTER_REGULAR_B64 } from "@/assets/fonts/inter-regular.base64";
import { INTER_BOLD_B64 } from "@/assets/fonts/inter-bold.base64";
import { SPACE_GROTESK_BOLD_B64 } from "@/assets/fonts/space-grotesk-bold.base64";

// Шрифты встроены в бандл (subset латиница+кириллица). Раньше они качались
// по сети с публичного адреса того же воркера — такой self-subrequest иногда
// зависал, и Cloudflare убивал запрос с 502.
function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

let regularBytes: Uint8Array | null = null;
let boldBytes: Uint8Array | null = null;
let displayBytes: Uint8Array | null = null;

function loadRegular(): Uint8Array {
  if (!regularBytes) regularBytes = decodeBase64(INTER_REGULAR_B64);
  return regularBytes;
}
function loadBold(): Uint8Array {
  if (!boldBytes) boldBytes = decodeBase64(INTER_BOLD_B64);
  return boldBytes;
}
function loadDisplay(): Uint8Array {
  if (!displayBytes) displayBytes = decodeBase64(SPACE_GROTESK_BOLD_B64);
  return displayBytes;
}

/** В Space Grotesk нет кириллицы — для неё используем Inter Bold. */
const CYRILLIC = /[\u0400-\u04FF]/;
function displayFont(ctx: DocCtx, text: string): PDFFont {
  return CYRILLIC.test(text) ? ctx.bold : ctx.display;
}



// === Стили / токены, согласованные с сайтом ===
const ACCENT = rgb(0.94, 0.63, 0.25);          // оранжевый primary
const ACCENT_SOFT = rgb(0.98, 0.93, 0.83);     // светлый акцент для фона
const TEXT = rgb(0.07, 0.07, 0.09);
const MUTED = rgb(0.43, 0.43, 0.48);
const LINE = rgb(0.87, 0.87, 0.9);
const SURFACE = rgb(0.98, 0.98, 0.99);

// A4 в pt (72 dpi)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 48;

const F11 = 10.5;
const F12 = 11;
const F13 = 12;
const F16 = 15;
const F22 = 20;

type DocCtx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  display: PDFFont;

  page: PDFPage;
  y: number;
  pageNum: number;
};

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

function newPage(ctx: DocCtx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  ctx.y = PAGE_H - MARGIN_TOP;
  // верхняя акцентная полоса
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: ACCENT });
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
    ensureSpace(ctx, size * 1.4);
    let x = opts.x ?? MARGIN_X;
    if (opts.align && opts.width) {
      const w = font.widthOfTextAtSize(line, size);
      if (opts.align === "right") x = (opts.x ?? MARGIN_X) + opts.width - w;
      else if (opts.align === "center") x = (opts.x ?? MARGIN_X) + (opts.width - w) / 2;
    }
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size * 1.35;
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
      ensureSpace(ctx, size * 1.45);
      ctx.page.drawText(line, { x: MARGIN_X + indent, y: ctx.y - size, size, font, color });
      ctx.y -= size * 1.45;
    }
  }
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
  ctx.y -= n;
}

function drawHeader(ctx: DocCtx, kind: string, num: string, date: string, settings: DocumentSettings) {
  // Бренд слева — дисплейным шрифтом, как в HTML-превью
  const brand = safe(settings.company_brand);
  ctx.page.drawText(brand, {
    x: MARGIN_X,
    y: PAGE_H - MARGIN_TOP - F22 * 0.8,
    size: F22,
    font: displayFont(ctx, brand),
    color: TEXT,
  });

  const subY = PAGE_H - MARGIN_TOP - F22 * 0.8 - 14;
  ctx.page.drawText(
    `${safe(settings.company_legal_name)} · ${safe(settings.company_address)}`,
    { x: MARGIN_X, y: subY, size: 9, font: ctx.regular, color: MUTED },
  );

  // Тип/номер/дата справа
  const rightX = PAGE_W - MARGIN_X;
  const kindUpper = kind.toUpperCase();
  const kindW = ctx.bold.widthOfTextAtSize(kindUpper, 11);
  ctx.page.drawText(kindUpper, {
    x: rightX - kindW,
    y: PAGE_H - MARGIN_TOP - 4,
    size: 11,
    font: ctx.bold,
    color: ACCENT,
  });
  const numText = `№ ${num}`;
  const numW = ctx.bold.widthOfTextAtSize(numText, 14);
  ctx.page.drawText(numText, {
    x: rightX - numW,
    y: PAGE_H - MARGIN_TOP - 22,
    size: 14,
    font: ctx.bold,
    color: TEXT,
  });
  const dateText = `от ${date}`;
  const dateW = ctx.regular.widthOfTextAtSize(dateText, 10);
  ctx.page.drawText(dateText, {
    x: rightX - dateW,
    y: PAGE_H - MARGIN_TOP - 38,
    size: 10,
    font: ctx.regular,
    color: MUTED,
  });

  ctx.y = PAGE_H - MARGIN_TOP - 58;
  divider(ctx);
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
      size: 8,
      font: ctx.regular,
      color: MUTED,
    });
    const pageLabel = `${i + 1} / ${total}`;
    const w = ctx.regular.widthOfTextAtSize(pageLabel, 8);
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN_X - w,
      y: MARGIN_BOTTOM - 24,
      size: 8,
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
  const titleLines = wrapText(ctx.bold, title, F13, innerW);
  const bodyLineHeights = cleanLines.flatMap((l) => wrapText(ctx.regular, l, F11, innerW));
  const height = 14 + 14 + titleLines.length * (F13 * 1.3) + bodyLineHeights.length * (F11 * 1.35) + 12;

  ensureSpace(ctx, height + 6);
  // фон карточки
  ctx.page.drawRectangle({
    x,
    y: ctx.y - height,
    width,
    height,
    color: SURFACE,
    borderColor: LINE,
    borderWidth: 0.6,
  });
  let cy = ctx.y - 14;
  ctx.page.drawText(label.toUpperCase(), {
    x: x + 12,
    y: cy - 9,
    size: 8.5,
    font: ctx.bold,
    color: ACCENT,
  });
  cy -= 18;
  for (const t of titleLines) {
    ctx.page.drawText(t, { x: x + 12, y: cy - F13, size: F13, font: ctx.bold, color: TEXT });
    cy -= F13 * 1.3;
  }
  cy -= 2;
  for (const l of bodyLineHeights) {
    ctx.page.drawText(l, { x: x + 12, y: cy - F11, size: F11, font: ctx.regular, color: MUTED });
    cy -= F11 * 1.35;
  }
  ctx.y -= height + 6;
}

// === Таблица позиций ===
type Col = {
  title: string;
  width: number;
  align?: "left" | "right" | "center";
  valign?: "top" | "middle";
  key: string;
};

function drawTable(
  ctx: DocCtx,
  cols: Col[],
  rows: Array<Record<string, string>>,
) {
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN_X;
  const cellPadX = 6;
  const headerH = 22;
  const rowMinH = 18;

  // header
  ensureSpace(ctx, headerH + rowMinH);
  ctx.page.drawRectangle({
    x: startX,
    y: ctx.y - headerH,
    width: totalW,
    height: headerH,
    color: ACCENT_SOFT,
  });
  let cx = startX;
  for (const c of cols) {
    let tx = cx + cellPadX;
    if (c.align === "right") {
      const w = ctx.bold.widthOfTextAtSize(c.title, 9);
      tx = cx + c.width - cellPadX - w;
    } else if (c.align === "center") {
      const w = ctx.bold.widthOfTextAtSize(c.title, 9);
      tx = cx + (c.width - w) / 2;
    }
    ctx.page.drawText(c.title, { x: tx, y: ctx.y - 15, size: 9, font: ctx.bold, color: TEXT });
    cx += c.width;
  }
  ctx.y -= headerH;

  // rows
  for (const r of rows) {
    // высчитываем wrap для всех ячеек
    const wrapped = cols.map((c) =>
      wrapText(ctx.regular, r[c.key] ?? "", F11, c.width - cellPadX * 2),
    );
    const linesCount = Math.max(...wrapped.map((w) => w.length), 1);
    const rowH = Math.max(rowMinH, linesCount * F11 * 1.3 + 8);

    ensureSpace(ctx, rowH);
    // нижняя линия
    ctx.page.drawLine({
      start: { x: startX, y: ctx.y - rowH },
      end: { x: startX + totalW, y: ctx.y - rowH },
      thickness: 0.4,
      color: LINE,
    });
    cx = startX;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const lines = wrapped[i];
      const blockH = Math.max(lines.length, 1) * F11 * 1.3;
      let cy =
        c.valign === "middle" ? ctx.y - Math.max(4, (rowH - blockH) / 2) : ctx.y - 4;
      for (const line of lines) {
        let tx = cx + cellPadX;
        if (c.align === "right") {
          const w = ctx.regular.widthOfTextAtSize(line, F11);
          tx = cx + c.width - cellPadX - w;
        } else if (c.align === "center") {
          const w = ctx.regular.widthOfTextAtSize(line, F11);
          tx = cx + (c.width - w) / 2;
        }
        ctx.page.drawText(line, { x: tx, y: cy - F11, size: F11, font: ctx.regular, color: TEXT });
        cy -= F11 * 1.3;
      }
      cx += c.width;
    }
    ctx.y -= rowH;
  }
}

// === Сводный блок «итого» ===
function drawSummary(
  ctx: DocCtx,
  rows: Array<{ label: string; value: string; emphasis?: boolean }>,
) {
  const width = PAGE_W - MARGIN_X * 2;
  const padX = 14;
  const lineH = F12 * 1.6;
  const height = rows.length * lineH + 16;

  ensureSpace(ctx, height + 6);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - height,
    width,
    height,
    color: ACCENT_SOFT,
    borderColor: ACCENT,
    borderWidth: 0.6,
  });

  let cy = ctx.y - 10;
  for (const r of rows) {
    const size = r.emphasis ? F16 : F12;
    const font = r.emphasis ? ctx.bold : ctx.regular;
    const color = r.emphasis ? ACCENT : TEXT;
    ctx.page.drawText(r.label, { x: MARGIN_X + padX, y: cy - size, size, font: ctx.regular, color: MUTED });
    const w = font.widthOfTextAtSize(r.value, size);
    ctx.page.drawText(r.value, {
      x: MARGIN_X + width - padX - w,
      y: cy - size,
      size,
      font,
      color,
    });
    cy -= lineH;
  }
  ctx.y -= height + 8;
}

// === Подпись (две колонки) ===
function drawSignatures(
  ctx: DocCtx,
  left: { title: string; lines: string[]; signName: string },
  right: { title: string; lines: string[]; signName: string },
) {
  ensureSpace(ctx, 110);
  ctx.y -= 14;
  const colW = (PAGE_W - MARGIN_X * 2 - 24) / 2;
  const yStart = ctx.y;
  const drawCol = (x: number, b: typeof left) => {
    let cy = yStart;
    ctx.page.drawText(b.title.toUpperCase(), {
      x,
      y: cy - 9,
      size: 8.5,
      font: ctx.bold,
      color: ACCENT,
    });
    cy -= 16;
    for (const l of b.lines.filter(Boolean)) {
      const wrapped = wrapText(ctx.regular, l, F11, colW);
      for (const line of wrapped) {
        ctx.page.drawText(line, { x, y: cy - F11, size: F11, font: ctx.regular, color: TEXT });
        cy -= F11 * 1.35;
      }
    }
    cy -= 28;
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
  };
  drawCol(MARGIN_X, left);
  drawCol(MARGIN_X + colW + 24, right);
  ctx.y -= 110;
}

// === Утилиты ===
function header(order: DocOrder) {
  const numFromDb = ((order as { order_number?: string | null }).order_number ?? "").trim();
  return {
    num: numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase(),
    date: fmtDate(new Date()),
  };
}

async function createCtx(): Promise<DocCtx> {
  const [regBytes, boldBytes, dispBytes] = [loadRegular(), loadBold(), loadDisplay()];
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // subset:true → встраиваем только использованные глифы (минимизируем вес).
  const regular = await pdf.embedFont(regBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const display = await pdf.embedFont(dispBytes, { subset: true });
  // ставим как default fallback на StandardFonts (на всякий случай — для emoji не нужно).
  void StandardFonts;
  const ctx: DocCtx = { pdf, regular, bold, display, page: pdf.addPage([PAGE_W, PAGE_H]), y: 0, pageNum: 1 };

  ctx.y = PAGE_H - MARGIN_TOP;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: ACCENT });
  return ctx;
}

// === Builders для каждого вида документа ===

async function buildQuote(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx();
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
  drawParagraph(
    ctx,
    `${settings.quote_footer} Предложение действительно ${settings.quote_validity_days} дней. ${settings.vat_note}.`,
    { size: 9.5, color: MUTED },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildInvoice(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx();
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

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const paid = Number(order.paid ?? 0);
  const debt = Math.max(0, total - paid);
  gap(ctx, 6);
  drawSummary(ctx, [
    { label: `Итого, ${settings.vat_note}`, value: money(total) },
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
  const ctx = await createCtx();
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
    size: 10,
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
  drawParagraph(ctx, `2.1. Общая стоимость услуг по Договору составляет ${money(total)}, ${settings.vat_note}.`, { size: F11 });
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
  const ctx = await createCtx();
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

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  gap(ctx, 6);
  drawSummary(ctx, [
    { label: "ИТОГО оказано услуг на сумму", value: money(total), emphasis: true },
    { label: settings.vat_note, value: "—" },
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
import { quoteCompany, quoteNumberDisplay, buildPlaceholderValues, buildNumericValues, effectiveBlocks, blockText } from "@/lib/documents/quote-html";
import { applyPlaceholders } from "@/lib/quote-blocks";

function bulletList(ctx: DocCtx, text: string) {
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    drawParagraph(ctx, `•  ${line}`, { size: F11, indent: 6 });
  }
}

export async function buildStandaloneQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  const c = quoteCompany(quote, settings);
  const eff: DocumentSettings = {
    ...settings,
    company_legal_name: c.legal,
    company_brand: c.brand,
    company_unp: c.unp,
    company_address: c.address,
    company_phone: c.phone,
    company_email: c.email,
    company_website: c.website,
    bank_name: c.bank_name,
    bank_bic: c.bank_bic,
    bank_account: c.bank_account,
    signer_name: c.signer_name,
    signer_title: c.signer_title,
  };

  const ctx = await createCtx();
  drawHeader(ctx, "Коммерческое предложение", quoteNumberDisplay(quote), fmtDate(quote.doc_date), eff);

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
    drawText(ctx, title, { size: F13, bold: true, color: ACCENT });
    gap(ctx, 2);
  };

  for (const b of effectiveBlocks(quote, items, settings)) {
    if (hidden.has(b.type)) continue;
    const text = blockText(b, quote, map, numbers);

    switch (b.type) {
      case "cover": {
        drawText(ctx, applyPlaceholders(quote.title || "Предложение по организации мероприятия", map, numbers), { size: F22, bold: true });
        gap(ctx, 4);
        if (text) drawParagraph(ctx, text, { size: F11, color: MUTED });
        gap(ctx, 6);
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
        drawCard(ctx, b.title || "Мероприятие", "Детали", [
          quote.event_date ? `Дата: ${fmtDate(quote.event_date)}` : null,
          quote.event_time_start || quote.event_time_end
            ? `Время: ${[quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — ")}`
            : null,
          quote.venue ? `Площадка: ${quote.venue}` : null,
          quote.guests_count != null ? `Гостей: ${quote.guests_count}` : null,
          quote.event_format ? `Формат: ${quote.event_format}` : null,
          quote.setup_note ? `Монтаж/демонтаж: ${quote.setup_note}` : null,
        ]);
        if (quote.event_notes) {
          gap(ctx, 4);
          drawParagraph(ctx, quote.event_notes, { size: F11, color: MUTED });
        }
        break;
      }
      case "items": {
        heading(b.title || "Состав предложения");
        drawTable(
          ctx,
          [
            { title: "Позиция", width: PAGE_W - MARGIN_X * 2 - 70 - 80 - 90, key: "title" },
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
            const rows: Array<{ title: string; qty: string; price: string; sum: string }> = [];
            for (const [section, list] of groups) {
              if (section) rows.push({ title: section.toUpperCase(), qty: "", price: "", sum: "" });
              for (const it of list) {
                const lines = [it.title];
                if (it.description) lines.push(it.description);
                if (showIncludes && it.includes?.length) {
                  for (const inc of it.includes) lines.push(`• ${inc.text}${inc.note ? ` — ${inc.note}` : ""}`);
                }
                rows.push({
                  title: lines.join("\n"),
                  qty: `${it.qty} ${it.unit ?? ""}`.trim(),
                  price: money(Number(it.price)),
                  sum: money(Number(it.price) * Number(it.qty)),
                });
              }
              if (showSubtotals && section && list.length > 1) {
                rows.push({
                  title: `Итого по разделу «${section}»`,
                  qty: "",
                  price: "",
                  sum: money(list.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0)),
                });
              }
            }
            return rows;
          })(),
        );

        break;
      }
      case "totals": {
        gap(ctx, 8);
        drawSummary(ctx, [
          { label: "Стоимость позиций", value: money(t.subtotal) },
          ...(t.discount ? [{ label: "Скидка", value: `− ${money(t.discount)}` }] : []),
          ...(t.delivery ? [{ label: "Доставка и логистика", value: money(t.delivery) }] : []),
          { label: "ИТОГО", value: money(t.total), emphasis: true },
          ...(t.prepayment
            ? [
                { label: "Предоплата", value: money(t.prepayment) },
                { label: "Остаток", value: money(t.balance) },
              ]
            : []),
        ]);
        drawParagraph(ctx, `${amountToWords(t.total)}. ${quote.vat_note || settings.vat_note}`, { size: 9.5, color: MUTED });
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
  const validity = quote.validity_days ? `Предложение действительно ${quote.validity_days} дней. ` : "";
  drawParagraph(ctx, `${validity}${applyPlaceholders(quote.texts.footer || settings.quote_footer, map, numbers)}`, { size: 9.5, color: MUTED });

  drawFooter(ctx, eff);
  return await ctx.pdf.save();
}

// ===================== Промо-КП =====================
export async function buildPromoQuotePdf(
  quote: PromoQuoteT,
  items: PromoItemT[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  const ctx = await createCtx();
  const t = computePromoTotals(quote, items);
  drawHeader(
    ctx,
    "Коммерческое предложение",
    promoNumberDisplay(quote),
    fmtDate(quote.created_at || new Date().toISOString()),
    settings,
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
  const cols: Col[] = showNotes
    ? [
        { title: "Наименование", key: "title", width: tableW * 0.3 },
        { title: "Ед. изм.", key: "unit", width: tableW * 0.11, align: "center" },
        { title: "Кол-во", key: "qty", width: tableW * 0.08, align: "center" },
        { title: "Цена", key: "price", width: tableW * 0.12, align: "right" },
        { title: "Сумма", key: "sum", width: tableW * 0.13, align: "right" },
        { title: "Примечания", key: "note", width: tableW * 0.26 },
      ]
    : [
        { title: "Наименование", key: "title", width: tableW * 0.46 },
        { title: "Ед. изм.", key: "unit", width: tableW * 0.14, align: "center" },
        { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center" },
        { title: "Цена", key: "price", width: tableW * 0.15, align: "right" },
        { title: "Сумма", key: "sum", width: tableW * 0.15, align: "right" },
      ];

  const rows: Array<Record<string, string>> = [];
  for (const sec of groupBySection(items)) {
    if (sec.name) rows.push({ title: sec.name.toUpperCase(), unit: "", qty: "", price: "", sum: "", note: "" });
    for (const it of sec.items) {
      const lines = [safe(it.title)];
      if (quote.show_item_includes && it.includes.length) {
        for (const inc of it.includes) lines.push(`• ${safe(inc.text)}${inc.note ? ` — ${safe(inc.note)}` : ""}`);
      }
      rows.push({
        title: lines.join("\n"),
        unit: safe(it.unit),
        qty: String(lineQty(it)),
        price: it.price ? money(it.price) : "",
        sum: lineTotal(it) ? money(lineTotal(it)) : "",
        note: safe(it.note),
      });
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      rows.push({
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
    rows.push({ title: quote.management_label, unit: "услуга", qty: "—", price: "", sum: money(t.management), note: "" });
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
  drawTable(ctx, cols, rows.length ? rows : [{ title: "Позиции не добавлены", unit: "", qty: "", price: "", sum: "", note: "" }]);

  gap(ctx, 6);
  drawSummary(ctx, [
    { label: `Всего${quote.vat_enabled ? ", без НДС" : ""}`, value: money(t.subtotal) },
    ...(quote.vat_enabled ? [{ label: `НДС ${quote.vat_rate}%`, value: money(t.vat) }] : []),
    { label: `Итого${quote.vat_enabled ? ", с НДС" : ""}`, value: money(t.totalWithVat), emphasis: true },
  ]);

  if (quote.footer_note) {
    gap(ctx, 4);
    drawParagraph(ctx, quote.footer_note, { size: 9.5, color: MUTED });
  }

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}
