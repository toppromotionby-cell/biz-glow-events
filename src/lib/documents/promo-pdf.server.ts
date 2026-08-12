/**
 * PDF промо-КП — точная копия HTML-превью.
 *
 * Рендер идёт из общего макета `buildDocLayout()` (тот же источник, что и
 * превью `promo-quote-html.ts` и выгрузка в Таблицы), поэтому колонки, строки,
 * объединения «услуга», итоги и примечания в файле всегда совпадают с тем,
 * что видно на экране. Стили (цвета, рамки, кегли) повторяют CSS превью.
 */
import { embedImageUrl } from "@/lib/documents/image-embed.server";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { DOC_LAYOUT, hexToRgb01 } from "@/lib/documents/brand";
import { buildDocLayout, type DocColumn, type DocLayout, type DocRow } from "@/lib/documents/doc-layout";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { resolveDocFont, type DocFont } from "@/lib/documents/doc-font";
import type { PromoItem, PromoQuote } from "@/lib/promo-quote-model";

// === Палитра превью (см. PROMO_DOC_CSS) ===
const C = (hex: string) => {
  const c = hexToRgb01(hex);
  return rgb(c.r, c.g, c.b);
};
const INK = C("#16161a");
const NOTE_INK = C("#45454d");
const MUTED = C("#5a5a63");
const LINE = C("#d8d8dd");
const LINE_STRONG = C("#b9b9bf");
const SEC_BG = C("#e7e7ea");
const SUB_BG = C("#f4f4f6");
const EXTRA_BG = C("#fbfbfc");
const META_BG = C("#f6f6f7");
const VAL_BG = C("#fff8ea");
const WHITE = rgb(1, 1, 1);

const PAGE_W = DOC_LAYOUT.pageWidthPt;
const PAGE_H = DOC_LAYOUT.pageHeightPt;
const MARGIN_X = DOC_LAYOUT.marginXPt;
const MARGIN_TOP = DOC_LAYOUT.marginTopPt;
const MARGIN_BOTTOM = DOC_LAYOUT.marginBottomPt;

// Кегли превью (px) в pt: 12px основной текст, 11px мелкий.
const PX = 0.75;
const FS_BODY = 12 * PX;
const FS_SMALL = 11 * PX;
const FS_REQ = 10 * PX;
const FS_DOCNUM = 13 * PX;
const LH = 1.3;
const PAD_X = 5;
const PAD_Y = 4;

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  accent: ReturnType<typeof rgb>;
};

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) <= maxW) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      if (font.widthOfTextAtSize(w, size) > maxW) {
        let cur = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(cur + ch, size) > maxW && cur) {
            out.push(cur);
            cur = ch;
          } else cur += ch;
        }
        line = cur;
      } else line = w;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN_TOP;
}

/** Рамка ячейки + заливка (как border-collapse в превью). */
function cellBox(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  fill?: ReturnType<typeof rgb>,
  border: ReturnType<typeof rgb> = LINE,
) {
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    ...(fill ? { color: fill } : {}),
    borderColor: border,
    borderWidth: 0.5,
  });
}

function drawLines(
  page: PDFPage,
  lines: string[],
  opts: {
    x: number;
    w: number;
    yTop: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    align: "left" | "center" | "right";
  },
) {
  let y = opts.yTop;
  for (const line of lines) {
    const tw = opts.font.widthOfTextAtSize(line, opts.size);
    const x =
      opts.align === "center"
        ? opts.x + (opts.w - tw) / 2
        : opts.align === "right"
          ? opts.x + opts.w - tw
          : opts.x;
    page.drawText(line, { x, y: y - opts.size, size: opts.size, font: opts.font, color: opts.color });
    y -= opts.size * LH;
  }
}

/** Логотип: webp/avif конвертируются загрузчиком, ошибки не ломают документ. */
async function embedLogo(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  return await embedImageUrl(pdf, url, { width: 800 });
}

