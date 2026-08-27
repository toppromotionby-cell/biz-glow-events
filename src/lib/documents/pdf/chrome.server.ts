// Обвязка документа: шапка, футер, карточки и блок подписей.
import { rgb, type PDFImage } from "pdf-lib";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { DOC_FONT_PT } from "@/lib/documents/brand";
import { DEFAULT_LOGO_LAYOUT, computeLogoPlacement, requisitesFontPt } from "@/lib/documents/logo-layout";
import { displayFont, type DocCtx } from "@/lib/documents/pdf/ctx.server";
import {
  divider, drawTracked, trackedWidth, ensureSpace, roundedRect, safe, wrapText,
} from "@/lib/documents/pdf/draw.server";
import { SIGN_MEDIA_MM } from "@/lib/documents/signature";
import { ACCENT, LINE, M, MUTED, PAGE_H, PAGE_W, SURFACE, TEXT } from "@/lib/documents/pdf/style.server";

export function drawHeader(
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
  const leftX: number = M.MARGIN_X;
  if (logo && place) {
    ctx.page.drawImage(logo.img, {
      x: place.x,
      y: PAGE_H - M.MARGIN_TOP - place.top - place.h + 2,
      width: place.w,
      height: place.h,
    });
  }

  // Тип/номер/дата справа — считаем первыми, чтобы знать ширину левой колонки
  const rightX = PAGE_W - M.MARGIN_X;
  const kindUpper = kind.toUpperCase();
  const kindTracking = M.F_DOC_KIND * 0.14;
  const kindW = trackedWidth(ctx.bold, kindUpper, M.F_DOC_KIND, kindTracking);
  const numText = `№ ${num}`;
  const numFont = displayFont(ctx, numText);
  const numW = numFont.widthOfTextAtSize(numText, M.F_DOC_NUM);
  const dateText = `от ${date}`;
  const dateW = ctx.regular.widthOfTextAtSize(dateText, M.F_DOC_DATE);
  const validText = extra.validUntil ? `действительно до ${extra.validUntil}` : "";
  const validW = validText ? ctx.regular.widthOfTextAtSize(validText, M.F_DOC_DATE) : 0;
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
  let textY = PAGE_H - M.MARGIN_TOP - textTop;
  if (showBrand) {
    const bFont = displayFont(ctx, brand);
    textY -= M.F22 * 0.8;
    ctx.page.drawText(brand, {
      x: alignedX(bFont.widthOfTextAtSize(brand, M.F22)),
      y: textY,
      size: M.F22,
      font: bFont,
      color: TEXT,
    });
    textY -= 14;
  } else {
    textY -= DOC_FONT_PT.small;
  }

  // Юрлицо + УНП и адрес — с переносом по ширине колонки; кегль подбирается под объём текста
  const legalLine = `${safe(settings.company_legal_name)}${
    safe(settings.company_unp) ? ` · УНП ${safe(settings.company_unp)}` : ""
  }`;
  const reqSize = requisitesFontPt(
    DOC_FONT_PT.small,
    `${legalLine} ${safe(settings.company_address)}`,
    textMaxW,
  );
  const subLines = [
    ...wrapText(ctx.regular, legalLine, reqSize, textMaxW),
    ...wrapText(ctx.regular, safe(settings.company_address), reqSize, textMaxW),
  ].filter((l) => l.trim() !== "");
  let subY = textY;
  for (const line of subLines) {
    ctx.page.drawText(line, {
      x: alignedX(ctx.regular.widthOfTextAtSize(line, reqSize)),
      y: subY,
      size: reqSize,
      font: ctx.regular,
      color: MUTED,
    });
    subY -= reqSize * M.LH_TEXT;
  }



  drawTracked(ctx.page, kindUpper, {
    x: rightX - kindW,
    y: PAGE_H - M.MARGIN_TOP - 4,
    size: M.F_DOC_KIND,
    font: ctx.bold,
    color: ACCENT,
    tracking: kindTracking,
  });
  ctx.page.drawText(numText, {
    x: rightX - numW,
    y: PAGE_H - M.MARGIN_TOP - 24,
    size: M.F_DOC_NUM,
    font: numFont,
    color: TEXT,
  });
  ctx.page.drawText(dateText, {
    x: rightX - dateW,
    y: PAGE_H - M.MARGIN_TOP - 40,
    size: M.F_DOC_DATE,
    font: ctx.regular,
    color: MUTED,
  });
  if (validText) {
    ctx.page.drawText(validText, {
      x: rightX - validW,
      y: PAGE_H - M.MARGIN_TOP - 54,
      size: M.F_DOC_DATE,
      font: ctx.regular,
      color: MUTED,
    });
  }

  // Высокий логотип может «вылезти» ниже текста — учитываем это
  const leftBottom = PAGE_H - subY;
  ctx.y = PAGE_H - Math.max(M.MARGIN_TOP + (validText ? 66 : 58), leftBottom + 6, M.MARGIN_TOP + (place?.reserve ?? 0) + 14);
  divider(ctx);


  // Логотип клиента (промо-КП) — справа под разделителем
  const cl = ctx.clientLogo ?? null;
  if (cl) {
    ctx.y -= 6;
    ctx.page.drawImage(cl.img, {
      x: PAGE_W - M.MARGIN_X - cl.w,
      y: ctx.y - cl.h,
      width: cl.w,
      height: cl.h,
    });
    ctx.y -= cl.h + 6;
  }
}


