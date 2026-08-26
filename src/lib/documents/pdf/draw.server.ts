// Примитивы рисования: текст, переносы, плашки, разделители.
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BRAND_ACCENT, mixWithWhite } from "@/lib/documents/brand";
import { splitWordForWidth } from "@/lib/documents/hyphenate";
import type { DocCtx } from "@/lib/documents/pdf/ctx.server";
import { ACCENT, LINE, M, MUTED, PAGE_H, PAGE_W, SURFACE, TEXT, c01 } from "@/lib/documents/pdf/style.server";

export function money(n: number): string {
  // Intl.NumberFormat в воркере доступен; не используем символ валюты в
  // префиксе — выводим явно "BYN".
  const fmt = new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${fmt} BYN`;
}

/** Число без валюты — для узких колонок таблиц (валюта указана в шапке). */
export function num(n: number): string {
  return new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}


export function safe(s: unknown): string {
  return String(s ?? "").replace(/\s+\n/g, "\n").trim();
}

/** Прямоугольник со скруглением (pdf-lib умеет только через path). */
export function roundedRect(
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
export function drawTopBar(page: PDFPage) {
  const w = PAGE_W - M.MARGIN_X * 2;
  const y = PAGE_H - M.MARGIN_TOP + 14;
  const steps = 24;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const c = c01(mixWithWhite(BRAND_ACCENT, t * 0.55));
    page.drawRectangle({
      x: M.MARGIN_X + (w / steps) * i,
      y,
      width: w / steps + 0.6,
      height: 3.2,
      color: c,
    });
  }
}

export function newPage(ctx: DocCtx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  ctx.y = PAGE_H - M.MARGIN_TOP;
  drawTopBar(ctx.page);
}

export function ensureSpace(ctx: DocCtx, needed: number) {
  if (ctx.y - needed < M.MARGIN_BOTTOM) newPage(ctx);
}


export function drawText(
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
  const size = opts.size ?? M.F12;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const color = opts.color ?? TEXT;
  const txt = safe(text);
  const lines = txt.split("\n");
  for (const line of lines) {
    ensureSpace(ctx, size * M.LH_LOOSE);
    let x = opts.x ?? M.MARGIN_X;
    if (opts.align && opts.width) {
      const w = font.widthOfTextAtSize(line, size);
      if (opts.align === "right") x = (opts.x ?? M.MARGIN_X) + opts.width - w;
      else if (opts.align === "center") x = (opts.x ?? M.MARGIN_X) + (opts.width - w) / 2;
    }
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size * M.LH_TEXT;
  }
}

// Перенос длинной строки по ширине: сначала по словам, затем по слогам с дефисом
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const measure = (s: string) => font.widthOfTextAtSize(s, size);
  const words = safe(text).replace(/\u00ad/g, "").split(/\s+/);
  const out: string[] = [];
  let line = "";

  /** Уложить слово, которое не влезает целиком: слоговой перенос, иначе по буквам. */
  const placeLongWord = (word: string) => {
    let rest = word;
    let guard = 0;
    while (measure(rest) > maxWidth && guard++ < 200) {
      const avail = maxWidth - (line ? measure(`${line} `) : 0);
      const split = avail > size ? splitWordForWidth(rest, avail, measure) : null;
      if (split) {
        out.push(line ? `${line} ${split.head}` : split.head);
        line = "";
        rest = split.tail;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
        continue;
      }
      // Крайний случай — режем посимвольно (артикулы, ссылки без слогов)
      let cur = "";
      for (const ch of rest) {
        if (measure(cur + ch) > maxWidth && cur) break;
        cur += ch;
      }
      if (!cur) cur = rest[0] ?? "";
      out.push(cur);
      rest = rest.slice(cur.length);
      if (!rest) return;
    }
    line = line ? `${line} ${rest}` : rest;
  };

  for (const w of words) {
    if (!w) continue;
    const cand = line ? `${line} ${w}` : w;
    if (measure(cand) <= maxWidth) {
      line = cand;
      continue;
    }
    // Пробуем перенести само слово по слогам в остаток текущей строки
    if (line) {
      const avail = maxWidth - measure(`${line} `);
      const split = avail > size ? splitWordForWidth(w, avail, measure) : null;
      if (split) {
        out.push(`${line} ${split.head}`);
        line = "";
        if (measure(split.tail) <= maxWidth) {
          line = split.tail;
          continue;
        }
        placeLongWord(split.tail);
        continue;
      }
      out.push(line);
      line = "";
    }
    if (measure(w) <= maxWidth) line = w;
    else placeLongWord(w);
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}


export function drawParagraph(
  ctx: DocCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {},
) {
  const size = opts.size ?? M.F12;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const color = opts.color ?? TEXT;
  const indent = opts.indent ?? 0;
  const maxW = PAGE_W - M.MARGIN_X * 2 - indent;
  const paragraphs = safe(text).split("\n");
  for (const p of paragraphs) {
    const lines = wrapText(font, p, size, maxW);
    for (const line of lines) {
      ensureSpace(ctx, size * M.LH_LOOSE);
      ctx.page.drawText(line, { x: M.MARGIN_X + indent, y: ctx.y - size, size, font, color });
      ctx.y -= size * M.LH_LOOSE;
    }
  }
}

/**
 * Финальное примечание (условия/срок действия). В отличие от drawParagraph
 * не переносится на новую страницу из-за пары строк: сначала пробуем ужать
 * кегль и занять нижнее поле до линии футера.
 */
export function drawTrailingNote(
  ctx: DocCtx,
  text: string,
  opts: { size?: number; color?: ReturnType<typeof rgb> } = {},
) {
  const clean = safe(text).trim();
  if (!clean) return;
  const base = opts.size ?? 9.5;
  const color = opts.color ?? MUTED;
  const maxW = PAGE_W - M.MARGIN_X * 2;
  const floor = M.MARGIN_BOTTOM - 6; // чуть выше линии футера
  for (const size of [base, base - 0.5, base - 1, base - 1.5]) {
    if (size < 7.5) break;
    const lines = wrapText(ctx.regular, clean, size, maxW);
    const h = lines.length * size * M.LH_TEXT;
    if (ctx.y - h < floor) continue;
    for (const line of lines) {
      ctx.page.drawText(line, { x: M.MARGIN_X, y: ctx.y - size, size, font: ctx.regular, color });
      ctx.y -= size * M.LH_TEXT;
    }
    return;
  }
  drawParagraph(ctx, clean, { size: base, color });
}

export function divider(ctx: DocCtx, color = LINE) {
  ensureSpace(ctx, 8);
  ctx.y -= 4;
  ctx.page.drawLine({
    start: { x: M.MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - M.MARGIN_X, y: ctx.y },
    thickness: 0.6,
    color,
  });
  ctx.y -= 8;
}

export function gap(ctx: DocCtx, n: number) {
  ctx.y -= n * M.D * M.GAP_K;
}


/** Ширина строки с межбуквенным интервалом (как letter-spacing в CSS). */
export function trackedWidth(font: PDFFont, text: string, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + Math.max(text.length - 1, 0) * tracking;
}

/** Отрисовать строку капсом с межбуквенным интервалом. */
export function drawTracked(
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