/** Ширины колонок в pt: доли из макета + гарантированный минимум под текст. */
function columnWidths(ctx: Ctx, layout: DocLayout, tableW: number): number[] {
  const widths = layout.columns.map((c) => c.width * tableW);
  const isFlex = (key: string) => key === "title" || key === "note";
  const flexIdx = layout.columns.map((c, i) => (isFlex(c.key) ? i : -1)).filter((i) => i >= 0);
  /** Минимум для «резиновых» колонок: подпись и самое длинное слово должны влезать. */
  const flexMin = new Map<number, number>();

  layout.columns.forEach((c, i) => {
    if (isFlex(c.key)) {
      let word = ctx.bold.widthOfTextAtSize(c.label, FS_BODY);
      for (const r of layout.rows) {
        const v = r.cells[c.key];
        if (!v) continue;
        for (const w of v.split(/\s+/)) word = Math.max(word, ctx.bold.widthOfTextAtSize(w, FS_BODY));
      }
      flexMin.set(i, Math.min(tableW * 0.3, word + PAD_X * 2 + 2));
      return;
    }
    let need = ctx.bold.widthOfTextAtSize(c.label, FS_BODY);
    for (const r of layout.rows) {
      if (r.serviceRow && ["unit", "qty", "rate_unit", "multiplier"].includes(c.key)) continue;
      const v = r.cells[c.key];
      if (v) need = Math.max(need, ctx.bold.widthOfTextAtSize(v, FS_BODY));
    }
    need += PAD_X * 2 + 1;
    widths[i] = Math.max(widths[i], need);
  });

  // Переполнение снимаем с «резиновых» колонок, не опускаясь ниже минимума.
  for (let pass = 0; pass < 4; pass += 1) {
    const overflow = widths.reduce((s, w) => s + w, 0) - tableW;
    if (overflow <= 0.01 || !flexIdx.length) break;
    const shrinkable = flexIdx.filter((i) => widths[i] > (flexMin.get(i) ?? 60) + 0.5);
    if (!shrinkable.length) break;
    const room = shrinkable.reduce((s, i) => s + widths[i] - (flexMin.get(i) ?? 60), 0);
    const take = Math.min(overflow, room);
    for (const i of shrinkable) {
      const free = widths[i] - (flexMin.get(i) ?? 60);
      widths[i] -= (take * free) / (room || 1);
    }
  }

  const diff = tableW - widths.reduce((s, w) => s + w, 0);
  if (Math.abs(diff) > 0.01) {
    const i = flexIdx.at(-1) ?? widths.length - 1;
    widths[i] += diff;
  }
  return widths;
}


type Cell = {
  lines: string[];
  extra?: string[]; // «что входит» — мелким серым
  align: "left" | "center" | "right";
  bold: boolean;
  color: ReturnType<typeof rgb>;
  span: number;
};

