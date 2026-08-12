// PDF-исполнитель примитивов холста (pdf-lib). Тот же список `DrawOp`, что
// рисует браузер, поэтому файл совпадает с превью по определению: разница
// только в системе координат (в PDF ось Y направлена вверх).
import { rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { hexToRgb01 } from "@/lib/documents/brand";
import type { PageFormat } from "@/lib/canvas/model";
import type { DrawOp } from "@/lib/canvas/ops";

export type OpFonts = { regular: PDFFont; bold: PDFFont; display: PDFFont };

/** Картинки уже встроены в документ и разложены по исходному src. */
export type OpImages = Map<string, PDFImage | null>;

const color = (hex: string) => {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
};

/** Простой перенос по ширине — на случай, когда строки не посчитаны заранее. */
function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

/**
 * Рисует список примитивов на странице PDF.
 * `format` — координатная сетка холста, размер страницы берётся из page.
 */
export function renderOps(
  page: PDFPage,
  ops: DrawOp[],
  format: PageFormat,
  fonts: OpFonts,
  images: OpImages = new Map(),
): void {
  const { width: W, height: H } = page.getSize();
  const K = W / format.w;

  for (const op of ops) {
    if (op.kind === "rect") {
      page.drawRectangle({
        x: op.x * K,
        y: H - (op.y + op.h) * K,
        width: op.w * K,
        height: op.h * K,
        color: color(op.fill),
        opacity: op.opacity,
      });
      continue;
    }

    if (op.kind === "image") {
      const img = images.get(op.src) ?? null;
      const fx = op.x * K;
      const fy = H - (op.y + op.h) * K;
      const fw = op.w * K;
      const fh = op.h * K;
      if (!img) continue;
      const k =
        op.fit === "contain"
          ? Math.min(fw / img.width, fh / img.height)
          : Math.max(fw / img.width, fh / img.height);
      const w = img.width * k;
      const h = img.height * k;
      page.drawImage(img, {
        x: fx + fw / 2 - w / 2,
        y: fy + fh / 2 - h / 2,
        width: w,
        height: h,
      });
      continue;
    }

    const font =
      op.font === "display" ? fonts.display : op.weight >= 600 ? fonts.bold : fonts.regular;
    const size = op.fontSize * K;
    const width = op.w * K;
    const cast = (s: string) => (op.uppercase ? s.toUpperCase() : s);
    const lines = (op.lines ?? wrap(font, op.text, size, width)).map(cast);
    const blockH = lines.length * size * op.lineHeight;
    const boxH = op.h * K;
    const shift =
      op.valign === "middle"
        ? Math.max(0, (boxH - blockH) / 2)
        : op.valign === "bottom"
          ? Math.max(0, boxH - blockH)
          : 0;

    let y = H - op.y * K - shift - size;
    for (const line of lines) {
      const lw = font.widthOfTextAtSize(line, size);
      const dx = op.align === "center" ? (width - lw) / 2 : op.align === "right" ? width - lw : 0;
      page.drawText(line, { x: op.x * K + dx, y, size, font, color: color(op.color) });
      y -= size * op.lineHeight;
    }
  }
}
