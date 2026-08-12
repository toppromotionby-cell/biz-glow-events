// Единый планировщик логотипов на слайде презентации.
// Гарантирует: на слайде не больше ОДНОГО логотипа компании и ОДНОГО логотипа
// клиента, они никогда не занимают один и тот же слот и не наезжают на фото.
// Используется превью (SlideCanvas), PDF и PPTX — раскладка везде одинаковая.
import { SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { PresentationLogoLayout, SlideType } from "@/lib/presentations/model";

export type LogoSlot = "hero" | "footer" | "tl" | "tr" | "bl" | "br";

export type LogoPlacementPlan = {
  slot: LogoSlot;
  /** Максимальные габариты логотипа в координатах холста 1280×720. */
  maxW: number;
  maxH: number;
};

export type SlideLogoPlan = {
  brand: LogoPlacementPlan | null;
  client: LogoPlacementPlan | null;
};

export type PlanLogosInput = {
  slideType: SlideType;
  /** Рамки фотографий слайда (координаты холста 1280×720). */
  frames?: Rect[];
  /** Раскладка фото: "full" — фото на весь слайд. */
  placement?: string;
  layout: PresentationLogoLayout;
  hasBrandLogo: boolean;
  hasClientLogo: boolean;
};

const CORNER_ZONE = 300;
const CORNER_ZONE_H = 140;

function cornerRect(slot: Exclude<LogoSlot, "hero" | "footer">): Rect {
  switch (slot) {
    case "tl":
      return { x: 0, y: 0, w: CORNER_ZONE, h: CORNER_ZONE_H };
    case "tr":
      return { x: SLIDE_W - CORNER_ZONE, y: 0, w: CORNER_ZONE, h: CORNER_ZONE_H };
    case "bl":
      return { x: 0, y: SLIDE_H - CORNER_ZONE_H, w: CORNER_ZONE, h: CORNER_ZONE_H };
    case "br":
      return { x: SLIDE_W - CORNER_ZONE, y: SLIDE_H - CORNER_ZONE_H, w: CORNER_ZONE, h: CORNER_ZONE_H };
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Свободен ли угол от фотографий (для full-bleed считаем свободным — есть затемнение). */
function cornerFree(slot: Exclude<LogoSlot, "hero" | "footer">, frames: Rect[], full: boolean): boolean {
  if (full) return slot === "tl" || slot === "tr";
  const zone = cornerRect(slot);
  return !frames.some((f) => overlaps(zone, f));
}

const isTitleLike = (type: SlideType): boolean => type === "title" || type === "contacts";

/**
 * Рассчитывает единственную позицию для логотипа компании и логотипа клиента.
 * Размеры отдаются в координатах холста 1280×720 — рендеры сами пересчитывают.
 */
export function planSlideLogos(input: PlanLogosInput): SlideLogoPlan {
  const { slideType, layout, hasBrandLogo, hasClientLogo } = input;
  const frames = input.frames ?? [];
  const full = input.placement === "full";
  const titleLike = isTitleLike(slideType);
  const scale = layout.scale;

  // --- Логотип компании: ровно одно место ---
  let brand: LogoPlacementPlan | null = null;
  if (hasBrandLogo && layout.brand !== "off") {
    if (titleLike) {
      // Крупный логотип в контентной зоне, в футере его уже не рисуем.
      brand = { slot: "hero", maxW: 320 * scale, maxH: 76 * scale };
    } else if (layout.brand !== "title-only") {
      brand = { slot: "footer", maxW: 180 * scale, maxH: 28 * scale };
    }
  }

  // --- Логотип клиента: свободный угол, не совпадающий со слотом компании ---
  let client: LogoPlacementPlan | null = null;
  const clientAllowed =
    hasClientLogo &&
    layout.client !== "off" &&
    (layout.client !== "title-only" || titleLike);

  if (clientAllowed) {
    const taken = new Set<LogoSlot>();
    if (brand) taken.add(brand.slot);
    const order: Exclude<LogoSlot, "hero" | "footer">[] = titleLike
      ? ["tr", "tl", "br"]
      : ["tr", "tl", "br", "bl"];
    const candidates = order.filter((slot) => {
      if (taken.has(slot)) return false;
      // Футер компании занимает низ слева — не ставим клиента в bl.
      if (brand?.slot === "footer" && slot === "bl") return false;
      return true;
    });
    const free = candidates.find((slot) => cornerFree(slot, frames, full));
    const slot = free ?? (layout.client === "always" ? candidates[0] : null);
    if (slot) {
      client = titleLike
        ? { slot, maxW: 220 * scale, maxH: 54 * scale }
        : { slot, maxW: 170 * scale, maxH: 42 * scale };
    }
  }

  return { brand, client };
}

/** Показывать ли текстовое название компании в футере (когда логотипа там нет). */
export function footerShowsBrandText(plan: SlideLogoPlan): boolean {
  return plan.brand?.slot !== "footer";
}