/** Строка превью → набор ячеек PDF (учтены объединения и служебные строки). */
function rowCells(ctx: Ctx, layout: DocLayout, r: DocRow, widths: number[]): Cell[] {
  const cols = layout.columns;
  const cell = (text: string, col: DocColumn, opt: Partial<Cell> = {}, w = 0): Cell => ({
    lines: wrap(opt.bold ? ctx.bold : ctx.regular, text, FS_BODY, Math.max(10, w - PAD_X * 2)),
    align: opt.align ?? col.align,
    bold: opt.bold ?? false,
    color: opt.color ?? INK,
    span: opt.span ?? 1,
    ...(opt.extra ? { extra: opt.extra } : {}),
  });

  if (r.kind === "section") {
    const w = widths.reduce((s, x) => s + x, 0);
    return [
      {
        lines: wrap(ctx.bold, r.cells.title ?? "", FS_BODY, w - PAD_X * 2),
        align: "left",
        bold: true,
        color: INK,
        span: cols.length,
      },
    ];
  }

  if (r.kind === "subtotal") {
    // Подпись занимает всё до колонки «Всего», сумма — в самой колонке сумм.
    const amountIdx = Math.max(1, cols.findIndex((c) => c.key === "amount"));
    const headW = widths.slice(0, amountIdx).reduce((s, x) => s + x, 0);
    const out: Cell[] = [
      {
        lines: wrap(ctx.bold, r.cells.title ?? "", FS_BODY, headW - PAD_X * 2),
        align: "right",
        bold: true,
        color: INK,
        span: amountIdx,
      },
      cell(r.cells.amount ?? "", cols[amountIdx], { bold: true }, widths[amountIdx]),
    ];
    for (let i = amountIdx + 1; i < cols.length; i += 1) out.push(cell("", cols[i], {}, widths[i]));
    return out;
  }


  const isExtra = r.kind === "extra";
  const out: Cell[] = [];
  let i = 0;
  while (i < cols.length) {
    const col = cols[i];
    // Объединение «услуга»: ед. изм. + кол-во (+ вторые ед./кол-во).
    if (r.serviceRow && col.key === "unit") {
      let span = 1;
      while (
        i + span < cols.length &&
        ["qty", "rate_unit", "multiplier"].includes(cols[i + span].key)
      )
        span += 1;
      const w = widths.slice(i, i + span).reduce((s, x) => s + x, 0);
      out.push({
        lines: wrap(ctx.regular, r.cells.unit || "услуга", FS_BODY, w - PAD_X * 2),
        align: "center",
        bold: false,
        color: INK,
        span,
      });
      i += span;
      continue;
    }
    const isTitle = col.key === "title";
    out.push(
      cell(
        r.cells[col.key] ?? "",
        col,
        {
          bold: isTitle,
          color: col.key === "note" ? NOTE_INK : isExtra ? MUTED : INK,
          ...(isTitle && r.includes.length ? { extra: r.includes } : {}),
        },
        widths[i],
      ),
    );
    i += 1;
  }
  return out;
}

function cellHeight(c: Cell): number {
  const extraH = (c.extra?.length ?? 0) * FS_SMALL * LH;
  return c.lines.length * FS_BODY * LH + extraH;
}

function rowFill(kind: DocRow["kind"]): ReturnType<typeof rgb> | undefined {
  if (kind === "section") return SEC_BG;
  if (kind === "subtotal") return SUB_BG;
  if (kind === "extra") return EXTRA_BG;
  return undefined;
}

