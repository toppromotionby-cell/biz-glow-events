// Рендер обложек DJ-раздела строго по роли из cover-role.ts.
// Только браузер (canvas). Никаких «своих» цветов и шрифтов здесь нет —
// всё берётся из спецификации.
import { BRAND, stripBrand } from "./branding";
import {
  COVER_LAYOUT,
  buildCoverSpec,
  type CoverFormat,
  type CoverSpec,
  type CoverSubject,
} from "./cover-role";

export { COVER_SPEC_VERSION, coverCssGradient } from "./cover-role";

// ── низкоуровневые помощники ────────────────────────────────────────────────

function mulberry(seed: number): () => number {
  let a = seed * 1103515245 + 12345;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Не удалось создать изображение"))),
      "image/jpeg",
      quality,
    );
  });
}

// ── слои ────────────────────────────────────────────────────────────────────

function layerGradient(ctx: CanvasRenderingContext2D, s: CoverSpec) {
  const g = ctx.createLinearGradient(0, 0, s.width, s.height);
  g.addColorStop(0, s.colors.from);
  g.addColorStop(0.52, s.colors.mid);
  g.addColorStop(1, s.colors.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s.width, s.height);

  // Мягкая световая точка — объём без «фотошопности».
  const rnd = mulberry(s.seed + 7);
  const cx = s.width * (0.2 + rnd() * 0.6);
  const cy = s.height * (0.12 + rnd() * 0.35);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(s.width, s.height) * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s.width, s.height);
}

