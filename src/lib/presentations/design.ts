// Единая дизайн-система слайдов презентации.
// Холст 1280×720 (16:9) = пропорции стандартных 1920×1080, делённые на 1.5.
// Здесь живут сетка, шкала кеглей, ступени плотности, темы и автораскладка
// фотографий (1–5). Модуль клиент-безопасный: используется в превью, PDF и PPTX.
import {
  clampNum, DEFAULT_LAYOUT_OVERRIDES, PHOTO_SCALE_MAX, PHOTO_SCALE_MIN,
  type PhotoZone, type PresentationSlide, type PresentationTemplate,
  type PriceZone, type SlideImageLayout,
} from "@/lib/presentations/model";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

/** Поля и сетка (12 колонок, кратно 8). */
export const GRID = {
  marginX: 64,
  marginTop: 56,
  marginBottom: 56,
  footerH: 56,
  gutter: 16,
  columns: 12,
  radius: 16,
  photoGap: 10,
} as const;

export const FONTS = {
  display: "'Space Grotesk', 'Space Grotesk Fallback', system-ui, sans-serif",
  body: "'Inter', 'Inter Fallback', system-ui, sans-serif",
} as const;

export type Rect = { x: number; y: number; w: number; h: number };

/** Ступени плотности: чем больше текста, тем плотнее вёрстка. */
export const DENSITY_STEPS = ["comfortable", "normal", "dense", "ultra"] as const;
export type Density = (typeof DENSITY_STEPS)[number];

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: "Свободная",
  normal: "Обычная",
  dense: "Плотная",
  ultra: "Сверхплотная",
};

const DENSITY_K: Record<Density, number> = {
  comfortable: 1,
  normal: 0.92,
  dense: 0.84,
  ultra: 0.76,
};

/** Базовая шкала кеглей на холсте 1280 (×1.5 = размеры для 1920). */
const BASE_TYPE = {
  titleHero: 62,
  titleSlide: 44,
  titleSection: 52,
  subtitle: 24,
  body: 22,
  bullet: 21,
  label: 15,
  caption: 15,
  chip: 17,
  stat: 30,
} as const;

export type TypeScale = Record<keyof typeof BASE_TYPE, number> & {
  lineGap: number;
  blockGap: number;
  density: Density;
};

/** Минимумы читаемости — ниже не опускаемся ни при какой плотности. */
const MIN_SIZE: Partial<Record<keyof typeof BASE_TYPE, number>> = {
  body: 18,
  bullet: 17,
  caption: 13,
  label: 13,
  chip: 14,
  subtitle: 18,
};

export function typeScale(density: Density): TypeScale {
  const k = DENSITY_K[density];
  const out = {} as TypeScale;
  for (const key of Object.keys(BASE_TYPE) as (keyof typeof BASE_TYPE)[]) {
    const min = MIN_SIZE[key];
    const value = Math.round(BASE_TYPE[key] * k);
    out[key] = min ? Math.max(min, value) : value;
  }
  out.lineGap = 1.42;
  out.blockGap = Math.round(24 * k);
  out.density = density;
  return out;
}

/* ------------------------------------------------------------------ */
/* Темы                                                                */
/* ------------------------------------------------------------------ */

export type SlideThemeTokens = {
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  onAccent: string;
};

export function slideTheme(template: PresentationTemplate, accent: string): SlideThemeTokens {
  if (template === "dark") {
    return {
      bg: "#0f1115",
      panel: "rgba(255,255,255,0.06)",
      ink: "#f8fafc",
      muted: "rgba(248,250,252,0.66)",
      accent,
      line: "rgba(255,255,255,0.14)",
      onAccent: "#0f1115",
    };
  }
  if (template === "accent") {
    return {
      bg: `linear-gradient(135deg, ${accent} 0%, #111827 100%)`,
      panel: "rgba(255,255,255,0.12)",
      ink: "#ffffff",
      muted: "rgba(255,255,255,0.78)",
      accent: "#ffffff",
      line: "rgba(255,255,255,0.24)",
      onAccent: accent,
    };
  }
  return {
    bg: "#ffffff",
    panel: "#f7f8fa",
    ink: "#111827",
    muted: "#6b7280",
    accent,
    line: "#e5e7eb",
    onAccent: "#ffffff",
  };
}

/* ------------------------------------------------------------------ */
/* Автораскладка фотографий                                            */
/* ------------------------------------------------------------------ */

export const MAX_SLIDE_PHOTOS = 5;

export type PhotoPlacement = "none" | "left" | "right" | "top" | "full";

