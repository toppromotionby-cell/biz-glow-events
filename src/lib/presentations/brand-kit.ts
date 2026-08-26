// Бренд-наборы презентации: цвета, шрифт, логотип и стиль рамок.
//
// Набор применяется на уровне презентации и потому автоматически действует на
// все слайды и все 5 вариантов оформления каждого шаблона: варианты меняют
// геометрию (куда встают фото и текст), а цвета и шрифт приходят из набора.
import { normalizeDocFontChoice, type DocFontChoice } from "@/lib/documents/doc-font";
import {
  GRID, SLIDE_H, SLIDE_W, paletteFromStops, type Palette,
} from "@/lib/presentations/design";
import type { SpecRect } from "@/lib/presentations/slide-spec";

/** Стиль декоративной рамки вокруг содержимого слайда. */
export type BrandFrame = "none" | "line" | "soft" | "card";

export const BRAND_FRAME_LABELS: Record<BrandFrame, string> = {
  none: "Без рамки",
  line: "Тонкая линия",
  soft: "Мягкая рамка",
  card: "Карточка",
};

export type BrandKit = {
  id: string;
  name: string;
  /** Цвета фона: 1 — сплошной, 2–3 — градиент. */
  stops: string[];
  angle: number;
  accent: string;
  font: DocFontChoice;
  logoUrl: string | null;
  frame: BrandFrame;
};

export const BRAND_KIT_PRESETS: BrandKit[] = [
  {
    id: "preset-signature", name: "Фирменный", stops: ["#7a2f00", "#111827"], angle: 135,
    accent: "#f97316", font: "inherit", logoUrl: null, frame: "line",
  },
  {
    id: "preset-paper", name: "Светлая бумага", stops: ["#ffffff", "#fdf3ec"], angle: 120,
    accent: "#c2410c", font: "inherit", logoUrl: null, frame: "soft",
  },
  {
    id: "preset-graphite", name: "Графит", stops: ["#111318", "#1c2028"], angle: 135,
    accent: "#38bdf8", font: "inherit", logoUrl: null, frame: "none",
  },
  {
    id: "preset-night", name: "Ночная волна", stops: ["#141a3a", "#2b1e63", "#0d1230"], angle: 135,
    accent: "#a78bfa", font: "inherit", logoUrl: null, frame: "card",
  },
  {
    id: "preset-emerald", name: "Изумруд", stops: ["#046e5a", "#03453f"], angle: 130,
    accent: "#facc15", font: "inherit", logoUrl: null, frame: "line",
  },
];

/** Локальный нормализатор цвета: модуль не зависит от model.ts (циклы). */
function normalizeHexColor(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

const FRAMES: BrandFrame[] = ["none", "line", "soft", "card"];

export function normalizeBrandFrame(v: unknown): BrandFrame {
  return FRAMES.includes(v as BrandFrame) ? (v as BrandFrame) : "none";
}

/** Приводит любое значение к бренд-набору; невалидное — null (набор не задан). */
export function normalizeBrandKit(raw: unknown): BrandKit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.stops) ? r.stops : [];
  const stops = list
    .slice(0, 3)
    .map((c) => normalizeHexColor(c, "#ffffff"))
    .filter(Boolean);
  if (!stops.length) return null;
  const angleRaw = Number(r.angle);
  return {
    id: typeof r.id === "string" && r.id ? r.id : "custom",
    name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 80) : "Бренд-набор",
    stops,
    angle: Number.isFinite(angleRaw) ? Math.min(360, Math.max(0, Math.round(angleRaw))) : 135,
    accent: normalizeHexColor(r.accent, "#c2410c"),
    font: normalizeDocFontChoice(r.font),
    logoUrl: typeof r.logoUrl === "string" && r.logoUrl ? r.logoUrl.slice(0, 1000) : null,
    frame: normalizeBrandFrame(r.frame),
  };
}

/** Палитра набора — заменяет палитру шаблона на всех слайдах. */
export function brandKitPalette(kit: BrandKit): Palette {
  return paletteFromStops(kit.stops, kit.angle, kit.accent);
}

/** CSS-фон набора для превью и карточек каталога. */
export function brandKitBackground(kit: Pick<BrandKit, "stops" | "angle">): string {
  const stops = kit.stops.filter(Boolean);
  if (stops.length < 2) return stops[0] ?? "#ffffff";
  return `linear-gradient(${kit.angle}deg, ${stops.join(", ")})`;
}

/**
 * Декоративная рамка как обычный блок спека: её одинаково рисуют превью и PDF,
 * потому что оба берут блоки из одного сборщика.
 */
export function brandFrameBlock(frame: BrandFrame): SpecRect | null {
  if (frame === "none") return null;
  const inset = frame === "card" ? 20 : Math.round(GRID.marginX / 2);
  const base = {
    kind: "rect" as const,
    x: inset,
    y: inset,
    w: SLIDE_W - inset * 2,
    h: SLIDE_H - inset * 2,
  };
  if (frame === "card") return { ...base, radius: 28, color: "panel", opacity: 1 };
  return {
    ...base,
    radius: frame === "soft" ? 24 : 6,
    color: "accent",
    opacity: frame === "soft" ? 0.5 : 0.8,
    stroke: frame === "soft" ? 3 : 1.5,
  };
}

/**
 * Фон и акцент с учётом набора: собственный фон слайда всегда важнее,
 * бренд-набор подменяет только оформление «как в шаблоне».
 */
export function applyBrandKit<T extends { mode: string; stops: string[]; angle: number }>(
  background: T,
  kit: BrandKit | null,
  accent: string,
): { background: T; accent: string } {
  if (!kit) return { background, accent };
  if (background.mode !== "template" && background.stops.length) {
    return { background, accent: kit.accent };
  }
  return {
    background: { ...background, mode: "gradient", stops: kit.stops, angle: kit.angle },
    accent: kit.accent,
  };
}