function layerPattern(ctx: CanvasRenderingContext2D, s: CoverSpec) {
  const rnd = mulberry(s.seed);
  const min = Math.min(s.width, s.height);
  ctx.save();
  ctx.globalAlpha = COVER_LAYOUT.opacity.pattern;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";

  switch (s.pattern) {
    case "waves": {
      ctx.lineWidth = min * 0.008;
      for (let i = 0; i < 14; i += 1) {
        const y = s.height * (0.18 + i * 0.055);
        const amp = min * (0.02 + rnd() * 0.05);
        ctx.beginPath();
        for (let x = -20; x <= s.width + 20; x += 12) {
          const yy = y + Math.sin((x / s.width) * Math.PI * (2 + i * 0.35) + i) * amp;
          if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case "bars": {
      const count = 34;
      const bw = s.width / (count * 1.6);
      for (let i = 0; i < count; i += 1) {
        const h = min * (0.08 + rnd() * 0.55);
        ctx.fillRect(i * (bw * 1.6) + bw * 0.3, s.height - h - min * 0.06, bw, h);
      }
      break;
    }
    case "rings": {
      ctx.lineWidth = min * 0.01;
      const cx = s.width * 0.78;
      const cy = s.height * 0.3;
      for (let i = 1; i <= 12; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, min * 0.05 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "grid": {
      ctx.globalAlpha = COVER_LAYOUT.opacity.pattern * 0.9;
      const step = min * 0.045;
      for (let x = step; x < s.width; x += step) {
        for (let y = step; y < s.height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, min * 0.0045, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "beams": {
      ctx.lineWidth = min * 0.035;
      for (let i = -6; i < 22; i += 1) {
        const x = i * min * 0.11;
        ctx.beginPath();
        ctx.moveTo(x, -min * 0.1);
        ctx.lineTo(x + s.height * 0.6, s.height + min * 0.1);
        ctx.stroke();
      }
      break;
    }
    case "orbit": {
      ctx.lineWidth = min * 0.007;
      for (let i = 0; i < 7; i += 1) {
        ctx.save();
        ctx.translate(s.width * 0.5, s.height * 0.46);
        ctx.rotate((i / 7) * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, min * (0.2 + i * 0.055), min * (0.42 - i * 0.02), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "pulse": {
      ctx.lineWidth = min * 0.009;
      const baseY = s.height * 0.52;
      ctx.beginPath();
      let x = 0;
      while (x < s.width) {
        const spike = rnd() > 0.72;
        const step = min * (spike ? 0.02 : 0.05);
        const y = spike ? baseY - min * (0.08 + rnd() * 0.18) : baseY;
        ctx.lineTo(x, y);
        x += step;
        ctx.lineTo(x, baseY);
      }
      ctx.stroke();
      break;
    }
    case "stack": {
      for (let i = 0; i < 9; i += 1) {
        const w = min * (0.55 - i * 0.04);
        const h = min * 0.035;
        roundRect(ctx, s.width * 0.52 - w / 2 + i * min * 0.012, s.height * 0.2 + i * min * 0.07, w, h, h / 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function layerGrain(ctx: CanvasRenderingContext2D, s: CoverSpec) {
  const rnd = mulberry(s.seed + 31);
  ctx.save();
  ctx.globalAlpha = COVER_LAYOUT.opacity.grain;
  ctx.fillStyle = "#000000";
  const dots = Math.round((s.width * s.height) / 900);
  for (let i = 0; i < dots; i += 1) {
    ctx.fillRect(rnd() * s.width, rnd() * s.height, 1.5, 1.5);
  }
  ctx.restore();
}

function layerScrim(ctx: CanvasRenderingContext2D, s: CoverSpec) {
  const g = ctx.createLinearGradient(0, s.height * 0.28, 0, s.height);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, `rgba(0,0,0,${COVER_LAYOUT.opacity.scrim * 0.55})`);
  g.addColorStop(1, `rgba(0,0,0,${COVER_LAYOUT.opacity.scrim})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s.width, s.height);

  const top = ctx.createLinearGradient(0, 0, 0, s.height * 0.32);
  top.addColorStop(0, "rgba(0,0,0,0.3)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, s.width, s.height * 0.32);
}

/** Подбор кегля названия так, чтобы уложиться в лимит строк. */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, min: number) {
  const maxPx = min * COVER_LAYOUT.fontRatio.titleMax;
  const minPx = min * COVER_LAYOUT.fontRatio.titleMin;
  const words = text.split(/\s+/).filter(Boolean);

  for (let size = maxPx; size >= minPx; size -= maxPx * 0.04) {
    ctx.font = `800 ${size}px ${COVER_LAYOUT.fontStack.display}`;
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= COVER_LAYOUT.titleMaxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { size, lines };
    }
  }

  ctx.font = `800 ${minPx}px ${COVER_LAYOUT.fontStack.display}`;
  const clipped: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      clipped.push(line);
      line = w;
      if (clipped.length === COVER_LAYOUT.titleMaxLines) break;
    } else line = next;
  }
  if (clipped.length < COVER_LAYOUT.titleMaxLines && line) clipped.push(line);
  const last = clipped.length - 1;
  if (last >= 0 && words.join(" ") !== clipped.join(" ")) clipped[last] = `${clipped[last]!.replace(/[\s,.;:-]+$/, "")}…`;
  return { size: minPx, lines: clipped };
}

function layerText(ctx: CanvasRenderingContext2D, s: CoverSpec) {
  const min = Math.min(s.width, s.height);
  const margin = min * COVER_LAYOUT.marginRatio;
  const maxWidth = s.width - margin * 2;
  const brandRow = min * COVER_LAYOUT.fontRatio.brand * 2.4;

  const { size, lines } = fitTitle(ctx, stripBrand(s.title), maxWidth, min);
  const lineH = size * 1.1;
  const metaH = s.meta ? min * COVER_LAYOUT.fontRatio.meta * 2.2 : 0;
  const baseBottom = s.height - margin - brandRow - metaH;
  const titleTop = baseBottom - lines.length * lineH;

  // Надглавие (артист) + акцентная линия.
  const eyebrowPx = min * COVER_LAYOUT.fontRatio.eyebrow;
  ctx.font = `700 ${eyebrowPx}px ${COVER_LAYOUT.fontStack.display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = s.accent;
  ctx.fillRect(margin, titleTop - eyebrowPx * 2.1, min * 0.09, Math.max(3, min * 0.006));
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const eyebrow = stripBrand(s.eyebrow).toUpperCase();
  ctx.save();
  ctx.letterSpacing = `${eyebrowPx * 0.1}px`;
  ctx.fillText(truncateToWidth(ctx, eyebrow, maxWidth), margin, titleTop - eyebrowPx * 0.75);
  ctx.restore();

  // Название.
  ctx.font = `800 ${size}px ${COVER_LAYOUT.fontStack.display}`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = size * 0.25;
  lines.forEach((l, i) => ctx.fillText(l, margin, titleTop + lineH * (i + 0.82)));
  ctx.shadowBlur = 0;

  // Мета: версия · BPM · тональность.
  if (s.meta) {
    const metaPx = min * COVER_LAYOUT.fontRatio.meta;
    ctx.font = `500 ${metaPx}px ${COVER_LAYOUT.fontStack.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(truncateToWidth(ctx, s.meta, maxWidth), margin, baseBottom + metaPx * 1.3);
  }
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/**
 * Водяной знак event-hub.by — обязательный последний слой любой картинки.
 * Чистый словесный логотип: точка фирменного цвета + подпись на тёмной плашке.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string) {
  const min = Math.min(width, height);
  const margin = min * COVER_LAYOUT.marginRatio;
  const fontSize = min * COVER_LAYOUT.fontRatio.brand;
  ctx.font = `800 ${fontSize}px ${COVER_LAYOUT.fontStack.display}`;
  const textW = ctx.measureText(BRAND).width;
  const dot = fontSize * 0.6;
  const boxH = fontSize * 1.85;
  const boxW = textW + dot + fontSize * 1.5;
  const x = margin;
  const y = height - margin - boxH;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = fontSize * 0.6;
  ctx.fillStyle = "rgba(8,8,10,0.58)";
  roundRect(ctx, x, y, boxW, boxH, boxH * COVER_LAYOUT.chipRadiusRatio);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + boxH / 2, y + boxH / 2, dot / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px ${COVER_LAYOUT.fontStack.display}`;
  ctx.fillText(BRAND, x + boxH / 2 + dot / 2 + fontSize * 0.32, y + boxH / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

// ── публичный API ───────────────────────────────────────────────────────────

/** Отрисовка спецификации. Слои строго в порядке COVER_LAYERS. */
export function renderCover(spec: CoverSpec): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  layerGradient(ctx, spec);
  layerPattern(ctx, spec);
  layerGrain(ctx, spec);
  layerScrim(ctx, spec);
  layerText(ctx, spec);
  drawWatermark(ctx, spec.width, spec.height, spec.accent);

  return canvas;
}

export type BuiltCover = {
  blob: Blob;
  paletteId: string;
  specVersion: number;
};

/** Обложка трека. Встроенные ID3-картинки не используются — стиль всегда наш. */
export async function buildTrackCover(subject: CoverSubject): Promise<BuiltCover> {
  const spec = buildCoverSpec(subject);
  const blob = await canvasToBlob(renderCover(spec));
  return { blob, paletteId: spec.palette.id, specVersion: spec.version };
}

/** Обложка для дистрибутива софта / широкой плитки. */
export async function buildWideCover(subject: CoverSubject, format: CoverFormat = "wide"): Promise<BuiltCover> {
  const spec = buildCoverSpec({ ...subject, format });
  const blob = await canvasToBlob(renderCover(spec));
  return { blob, paletteId: spec.palette.id, specVersion: spec.version };
}

/** Строка меты для обложки: Extended · 128 BPM · 8A. */
export function coverMetaLine(input: {
  versionLabel?: string | null;
  bpm?: number | null;
  key?: string | null;
}): string | null {
  const parts = [
    input.versionLabel && input.versionLabel.toLowerCase() !== "original" ? input.versionLabel : null,
    input.bpm ? `${input.bpm} BPM` : null,
    input.key || null,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join("  ·  ") : null;
}