export type SlideLayout = {
  /** Фото, попавшие на слайд (не более 5). */
  photos: string[];
  placement: PhotoPlacement;
  /** Область под фото в координатах холста. */
  photoBox: Rect | null;
  /** Рамки для каждой фотографии. */
  frames: Rect[];
  /** Область под текст. */
  textBox: Rect;
  /** Вертикальное выравнивание текста в своей области. */
  textAlign: "top" | "center" | "bottom";
  /** Горизонтальная выключка текста. */
  textAlignX: "left" | "center" | "right";
  /** Текст растянут на всю высоту области (вертикальное выравнивание не применяется). */
  textFill: boolean;
  /** Отдельная область под блок цены (null — цена внутри текстового блока). */
  priceBox: Rect | null;
};



/** Грубая оценка «веса» текста слайда в условных символах. */
export function textWeight(slide: PresentationSlide): number {
  const c = slide.content;
  let n = slide.title.length * 2 + slide.subtitle.length;
  if (c.showDescription) n += c.description.length;
  if (c.showIncludes) n += c.includes.reduce((a, i) => a + i.length + 12, 0);
  if (c.showSpecs) n += c.specs.reduce((a, s) => a + s.label.length + s.value.length + 10, 0);
  if (c.showPrice && c.price) n += 40;
  return n;
}

/** Список фотографий слайда с учётом старого одиночного поля. */
export function slidePhotos(slide: PresentationSlide): string[] {
  const c = slide.content;
  if (!c.showImage) return [];
  const list = [...c.images];
  if (slide.image_url && !list.includes(slide.image_url)) list.unshift(slide.image_url);
  return list.filter(Boolean).slice(0, MAX_SLIDE_PHOTOS);
}

function splitFrames(box: Rect, count: number): Rect[] {
  const g = GRID.photoGap;
  const portrait = box.h >= box.w;
  if (count <= 1) return [box];

  if (count === 2) {
    if (portrait) {
      const h = (box.h - g) / 2;
      return [
        { x: box.x, y: box.y, w: box.w, h },
        { x: box.x, y: box.y + h + g, w: box.w, h },
      ];
    }
    const w = (box.w - g) / 2;
    return [
      { x: box.x, y: box.y, w, h: box.h },
      { x: box.x + w + g, y: box.y, w, h: box.h },
    ];
  }

  if (count === 3) {
    if (portrait) {
      const hero = (box.h - g) * 0.6;
      const rest = box.h - g - hero;
      const w = (box.w - g) / 2;
      return [
        { x: box.x, y: box.y, w: box.w, h: hero },
        { x: box.x, y: box.y + hero + g, w, h: rest },
        { x: box.x + w + g, y: box.y + hero + g, w, h: rest },
      ];
    }
    const hero = (box.w - g) * 0.58;
    const rest = box.w - g - hero;
    const h = (box.h - g) / 2;
    return [
      { x: box.x, y: box.y, w: hero, h: box.h },
      { x: box.x + hero + g, y: box.y, w: rest, h },
      { x: box.x + hero + g, y: box.y + h + g, w: rest, h },
    ];
  }

  if (count === 4) {
    const w = (box.w - g) / 2;
    const h = (box.h - g) / 2;
    return [
      { x: box.x, y: box.y, w, h },
      { x: box.x + w + g, y: box.y, w, h },
      { x: box.x, y: box.y + h + g, w, h },
      { x: box.x + w + g, y: box.y + h + g, w, h },
    ];
  }

  // 5: крупное фото + полоса из четырёх миниатюр.
  if (portrait) {
    const hero = (box.h - g) * 0.62;
    const rest = box.h - g - hero;
    const w = (box.w - g * 3) / 4;
    return [
      { x: box.x, y: box.y, w: box.w, h: hero },
      ...[0, 1, 2, 3].map((i) => ({
        x: box.x + i * (w + g),
        y: box.y + hero + g,
        w,
        h: rest,
      })),
    ];
  }
  const hero = (box.w - g) * 0.6;
  const rest = box.w - g - hero;
  const h = (box.h - g * 3) / 4;
  return [
    { x: box.x, y: box.y, w: hero, h: box.h },
    ...[0, 1, 2, 3].map((i) => ({
      x: box.x + hero + g,
      y: box.y + i * (h + g),
      w: rest,
      h,
    })),
  ];
}

/** Область под блок цены для ручной зоны. */
function priceRect(zone: PriceZone, textBox: Rect): Rect | null {
  if (zone === "corner") return { x: SLIDE_W - GRID.marginX - 340, y: SLIDE_H - GRID.footerH - 110, w: 340, h: 84 };
  if (zone === "beside-photo") return { x: SLIDE_W - GRID.marginX - 340, y: GRID.marginTop, w: 340, h: 84 };
  if (zone === "under-text") return { x: textBox.x, y: textBox.y + textBox.h - 84, w: Math.min(340, textBox.w), h: 84 };
  return null;
}