export function drawFooter(ctx: DocCtx, settings: DocumentSettings) {
  const footer = `${settings.company_legal_name} · ${settings.company_phone} · ${settings.company_email} · ${settings.company_website}`;
  const total = ctx.pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = ctx.pdf.getPage(i);
    p.drawLine({
      start: { x: M.MARGIN_X, y: M.MARGIN_BOTTOM - 12 },
      end: { x: PAGE_W - M.MARGIN_X, y: M.MARGIN_BOTTOM - 12 },
      thickness: 0.4,
      color: LINE,
    });
    p.drawText(safe(footer), {
      x: M.MARGIN_X,
      y: M.MARGIN_BOTTOM - 24,
      size: M.F_FOOTER,
      font: ctx.regular,
      color: MUTED,
    });
    const pageLabel = `${i + 1} / ${total}`;
    const w = ctx.regular.widthOfTextAtSize(pageLabel, M.F_FOOTER);
    p.drawText(pageLabel, {
      x: PAGE_W - M.MARGIN_X - w,
      y: M.MARGIN_BOTTOM - 24,
      size: M.F_FOOTER,
      font: ctx.regular,
      color: MUTED,
    });
  }
}

// Карточка-карман с тонкой границей и заголовком
export function drawCard(
  ctx: DocCtx,
  label: string,
  title: string,
  lines: (string | null | undefined)[],
  opts: { x?: number; width?: number } = {},
) {
  const x = opts.x ?? M.MARGIN_X;
  const width = opts.width ?? PAGE_W - M.MARGIN_X * 2;
  const innerW = width - 24;
  const cleanLines = lines.filter((l): l is string => !!l && l.trim() !== "");

  // считаем нужную высоту
  const titleLines = wrapText(displayFont(ctx, title), title, M.F13, innerW);
  const bodyLineHeights = cleanLines.flatMap((l) => wrapText(ctx.regular, l, M.F11, innerW));
  const height = 14 + 14 + titleLines.length * (M.F13 * M.LH) + bodyLineHeights.length * (M.F11 * M.LH_TEXT) + 12;

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
    size: M.F_LABEL,
    font: ctx.bold,
    color: ACCENT,
    tracking: M.F_LABEL * 0.12,
  });
  cy -= 18;
  for (const t of titleLines) {
    ctx.page.drawText(t, { x: x + 12, y: cy - M.F13, size: M.F13, font: displayFont(ctx, t), color: TEXT });
    cy -= M.F13 * M.LH;
  }

  cy -= 2;
  for (const l of bodyLineHeights) {
    ctx.page.drawText(l, { x: x + 12, y: cy - M.F11, size: M.F11, font: ctx.regular, color: MUTED });
    cy -= M.F11 * M.LH_TEXT;
  }
  ctx.y -= height + 6;
}

