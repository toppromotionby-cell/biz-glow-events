// Таблица позиций и блок итогов.
import { rgb, type PDFFont } from "pdf-lib";
import { displayFont, type DocCtx } from "@/lib/documents/pdf/ctx.server";
import {
  drawTracked, trackedWidth, ensureSpace, money, newPage, roundedRect, safe, wrapText,
} from "@/lib/documents/pdf/draw.server";
import {
  ACCENT, ACCENT_BORDER, ACCENT_SOFT, LINE, M, MUTED, PAGE_W, SURFACE, TEXT,
} from "@/lib/documents/pdf/style.server";

export type Col = {
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
export type TableSpan = { from: string; to: string; text: string };

export type TableRow = Record<string, string | string[] | TableSpan | undefined> & {
  _kind?: "section" | "subtotal";
  _desc?: string;
  _bullets?: string[];
  /** Объединение соседних колонок в одну ячейку (например «услуга»). */
  _span?: { from: string; to: string; text: string };
};

/** Ширина самого длинного слова заголовка колонки (капсом, с трекингом). */
function headWordWidth(ctx: DocCtx, title: string): number {
  return Math.max(
    0,
    ...title
      .toUpperCase()
      .split(" ")
      .map((word) => trackedWidth(ctx.bold, word, M.F_DOC_KIND, M.F_DOC_KIND * 0.08)),
  );
}

/**
 * Подгоняет ширины узких колонок под самый длинный текст, а остаток отдаёт
 * «Наименованию» и «Примечаниям» (примечаниям — большая доля).
 *
 * Колонка никогда не становится уже самого длинного слова своего заголовка:
 * иначе шапка выходит за границу ячейки и налезает на соседнюю.
 */
export function fitTableCols(ctx: DocCtx, cols: Col[], rows: TableRow[], tableW: number) {
  const flexKeys = new Set(["title", "note"]);
  const pad = 15;
  const cap = tableW * 0.18;
  const desired = new Map<string, number>();
  const minimal = new Map<string, number>();
  let narrowDesired = 0;
  let narrowMin = 0;
  for (const c of cols) {
    if (flexKeys.has(c.key)) continue;
    let w = headWordWidth(ctx, c.title);
    const min = Math.min(cap, w + 8);
    const MERGED = new Set(["unit", "qty", "rate_unit", "multiplier"]);
    for (const r of rows) {
      if (r._span && MERGED.has(c.key)) continue;
      const v = typeof r[c.key] === "string" ? (r[c.key] as string) : "";
      if (v) w = Math.max(w, ctx.regular.widthOfTextAtSize(v, M.F11));
    }
    const width = Math.max(min, Math.min(cap, w + pad));
    desired.set(c.key, width);
    minimal.set(c.key, min);
    narrowDesired += width;
    narrowMin += min;
  }
  const flexCols = cols.filter((c) => flexKeys.has(c.key));
  if (!flexCols.length) {
    // Таблица без «резиновых» колонок: раскладываем остаток пропорционально.
    const k = tableW / (narrowDesired || 1);
    for (const c of cols) c.width = (desired.get(c.key) ?? 0) * k;
    return;
  }
  const hasNote = flexCols.some((c) => c.key === "note");
  const restWanted = tableW * (hasNote ? 0.42 : 0.24);
  const availNarrow = tableW - restWanted;

  const finalNarrow = new Map<string, number>();
  if (narrowDesired <= availNarrow) {
    for (const [k, v] of desired) finalNarrow.set(k, v);
  } else if (narrowMin <= availNarrow) {
    // Сжимаем «лишнее» сверх минимума, минимум остаётся неприкосновенным.
    const slack = narrowDesired - narrowMin;
    const keep = (availNarrow - narrowMin) / (slack || 1);
    for (const [k, v] of desired) {
      const min = minimal.get(k) ?? 0;
      finalNarrow.set(k, min + (v - min) * keep);
    }
  } else {
    // Даже минимумы не помещаются — жмём их пропорционально; шапка и числа
    // дополнительно уменьшатся по кеглю при отрисовке.
    const k = availNarrow / (narrowMin || 1);
    for (const key of desired.keys()) finalNarrow.set(key, (minimal.get(key) ?? 0) * k);
  }

  const narrowTotal = [...finalNarrow.values()].reduce((s, v) => s + v, 0);
  const rest = Math.max(tableW * 0.18, tableW - narrowTotal);
  for (const c of cols) {
    if (flexKeys.has(c.key)) c.width = hasNote ? rest * (c.key === "note" ? 0.56 : 0.44) : rest;
    else c.width = finalNarrow.get(c.key) ?? 0;
  }
}

/**
 * Значение обычной ячейки: сначала пробуем уложить в одну строку, слегка
 * уменьшив кегль (важно для сумм вида «5 250,00 BYN» — их нельзя рвать),
 * и только если не получилось — обычный перенос по словам.
 */
function fitCell(ctx: DocCtx, text: string, maxWidth: number): { lines: string[]; size: number } {
  const value = safe(text);
  if (!value) return { lines: [], size: M.F11 };
  const avail = Math.max(1, maxWidth);
  if (ctx.regular.widthOfTextAtSize(value, M.F11) <= avail) return { lines: [value], size: M.F11 };
  const min = M.F11 * 0.72;
  for (let s = M.F11 - 0.25; s >= min; s -= 0.25) {
    if (ctx.regular.widthOfTextAtSize(value, s) <= avail) {
      return { lines: [value], size: Math.round(s * 100) / 100 };
    }
  }
  return { lines: wrapText(ctx.regular, value, M.F11, avail), size: M.F11 };
}


export function drawTable(ctx: DocCtx, cols: Col[], rows: TableRow[]) {
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const startX = M.MARGIN_X;
  const cellPadX = 6;
  const RD = M.D * M.ROW_K;
  const headerH = 22 * RD;
  const rowMinH = 18 * RD;
  const SMALL = M.F11 - 1;

  // Шапка: для каждой колонки подбираем кегль так, чтобы самое длинное слово
  // помещалось в ячейку; при необходимости переносим по словам, а совсем
  // длинное слово режем с дефисом. Так заголовки не налезают друг на друга.
  const HEAD_MIN = Math.max(5, M.F_DOC_KIND * 0.62);
  const head = cols.map((c) => {
    const title = c.title.toUpperCase();
    const avail = Math.max(1, c.width - cellPadX * 2);
    let size = M.F_DOC_KIND;
    const trackOf = (s: number) => s * 0.08;
    const wordFits = (s: number) =>
      title.split(" ").every((w) => trackedWidth(ctx.bold, w, s, trackOf(s)) <= avail);
    while (size > HEAD_MIN && !wordFits(size)) size = Math.round((size - 0.25) * 100) / 100;
    const tracking = trackOf(size);
    const width = (s: string) => trackedWidth(ctx.bold, s, size, tracking);

    if (width(title) <= avail) return { lines: [title], size, tracking };

    const lines: string[] = [];
    const pushWord = (word: string) => {
      if (width(word) <= avail) {
        lines.push(word);
        return;
      }
      // Слово шире ячейки даже на минимальном кегле — режем по буквам.
      let chunk = "";
      for (const ch of word) {
        if (chunk && width(`${chunk}${ch}-`) > avail) {
          lines.push(`${chunk}-`);
          chunk = ch;
        } else chunk += ch;
      }
      if (chunk) lines.push(chunk);
    };
    let cur = "";
    for (const w of title.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && width(next) > avail) {
        lines.push(cur);
        cur = "";
        pushWord(w);
        cur = lines.pop() ?? "";
      } else cur = next;
    }
    if (cur) pushWord(cur);
    return { lines, size, tracking };
  });
  const headLineH = Math.max(...head.map((h) => h.size)) + 4;
  const headRows = Math.max(1, ...head.map((h) => h.lines.length));
  const headH = Math.max(headerH, headRows * headLineH + 10);

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
      const h = head[ci];
      const lineH = headLineH;
      const blockH = h.lines.length * lineH;
      let ly = ctx.y - headH + (headH - blockH) / 2 + blockH - lineH + 1;
      for (const line of h.lines) {
        const w = trackedWidth(ctx.bold, line, h.size, h.tracking);
        let tx = hx + cellPadX;
        if (c.align === "right") tx = hx + c.width - cellPadX - w;
        else if (c.align === "center") tx = hx + (c.width - w) / 2;
        // страховка: текст не выходит за границы своей ячейки
        tx = Math.max(hx + cellPadX, Math.min(tx, hx + c.width - cellPadX - w));
        drawTracked(ctx.page, line, {
          x: tx,
          y: ly,
          size: h.size,
          font: ctx.bold,
          color: TEXT,
          tracking: h.tracking,
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
    if (ctx.y - needed < M.MARGIN_BOTTOM) {
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
      const size = isSub ? SMALL : M.F12;
      const labelW = totalW - (cols.at(-1)?.width ?? 0) - cellPadX * 2;
      const lines = wrapText(font, label, size, labelW);
      return Math.max((isSub ? 18 : 24) * RD, lines.length * size * M.LH + (isSub ? 8 : 12) * RD);
    }
    const titleW = firstCol.width - cellPadX * 2;
    const titleLines = wrapText(ctx.bold, cellOf(r, firstCol.key), M.F11, titleW);
    const descLines = r._desc ? wrapText(ctx.regular, r._desc, SMALL, titleW) : [];
    const bulletLines = (r._bullets ?? []).flatMap((b) =>
      wrapText(ctx.regular, `•  ${b}`, SMALL, titleW - 8),
    );
    const firstBlockH =
      titleLines.length * M.F11 * M.LH + (descLines.length + bulletLines.length) * SMALL * M.LH;
    const restH =
      Math.max(
        ...cols.map((c, i) =>
          i === richIdx ? 0 : wrapText(ctx.regular, cellOf(r, c.key), M.F11, c.width - cellPadX * 2).length,
        ),
        1,
      ) *
      M.F11 *
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
      const size = isSub ? SMALL : M.F12;
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
        ly -= size * M.LH;
      }
      // сумма подытога — справа
      const last = cols.at(-1);
      const lastVal = last ? cell(last.key) : "";
      if (last && lastVal) {
        const vFont = isSub ? ctx.bold : ctx.regular;
        const vSize = isSub ? SMALL : M.F11;
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
    const titleLines = wrapText(ctx.bold, titleText, M.F11, titleW);
    const descLines = r._desc ? wrapText(ctx.regular, r._desc, SMALL, titleW) : [];
    const bulletLines = (r._bullets ?? []).flatMap((b) =>
      wrapText(ctx.regular, `•  ${b}`, SMALL, titleW - 8),
    );
    const restWrapped = cols.map((c, i) =>
      i === richIdx ? { lines: [] as string[], size: M.F11 } : fitCell(ctx, cell(c.key), c.width - cellPadX * 2),
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
      ctx.page.drawText(line, { x: richX + cellPadX, y: cy - M.F11, size: M.F11, font: ctx.bold, color: TEXT });
      cy -= M.F11 * M.LH;
    }
    for (const line of descLines) {
      ctx.page.drawText(line, { x: richX + cellPadX, y: cy - SMALL, size: SMALL, font: ctx.regular, color: MUTED });
      cy -= SMALL * M.LH;
    }
    for (const line of bulletLines) {
      ctx.page.drawText(line, { x: richX + cellPadX + 8, y: cy - SMALL, size: SMALL, font: ctx.regular, color: MUTED });
      cy -= SMALL * M.LH;
    }

    // объединённые колонки (например «услуга» вместо пустых единиц и количеств)
    const spanFrom = r._span ? cols.findIndex((c) => c.key === r._span!.from) : -1;
    const spanTo = r._span ? cols.findIndex((c) => c.key === r._span!.to) : -1;
    if (r._span && spanFrom >= 0 && spanTo >= spanFrom) {
      const sx = startX + cols.slice(0, spanFrom).reduce((s2, c) => s2 + c.width, 0);
      const sw = cols.slice(spanFrom, spanTo + 1).reduce((s2, c) => s2 + c.width, 0);
      const text = r._span.text;
      const w = ctx.regular.widthOfTextAtSize(text, M.F11);
      ctx.page.drawText(text, {
        x: sx + (sw - w) / 2,
        y: ctx.y - 5 * RD - M.F11,
        size: M.F11,
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
      const { lines, size: cellSize } = restWrapped[i];
      const blockH = Math.max(lines.length, 1) * cellSize * M.LH;
      let ly = c.valign === "middle" ? ctx.y - Math.max(5 * RD, (rowH - blockH) / 2) : ctx.y - 5 * RD;
      const color = c.key === "idx" ? MUTED : TEXT;
      for (const line of lines) {
        const w = ctx.regular.widthOfTextAtSize(line, cellSize);
        let tx = cx + cellPadX;
        if (c.align === "right") tx = cx + c.width - cellPadX - w;
        else if (c.align === "center") tx = cx + (c.width - w) / 2;
        tx = Math.max(cx + cellPadX, Math.min(tx, cx + c.width - cellPadX - w));
        ctx.page.drawText(line, { x: tx, y: ly - cellSize, size: cellSize, font: ctx.regular, color });
        ly -= cellSize * M.LH;
      }

      cx += c.width;
    }

    ctx.y -= rowH;
  }
}



// === Сводный блок «итого» (как в HTML-превью: справа, белый фон, акцентная строка «Итого») ===
export function drawSummary(
  ctx: DocCtx,
  rows: Array<{ label: string; value: string; emphasis?: boolean }>,
) {
  const width = Math.min(360 * 0.92, PAGE_W - M.MARGIN_X * 2);
  const x = PAGE_W - M.MARGIN_X - width;
  const padX = 13;
  const rowH = (r: { emphasis?: boolean }) => (r.emphasis ? M.F16 : M.F12) * M.LH_TOTAL + 8 * M.D;
  const height = rows.reduce((s, r) => s + rowH(r), 0);

  ensureSpace(ctx, height + 10 * M.D);
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
    const size = r.emphasis ? M.F16 : M.F12;
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
    // подпись тоже ужимаем, если вместе со значением не помещается в карточку
    const valueW0 = valueFont.widthOfTextAtSize(r.value, size);
    let lSize = size;
    let labelW = labelFont.widthOfTextAtSize(r.label, lSize);
    while (labelW + valueW0 > width - padX * 2 - 10 && lSize > size * 0.7) {
      lSize -= 0.4;
      labelW = labelFont.widthOfTextAtSize(r.label, lSize);
    }
    ctx.page.drawText(r.label, {
      x: x + padX,
      y: baseline,
      size: lSize,
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
  ctx.y -= height + 10 * M.D;
}