/**
 * Раскладка слайда: автоматически по количеству фото и объёму текста, а
 * ручные значения из `content.layout` — это входные параметры автомата
 * (зона + масштаб), поэтому остальные блоки всегда подстраиваются сами.
 */
export function slideLayout(slide: PresentationSlide): SlideLayout {
  const photos = slidePhotos(slide);
  const ov = slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES;
  const legacy: SlideImageLayout = slide.content.imageLayout ?? "auto";
  const mode: PhotoZone = ov.photoZone !== "auto" ? ov.photoZone : (legacy as PhotoZone);
  const weight = textWeight(slide);

  const contentTop = GRID.marginTop;
  const contentH = SLIDE_H - GRID.marginTop - GRID.footerH;
  const align: SlideLayout["textAlign"] = ov.stretchY
    ? "top"
    : ov.textZone === "auto" ? "top" : ov.textZone;
  const alignX: SlideLayout["textAlignX"] = ov.alignX === "auto" ? "left" : ov.alignX;
  const widthK = ov.stretchX ? 1 : (ov.textWidth ?? 1);

  /**
   * Ужимает текстовую колонку по ручной ширине и выравнивает её внутри
   * доступной области по горизонтали (слева / по центру / справа).
   */
  const withWidth = (r: Rect): Rect => {
    const w = Math.max(240, Math.min(r.w, r.w * widthK));
    const free = r.w - w;
    const dx = alignX === "center" ? free / 2 : alignX === "right" ? free : 0;
    return { ...r, x: r.x + dx, w };
  };

  const fullText: Rect = withWidth({
    x: GRID.marginX,
    y: contentTop,
    w: SLIDE_W - GRID.marginX * 2,
    h: contentH,
  });

  const done = (l: Omit<SlideLayout, "textAlign" | "textAlignX" | "textFill" | "priceBox">): SlideLayout => ({
    ...l,
    textAlign: align,
    textAlignX: alignX,
    textFill: ov.stretchY,
    priceBox: priceRect(ov.priceZone, l.textBox),
  });


  if (!photos.length || mode === "none") {
    return done({ photos: [], placement: "none", photoBox: null, frames: [], textBox: fullText });
  }

  // Совсем мало текста + одно фото → фон на весь слайд.
  const hasText = weight > 60;
  if (mode === "full" || (!hasText && photos.length === 1 && mode === "auto")) {
    return done({
      photos,
      placement: "full",
      photoBox: { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H },
      frames: [{ x: 0, y: 0, w: SLIDE_W, h: SLIDE_H }],
      textBox: withWidth({
        x: GRID.marginX,
        y: SLIDE_H - GRID.footerH - 200,
        w: SLIDE_W - GRID.marginX * 2,
        h: 180,
      }),
    });
  }

  const placement: PhotoPlacement =
    mode === "left" || mode === "right" || mode === "top" ? mode : weight > 900 ? "right" : "left";

  if (placement === "top") {
    const h = ov.photoScale != null
      ? clampNum(ov.photoScale, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) * SLIDE_H
      : weight > 700 ? 240 : 300;
    const box: Rect = { x: GRID.marginX, y: contentTop, w: SLIDE_W - GRID.marginX * 2, h };
    return done({
      photos,
      placement,
      photoBox: box,
      frames: splitFrames(box, photos.length),
      textBox: withWidth({
        x: GRID.marginX,
        y: contentTop + h + 28,
        w: SLIDE_W - GRID.marginX * 2,
        h: contentH - h - 28,
      }),
    });
  }

  // Боковая колонка: чем больше текста, тем уже фотоблок.
  const photoW = ov.photoScale != null
    ? Math.round(clampNum(ov.photoScale, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) * SLIDE_W)
    : weight > 1100 ? 400 : weight > 700 ? 460 : 540;
  const gap = 44;
  const box: Rect =
    placement === "left"
      ? { x: 0, y: 0, w: photoW, h: SLIDE_H }
      : { x: SLIDE_W - photoW, y: 0, w: photoW, h: SLIDE_H };
  const textBox: Rect = withWidth(
    placement === "left"
      ? { x: photoW + gap, y: contentTop, w: SLIDE_W - photoW - gap - GRID.marginX, h: contentH }
      : { x: GRID.marginX, y: contentTop, w: SLIDE_W - photoW - gap - GRID.marginX, h: contentH },
  );

  return done({ photos, placement, photoBox: box, frames: splitFrames(box, photos.length), textBox });

}