/**
 * Карточка с таблицей «ключ — значение» (как `.info-table` в HTML-превью):
 * подписи слева серым, значения справа. Используется для блока «Мероприятие»,
 * чтобы PDF совпадал с превью по подписям и сетке.
 */
export function drawInfoCard(
  ctx: DocCtx,
  label: string,
  rows: Array<[string, string]>,
  note?: string | null,
  opts: { x?: number; width?: number } = {},
) {
  const x = opts.x ?? M.MARGIN_X;
  const width = opts.width ?? PAGE_W - M.MARGIN_X * 2;
  const innerW = width - 24;
  const keyW = Math.min(150, innerW * 0.38);
  const valW = innerW - keyW - 8;
  const clean = rows.filter(([, v]) => !!v && String(v).trim() !== "");
  const list: Array<[string, string]> = clean.length ? clean : [["Детали", "уточняются"]];

  const wrapped = list.map(([k, v]) => ({
    k,
    lines: wrapText(ctx.regular, v, M.F11, valW),
  }));
  const noteLines = note ? wrapText(ctx.regular, note, M.F11, innerW) : [];
  const rowsH = wrapped.reduce((s, r) => s + Math.max(1, r.lines.length) * M.F11 * M.LH_LOOSE, 0);
  const height =
    14 * M.D + 16 * M.D + rowsH + (noteLines.length ? 6 * M.D + noteLines.length * M.F11 * M.LH_TEXT : 0) + 12 * M.D;

  ensureSpace(ctx, height + 6 * M.D);
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

  let cy = ctx.y - 14 * M.D;
  drawTracked(ctx.page, label.toUpperCase(), {
    x: x + 12,
    y: cy - 9,
    size: M.F_LABEL,
    font: ctx.bold,
    color: ACCENT,
    tracking: M.F_LABEL * 0.12,
  });
  cy -= 16 * M.D;

  for (const r of wrapped) {
    ctx.page.drawText(r.k, { x: x + 12, y: cy - M.F11, size: M.F11, font: ctx.regular, color: MUTED });
    let vy = cy;
    for (const line of r.lines) {
      ctx.page.drawText(line, {
        x: x + 12 + keyW + 8,
        y: vy - M.F11,
        size: M.F11,
        font: ctx.bold,
        color: TEXT,
      });
      vy -= M.F11 * M.LH_LOOSE;
    }
    cy -= Math.max(1, r.lines.length) * M.F11 * M.LH_LOOSE;
  }

  if (noteLines.length) {
    cy -= 6 * M.D;
    for (const line of noteLines) {
      ctx.page.drawText(line, { x: x + 12, y: cy - M.F11, size: M.F11, font: ctx.regular, color: MUTED });
      cy -= M.F11 * M.LH_TEXT;
    }
  }

  ctx.y -= height + 6 * M.D;
}