export async function buildPromoQuotePreviewPdf(
  quote: PromoQuote,
  items: PromoItem[],
  opts: { companyLine?: string; fontDefault?: unknown } = {},
): Promise<Uint8Array> {
  const layout = buildDocLayout(quote, items, { companyLine: opts.companyLine ?? "" });
  const font: DocFont = resolveDocFont(quote.font_family, opts.fontDefault);
  const set = pdfFontSet(font);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(set.regular, { subset: true });
  const bold = await pdf.embedFont(set.bold, { subset: true });

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN_TOP,
    regular,
    bold,
    accent: C(layout.accent),
  };

  const contentW = PAGE_W - MARGIN_X * 2;

  // === Шапка: слева блок «мета», справа логотип и реквизиты ===
  const [logo, clientLogo] = await Promise.all([
    embedLogo(pdf, quote.logo_url),
    embedLogo(pdf, quote.client_logo_url),
  ]);

  const rightW = logo || layout.companyLine ? Math.min(contentW * 0.42, 230) : 0;
  const metaW = Math.min(contentW - (rightW ? rightW + 18 : 0), 330);
  const headTop = ctx.y;

  // мета-строки в рамке (одна под другой, без двойных линий)
  let metaY = headTop;
  for (const line of layout.meta) {
    const [k, ...rest] = line.split(": ");
    const label = `${k}: `;
    const value = rest.join(": ");
    const labelW = bold.widthOfTextAtSize(label, FS_BODY);
    const valueLines = wrap(regular, value, FS_BODY, metaW - PAD_X * 2 - labelW);
    const h = valueLines.length * FS_BODY * LH + PAD_Y * 2;
    cellBox(ctx.page, MARGIN_X, metaY, metaW, h, META_BG);
    ctx.page.drawText(label, {
      x: MARGIN_X + PAD_X,
      y: metaY - PAD_Y - FS_BODY,
      size: FS_BODY,
      font: bold,
      color: INK,
    });
    drawLines(ctx.page, valueLines, {
      x: MARGIN_X + PAD_X + labelW,
      w: metaW - PAD_X * 2 - labelW,
      yTop: metaY - PAD_Y,
      size: FS_BODY,
      font: regular,
      color: INK,
      align: "left",
    });
    metaY -= h;
  }

  // логотип + реквизиты справа
  let rightY = headTop;
  if (rightW) {
    const rightX = PAGE_W - MARGIN_X - rightW;
    if (logo) {
      const maxH = 54;
      const k = Math.min(rightW / logo.width, maxH / logo.height);
      const w = logo.width * k;
      const h = logo.height * k;
      ctx.page.drawImage(logo, { x: rightX + rightW - w, y: rightY - h, width: w, height: h });
      rightY -= h + 4;
    }
    if (layout.companyLine) {
      const lines = wrap(regular, layout.companyLine, FS_REQ, rightW);
      drawLines(ctx.page, lines, {
        x: rightX,
        w: rightW,
        yTop: rightY,
        size: FS_REQ,
        font: regular,
        color: MUTED,
        align: "right",
      });
      rightY -= lines.length * FS_REQ * LH;
    }
    if (clientLogo) {
      const k = Math.min(rightW / clientLogo.width, 40 / clientLogo.height);
      const w = clientLogo.width * k;
      const h = clientLogo.height * k;
      ctx.page.drawImage(clientLogo, { x: rightX + rightW - w, y: rightY - h - 6, width: w, height: h });
      rightY -= h + 6;
    }
  }

  ctx.y = Math.min(metaY, rightY) - 16;

  // === Номер документа ===
  ctx.page.drawText(layout.docTitle, {
    x: MARGIN_X,
    y: ctx.y - FS_DOCNUM,
    size: FS_DOCNUM,
    font: bold,
    color: INK,
  });
  ctx.y -= FS_DOCNUM * LH + 6;

  // === Таблица позиций ===
  const widths = columnWidths(ctx, layout, contentW);
  const headLines = layout.columns.map((c, i) =>
    wrap(bold, c.label, FS_BODY, Math.max(10, widths[i] - PAD_X * 2)),
  );
  const headH = Math.max(...headLines.map((l) => l.length)) * FS_BODY * LH + PAD_Y * 2;

  const drawHead = () => {
    let x = MARGIN_X;
    layout.columns.forEach((_c, i) => {
      cellBox(ctx.page, x, ctx.y, widths[i], headH, ctx.accent, LINE_STRONG);
      const lines = headLines[i];
      const blockH = lines.length * FS_BODY * LH;
      drawLines(ctx.page, lines, {
        x: x + PAD_X,
        w: widths[i] - PAD_X * 2,
        yTop: ctx.y - (headH - blockH) / 2,
        size: FS_BODY,
        font: bold,
        color: INK,
        align: "center",
      });
      x += widths[i];
    });
    ctx.y -= headH;
  };

  if (ctx.y - headH - 40 < MARGIN_BOTTOM) newPage(ctx);
  drawHead();

  const rows: DocRow[] = layout.rows.length
    ? layout.rows
    : [
        {
          kind: "item",
          cells: { title: layout.emptyLabel },
          numbers: {},
          includes: [],
          counted: false,
          commissionable: false,
        },
      ];

  for (let ri = 0; ri < rows.length; ri += 1) {
    const r = rows[ri];
    const cells = rowCells(ctx, layout, r, widths);
    const rowH = Math.max(...cells.map(cellHeight)) + PAD_Y * 2;

    // заголовок раздела не отрывается от первой позиции
    const glue =
      r.kind === "section" && rows[ri + 1]
        ? Math.max(...rowCells(ctx, layout, rows[ri + 1], widths).map(cellHeight)) + PAD_Y * 2
        : 0;
    if (ctx.y - rowH - glue < MARGIN_BOTTOM) {
      newPage(ctx);
      drawHead();
    }

    const fill = rowFill(r.kind);
    let x = MARGIN_X;
    let ci = 0;
    for (const c of cells) {
      const w = widths.slice(ci, ci + c.span).reduce((s, v) => s + v, 0);
      cellBox(ctx.page, x, ctx.y, w, rowH, fill ?? WHITE);
      const blockH = cellHeight(c);
      let yTop = ctx.y - Math.max(PAD_Y, (rowH - blockH) / 2);
      drawLines(ctx.page, c.lines, {
        x: x + PAD_X,
        w: w - PAD_X * 2,
        yTop,
        size: FS_BODY,
        font: c.bold ? bold : regular,
        color: c.color,
        align: c.align,
      });
      yTop -= c.lines.length * FS_BODY * LH;
      if (c.extra?.length) {
        const extraLines = c.extra.flatMap((t) => wrap(regular, t, FS_SMALL, w - PAD_X * 2 - 8));
        drawLines(ctx.page, extraLines, {
          x: x + PAD_X + 8,
          w: w - PAD_X * 2 - 8,
          yTop,
          size: FS_SMALL,
          font: regular,
          color: MUTED,
          align: "left",
        });
      }
      x += w;
      ci += c.span;
    }
    ctx.y -= rowH;
  }

  // === Итоги (таблица справа, как в превью) ===
  ctx.y -= 10;
  const totalsW = Math.min(240, contentW);
  const totalsX = PAGE_W - MARGIN_X - totalsW;
  const labelW = totalsW * 0.58;
  const valueW = totalsW - labelW;
  const totalsH = layout.totals.reduce(
    (s, t) => s + (t.grand ? FS_DOCNUM : FS_BODY) * LH + PAD_Y * 2,
    0,
  );
  if (ctx.y - totalsH < MARGIN_BOTTOM) newPage(ctx);

  for (const t of layout.totals) {
    const size = t.grand ? FS_DOCNUM : FS_BODY;
    const h = size * LH + PAD_Y * 2;
    const value = `${t.sign === "minus" ? "− " : ""}${new Intl.NumberFormat("ru-BY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(t.value)}${t.grand ? ` ${quote.currency}` : ""}`;
    cellBox(ctx.page, totalsX, ctx.y, labelW, h, ctx.accent, LINE_STRONG);
    cellBox(ctx.page, totalsX + labelW, ctx.y, valueW, h, VAL_BG, LINE_STRONG);
    drawLines(ctx.page, [`${t.label}:`], {
      x: totalsX + PAD_X,
      w: labelW - PAD_X * 2,
      yTop: ctx.y - PAD_Y,
      size,
      font: bold,
      color: INK,
      align: "right",
    });
    drawLines(ctx.page, [value], {
      x: totalsX + labelW + PAD_X,
      w: valueW - PAD_X * 2,
      yTop: ctx.y - PAD_Y,
      size,
      font: t.grand ? bold : regular,
      color: INK,
      align: "right",
    });
    ctx.y -= h;
  }

  // === Примечание ===
  if (layout.footerNote) {
    ctx.y -= 14;
    const lines = layout.footerNote.split("\n").flatMap((l) => wrap(regular, l, FS_SMALL, contentW));
    if (ctx.y - lines.length * FS_SMALL * LH < MARGIN_BOTTOM) newPage(ctx);
    drawLines(ctx.page, lines, {
      x: MARGIN_X,
      w: contentW,
      yTop: ctx.y,
      size: FS_SMALL,
      font: regular,
      color: NOTE_INK,
      align: "left",
    });
    ctx.y -= lines.length * FS_SMALL * LH;
  }

  // Нумерация страниц (в превью её нет — только для многостраничных файлов)
  const total = pdf.getPageCount();
  if (total > 1) {
    for (let i = 0; i < total; i += 1) {
      const p = pdf.getPage(i);
      const label = `${i + 1} / ${total}`;
      const w = regular.widthOfTextAtSize(label, FS_SMALL);
      p.drawText(label, {
        x: PAGE_W - MARGIN_X - w,
        y: MARGIN_BOTTOM - 16,
        size: FS_SMALL,
        font: regular,
        color: MUTED,
      });
    }
  }

  return await pdf.save();
}
