// Обложки DJ-раздела: генерация фирменной картинки + водяной знак event-hub.by.
// Только браузер (canvas). Единая точка: любая картинка проходит applyLogoWatermark.
import { BRAND, stripBrand } from "./branding";

export const COVER_SIZE = 1000;

/** Детерминированный «оттенок» по строке — одинаковый трек = одинаковый градиент. */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, weight = 700): string[] {
  let size = startPx;
  const words = text.split(/\s+/);
  for (; size > 18; size -= 2) {
    ctx.font = `${weight} ${size}px "Inter", system-ui, sans-serif`;
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 3) { (ctx as unknown as { __size: number }).__size = size; return lines; }
  }
  ctx.font = `${weight} ${size}px "Inter", system-ui, sans-serif`;
  return [text.slice(0, 40)];
}

/**
 * Водяной знак event-hub.by. Чистый словесный логотип (без декоративных звёздочек),
 * рисуется поверх любой картинки: плашка с градиентной точкой и подписью.
 */
export function drawLogoWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  corner: "br" | "bl" = "br",
) {
  const pad = Math.round(Math.min(width, height) * 0.045);
  const fontSize = Math.max(14, Math.round(width * 0.052));
  ctx.font = `800 ${fontSize}px "Inter", system-ui, sans-serif`;
  const text = BRAND;
  const textW = ctx.measureText(text).width;
  const dot = Math.round(fontSize * 0.62);
  const boxH = Math.round(fontSize * 1.9);
  const boxW = Math.round(textW + dot + fontSize * 1.6);
  const x = corner === "br" ? width - boxW - pad : pad;
  const y = height - boxH - pad;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.round(fontSize * 0.7);
  ctx.shadowOffsetY = Math.round(fontSize * 0.12);
  ctx.fillStyle = "rgba(10,10,12,0.55)";
  roundRect(ctx, x, y, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.restore();

  // Фирменная оранжевая точка-маркер вместо иконки.
  const grad = ctx.createLinearGradient(x, y, x + boxW, y + boxH);
  grad.addColorStop(0, "#ffb347");
  grad.addColorStop(1, "#ff6a00");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x + boxH / 2, y + boxH / 2, dot / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px "Inter", system-ui, sans-serif`;
  ctx.fillText(text, x + boxH / 2 + dot / 2 + fontSize * 0.35, y + boxH / 2 + 1);
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось создать изображение"))), "image/jpeg", quality);
  });
}

/** Накладывает логотип на существующую картинку и приводит к квадрату COVER_SIZE. */
export async function applyLogoWatermark(source: Blob, corner: "br" | "bl" = "br"): Promise<Blob> {
  const img = await blobToImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = COVER_SIZE;
  canvas.height = COVER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  // cover-вписывание
  const scale = Math.max(COVER_SIZE / img.width, COVER_SIZE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (COVER_SIZE - w) / 2, (COVER_SIZE - h) / 2, w, h);

  const shade = ctx.createLinearGradient(0, COVER_SIZE * 0.6, 0, COVER_SIZE);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);

  drawLogoWatermark(ctx, COVER_SIZE, COVER_SIZE, corner);
  return canvasToBlob(canvas);
}

/** Генерация фирменной обложки, когда в файле её нет. */
export async function generateCover(input: {
  artist: string;
  title: string;
  subtitle?: string | null;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_SIZE;
  canvas.height = COVER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  const hue = hashHue(`${input.artist}${input.title}`);
  const g = ctx.createLinearGradient(0, 0, COVER_SIZE, COVER_SIZE);
  g.addColorStop(0, `hsl(${hue}, 85%, 58%)`);
  g.addColorStop(0.55, `hsl(${(hue + 35) % 360}, 80%, 42%)`);
  g.addColorStop(1, `hsl(${(hue + 320) % 360}, 70%, 18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);

  // Декоративные волны-эквалайзер.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 26; i += 1) {
    const bw = COVER_SIZE / 34;
    const bh = 80 + ((hashHue(`${input.title}${i}`) % 100) / 100) * 420;
    ctx.fillRect(30 + i * (bw + 8), COVER_SIZE - 120 - bh, bw, bh);
  }
  ctx.globalAlpha = 1;

  const shade = ctx.createLinearGradient(0, 0, 0, COVER_SIZE);
  shade.addColorStop(0, "rgba(0,0,0,0.15)");
  shade.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);

  const margin = 70;
  const maxW = COVER_SIZE - margin * 2;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 40px "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(stripBrand(input.artist).slice(0, 34).toUpperCase(), margin, 150);

  const lines = fitText(ctx, stripBrand(input.title), maxW, 96);
  const size = (ctx as unknown as { __size?: number }).__size ?? 96;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${size}px "Inter", system-ui, sans-serif`;
  lines.forEach((line, i) => ctx.fillText(line, margin, 260 + i * (size * 1.12)));

  if (input.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 36px "Inter", system-ui, sans-serif`;
    ctx.fillText(input.subtitle.slice(0, 42), margin, COVER_SIZE - 190);
  }

  drawLogoWatermark(ctx, COVER_SIZE, COVER_SIZE, "br");
  return canvasToBlob(canvas, 0.92);
}

/** Обложка для дистрибутива софта (широкая плашка, логотип слева внизу). */
export async function generateSoftwareCover(input: {
  name: string;
  version?: string | null;
  platform?: string | null;
}): Promise<Blob> {
  const W = 1200;
  const H = 675;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  const hue = hashHue(input.name);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue}, 80%, 52%)`);
  g.addColorStop(1, `hsl(${(hue + 300) % 360}, 65%, 16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(W - 120 - i * 60, 120 + i * 40, 180 - i * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const letter = stripBrand(input.name).trim().charAt(0).toUpperCase() || "S";
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundRect(ctx, 70, 150, 220, 220, 48);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 140px "Inter", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 180, 268);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.font = `800 62px "Inter", system-ui, sans-serif`;
  ctx.fillText(stripBrand(input.name).slice(0, 22), 330, 250);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `600 40px "Inter", system-ui, sans-serif`;
  ctx.fillText([input.version, input.platform].filter(Boolean).join(" · ").slice(0, 40), 330, 320);

  drawLogoWatermark(ctx, W, H, "bl");
  return canvasToBlob(canvas, 0.92);
}

/** Обложка из встроенной картинки ID3 либо сгенерированная — всегда с логотипом. */
export async function buildCover(input: {
  artist: string;
  title: string;
  subtitle?: string | null;
  embedded?: { data: Uint8Array; mime: string } | null;
}): Promise<Blob> {
  if (input.embedded?.data?.length) {
    try {
      const copy = new Uint8Array(input.embedded.data);
      return await applyLogoWatermark(new Blob([copy.buffer as ArrayBuffer], { type: input.embedded.mime }));
    } catch {
      // повреждённая картинка — уходим на генерацию
    }
  }
  return generateCover(input);
}
