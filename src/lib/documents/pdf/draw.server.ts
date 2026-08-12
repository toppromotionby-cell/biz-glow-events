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

function newPage(ctx: DocCtx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  ctx.y = PAGE_H - M.MARGIN_TOP;
  drawTopBar(ctx.page);
}

function ensureSpace(ctx: DocCtx, needed: number) {
  if (ctx.y - needed < M.MARGIN_BOTTOM) newPage(ctx);
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
function drawTrailingNote(
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

function divider(ctx: DocCtx, color = LINE) {
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

function gap(ctx: DocCtx, n: number) {
  ctx.y -= n * M.D * M.GAP_K;
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