export function drawSignatures(
  ctx: DocCtx,
  left: { title: string; lines: string[]; signName: string },
  right: { title: string; lines: string[]; signName: string },
  /** Подпись и печать исполнителя — те же размеры, что и в HTML-превью. */
  media?: { signature?: PDFImage | null; stamp?: PDFImage | null },
) {
  const colW = (PAGE_W - M.MARGIN_X * 2 - 24) / 2;
  const MM = 72 / 25.4;
  const hasMedia = Boolean(media?.signature || media?.stamp);
  // Место под подпись и печать резервируем заранее — иначе картинка налезает на текст.
  const mediaH = hasMedia
    ? Math.max(
        media?.signature ? SIGN_MEDIA_MM.signatureH * MM : 0,
        media?.stamp ? SIGN_MEDIA_MM.stampH * MM * (1 - SIGN_MEDIA_MM.stampOverlap) : 0,
      )
    : 0;
  // Подпись нельзя рвать между страницами: считаем реальную высоту заранее.
  const measureCol = (b: { lines: string[] }) =>
    16 +
    b.lines.filter(Boolean).reduce((s, l) => s + wrapText(ctx.regular, l, M.F11, colW).length * M.F11 * M.LH_TEXT, 0) +
    28 +
    M.F11 * 2 +
    10;
  ensureSpace(ctx, 14 + mediaH + Math.max(measureCol(left), measureCol(right)));
  ctx.y -= 14;
  const yStart = ctx.y;
  // Линия подписи в обеих колонках на одном уровне — независимо от числа строк.
  const linesH = (b: typeof left) =>
    b.lines.filter(Boolean).reduce((s, l) => s + wrapText(ctx.regular, l, M.F11, colW).length * M.F11 * M.LH_TEXT, 0);
  const blockH = Math.max(linesH(left), linesH(right));
  const drawCol = (x: number, b: typeof left, withMedia: boolean) => {
    let cy = yStart;
    drawTracked(ctx.page, b.title.toUpperCase(), {
      x,
      y: cy - 9,
      size: M.F_LABEL,
      font: ctx.bold,
      color: ACCENT,
      tracking: M.F_LABEL * 0.12,
    });
    cy -= 16;
    for (const l of b.lines.filter(Boolean)) {
      const wrapped = wrapText(ctx.regular, l, M.F11, colW);
      for (const line of wrapped) {
        ctx.page.drawText(line, { x, y: cy - M.F11, size: M.F11, font: ctx.regular, color: TEXT });
        cy -= M.F11 * M.LH_TEXT;
      }
    }
    cy = yStart - 16 - blockH - 28 - (withMedia ? mediaH : 0);

    if (withMedia) drawSignMedia(ctx, x, cy, colW, media);

    ctx.page.drawLine({
      start: { x, y: cy },
      end: { x: x + colW, y: cy },
      thickness: 0.6,
      color: LINE,
    });
    ctx.page.drawText(b.signName, {
      x,
      y: cy - M.F11 - 2,
      size: M.F11,
      font: ctx.regular,
      color: MUTED,
    });
    return yStart - (cy - M.F11 - 6); // фактически занятая высота
  };
  const usedL = drawCol(M.MARGIN_X, left, hasMedia);
  const usedR = drawCol(M.MARGIN_X + colW + 24, right, false);
  ctx.y -= Math.max(usedL, usedR);
}

/**
 * Рисует подпись и печать относительно линии подписи (y = lineY).
 * Общая геометрия для КП, счетов и корпоративных документов.
 */
export function drawSignMedia(
  ctx: DocCtx,
  x: number,
  lineY: number,
  colW: number,
  media?: { signature?: PDFImage | null; stamp?: PDFImage | null },
) {
  const MM = 72 / 25.4;
  const maxW = Math.max(20, colW);
  const sig = media?.signature ?? null;
  const stamp = media?.stamp ?? null;
  if (sig) {
    const h = SIGN_MEDIA_MM.signatureH * MM;
    const k = Math.min(h / sig.height, maxW / sig.width);
    ctx.page.drawImage(sig, {
      x: x + 6,
      y: lineY + SIGN_MEDIA_MM.signatureLift,
      width: sig.width * k,
      height: sig.height * k,
      opacity: 0.95,
    });
  }
  if (stamp) {
    const h = SIGN_MEDIA_MM.stampH * MM;
    const k = Math.min(h / stamp.height, maxW / stamp.width);
    ctx.page.drawImage(stamp, {
      x: x + SIGN_MEDIA_MM.stampOffsetX * MM,
      y: lineY - stamp.height * k * SIGN_MEDIA_MM.stampOverlap,
      width: stamp.width * k,
      height: stamp.height * k,
      opacity: 0.85,
    });
  }
}

