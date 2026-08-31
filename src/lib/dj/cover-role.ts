// ─────────────────────────────────────────────────────────────────────────────
// РОЛЬ АРТ-ДИРЕКТОРА ОБЛОЖЕК event-hub.by
//
// Единственный источник правды по оформлению любой картинки DJ-раздела.
// Никакой вызывающий код не придумывает цвета, шрифты, отступы и слои — он
// только передаёт данные о треке и получает готовую спецификацию.
//
// БРИФ РОЛИ
//  • Стиль: современный DJ-пул. Плотный дуо-градиент, крупная геометрия,
//    зерно плёнки, глубокое затемнение снизу, строгая типографика.
//  • Единство: палитра выбирается по разделу библиотеки, а не по настроению.
//    Внутри раздела — детерминированный сдвиг тона по хэшу «артист+название»,
//    чтобы соседние обложки не сливались, но оставались одной семьёй.
//  • Читаемость важнее эффектности: текст всегда на затемнении, контраст
//    проверяется, длинные названия ужимаются, а не обрезаются.
//  • Водяной знак event-hub.by — обязательный последний слой. Всегда.
//  • Ничего случайного: одинаковый трек всегда даёт одинаковую картинку.
//
// При изменении правил поднимайте COVER_SPEC_VERSION — админка предложит
// перегенерировать устаревшие обложки.
// ─────────────────────────────────────────────────────────────────────────────

import type { DjSectionKey } from "./sections";

export const COVER_SPEC_VERSION = 1;

/** Форматы, которые умеет рисовать роль. */
export type CoverFormat = "square" | "wide" | "og";

export const COVER_SIZES: Record<CoverFormat, { w: number; h: number }> = {
  square: { w: 1000, h: 1000 },
  wide: { w: 1200, h: 675 },
  og: { w: 1200, h: 630 },
};

/** Паттерн фонового слоя. Каждому разделу — свой характер. */
export type CoverPattern = "waves" | "rings" | "bars" | "grid" | "beams" | "orbit" | "pulse" | "stack";

export type CoverPalette = {
  id: string;
  /** Базовый тон в градусах (HSL). */
  hue: number;
  /** Насколько «уводим» второй стоп градиента. */
  hueShift: number;
  saturation: number;
  /** Светлота от светлого стопа к тёмному. */
  light: [number, number, number];
  pattern: CoverPattern;
  label: string;
};

/** Закрытый набор фирменных палитр — по одной на раздел библиотеки. */
export const COVER_PALETTES: Record<DjSectionKey, CoverPalette> = {
  music:    { id: "ember",   label: "Ember",    hue: 24,  hueShift: -18, saturation: 88, light: [58, 42, 12], pattern: "waves" },
  jingles:  { id: "electric",label: "Electric", hue: 268, hueShift: 42,  saturation: 82, light: [60, 44, 13], pattern: "bars"  },
  host:     { id: "emerald", label: "Emerald",  hue: 158, hueShift: 30,  saturation: 68, light: [52, 38, 11], pattern: "rings" },
  samples:  { id: "cyan",    label: "Cyan",     hue: 192, hueShift: 34,  saturation: 78, light: [56, 40, 12], pattern: "grid"  },
  inout:    { id: "magenta", label: "Magenta",  hue: 330, hueShift: -30, saturation: 80, light: [58, 40, 12], pattern: "beams" },
  welcome:  { id: "amber",   label: "Amber",    hue: 42,  hueShift: 22,  saturation: 84, light: [62, 46, 14], pattern: "orbit" },
  show:     { id: "violet",  label: "Violet",   hue: 292, hueShift: -34, saturation: 76, light: [56, 40, 12], pattern: "pulse" },
  software: { id: "steel",   label: "Steel",    hue: 214, hueShift: 18,  saturation: 42, light: [50, 34, 10], pattern: "stack" },
};

/** Геометрия и типографика — общие для всех форматов правила. */
export const COVER_LAYOUT = {
  /** Поле от края в долях от меньшей стороны. */
  marginRatio: 0.07,
  /** Радиус скругления плашек. */
  chipRadiusRatio: 0.5,
  /** Максимум строк в названии. */
  titleMaxLines: 3,
  /** Кегли в долях от меньшей стороны. */
  fontRatio: {
    eyebrow: 0.038,
    titleMax: 0.108,
    titleMin: 0.052,
    meta: 0.032,
    brand: 0.042,
  },
  /** Прозрачность слоёв. */
  opacity: {
    pattern: 0.2,
    grain: 0.05,
    scrim: 0.62,
  },
  fontStack: {
    display: '"Montserrat", "Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", ui-monospace, monospace',
  },
} as const;

/** Порядок слоёв — менять только вместе с версией схемы. */
export const COVER_LAYERS = [
  "gradient",
  "pattern",
  "grain",
  "scrim",
  "eyebrow",
  "title",
  "meta",
  "watermark",
] as const;
export type CoverLayer = (typeof COVER_LAYERS)[number];

/** Входные данные для обложки трека. */
export type CoverSubject = {
  artist: string;
  title: string;
  section?: string | null;
  /** Подпись мелким моноширинным: версия · BPM · тональность. */
  meta?: string | null;
  format?: CoverFormat;
};

export type CoverSpec = {
  version: number;
  format: CoverFormat;
  width: number;
  height: number;
  palette: CoverPalette;
  /** Итоговые цвета градиента после детерминированного сдвига. */
  colors: { from: string; mid: string; to: string };
  /** Цвет акцента для маркеров и подчёркиваний. */
  accent: string;
  pattern: CoverPattern;
  /** Целое 0..999 — сид для стабильного «рисунка» паттерна. */
  seed: number;
  eyebrow: string;
  title: string;
  meta: string | null;
};

/** Стабильный хэш строки. */
export function coverSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1000;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}

export function paletteForSection(section?: string | null): CoverPalette {
  const key = (section ?? "music") as DjSectionKey;
  return COVER_PALETTES[key] ?? COVER_PALETTES.music;
}

/** Главная функция роли: данные трека → полная спецификация картинки. */
export function buildCoverSpec(subject: CoverSubject): CoverSpec {
  const format = subject.format ?? "square";
  const size = COVER_SIZES[format];
  const palette = paletteForSection(subject.section);
  const seed = coverSeed(`${subject.artist}|${subject.title}|${palette.id}`);

  // Сдвиг ±14° внутри семейства раздела: обложки различимы, но родственны.
  const drift = ((seed % 29) - 14) * 1;
  const h0 = palette.hue + drift;
  const h1 = palette.hue + palette.hueShift + drift;

  return {
    version: COVER_SPEC_VERSION,
    format,
    width: size.w,
    height: size.h,
    palette,
    colors: {
      from: hsl(h0, palette.saturation, palette.light[0]),
      mid: hsl((h0 + h1) / 2, palette.saturation - 8, palette.light[1]),
      to: hsl(h1, Math.max(24, palette.saturation - 26), palette.light[2]),
    },
    accent: hsl(h1, Math.min(96, palette.saturation + 10), Math.min(78, palette.light[0] + 22)),
    pattern: palette.pattern,
    seed,
    eyebrow: subject.artist.trim() || "event-hub.by",
    title: subject.title.trim() || "Untitled",
    meta: subject.meta?.trim() || null,
  };
}

/** CSS-градиент по той же роли — для плейсхолдеров в интерфейсе. */
export function coverCssGradient(subject: CoverSubject): string {
  const s = buildCoverSpec(subject);
  return `linear-gradient(135deg, ${s.colors.from} 0%, ${s.colors.mid} 52%, ${s.colors.to} 100%)`;
}
