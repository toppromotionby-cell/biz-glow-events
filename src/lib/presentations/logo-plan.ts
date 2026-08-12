// Единый планировщик логотипов на слайде презентации.
// Гарантирует: на слайде не больше ОДНОГО логотипа компании и ОДНОГО логотипа
// клиента, они никогда не занимают один и тот же слот и не наезжают на фото.
// Используется превью (SlideCanvas), PDF и PPTX — раскладка везде одинаковая.
import { SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import {
  clampNum, DEFAULT_LAYOUT_OVERRIDES, LOGO_SCALE_MAX, LOGO_SCALE_MIN,
  type LogoOverride, type PresentationLogoLayout, type SlideLayoutOverrides, type SlideType,
} from "@/lib/presentations/model";

export type LogoSlot = "hero" | "footer" | "tl" | "tr" | "bl" | "br" | "free";

export type LogoPlacementPlan = {
  slot: LogoSlot;
  /** Максимальные габариты логотипа в координатах холста 1280×720. */
  maxW: number;
  maxH: number;
  /** Левый верхний угол для слота "free" (координаты холста 1280×720). */
  x?: number;
  y?: number;
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
  /** Ручные настройки раскладки слайда (зона и масштаб каждого логотипа). */
  overrides?: SlideLayoutOverrides;
  /** Занятые области слайда (текст, блок цены) — логотип туда не встанет. */
  blocked?: Rect[];
};

const ovScale = (o: LogoOverride): number =>
  o.scale == null ? 1 : clampNum(o.scale, LOGO_SCALE_MIN, LOGO_SCALE_MAX);

type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_ZONE = 300;
const CORNER_ZONE_H = 140;

function cornerRect(slot: Corner): Rect {
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
function cornerFree(
  slot: Corner,
  frames: Rect[],
  full: boolean,
  blocked: Rect[] = [],
): boolean {
  const zone = cornerRect(slot);
  if (blocked.some((b) => overlaps(zone, b))) return false;
  if (full) return slot === "tl" || slot === "tr";
  return !frames.some((f) => overlaps(zone, f));
}

const CORNERS: Corner[] = ["tr", "tl", "br", "bl"];

/** Переносит логотип из занятой области в ближайший свободный угол. */
function relocate(
  place: LogoPlacementPlan | null,
  taken: Set<LogoSlot>,
  frames: Rect[],
  full: boolean,
  blocked: Rect[],
): LogoPlacementPlan | null {
  if (!place || place.slot === "hero" || place.slot === "footer" || place.slot === "free") return place;
  if (cornerFree(place.slot, frames, full, blocked)) return place;
  const free = CORNERS.find((slot) => !taken.has(slot) && cornerFree(slot, frames, full, blocked));
  return free ? { ...place, slot: free } : place;
}

/** Минимально допустимая доля от исходного размера логотипа (ниже — не рисуем). */
export const LOGO_MIN_FIT = 0.55;

const SLOT_RECTS: Record<Corner, Rect> = {
  tl: cornerRect("tl"), tr: cornerRect("tr"), bl: cornerRect("bl"), br: cornerRect("br"),
};

/** Ширина/высота свободного просвета в углу с учётом занятых областей. */
function freeSpace(slot: Corner, obstacles: Rect[]): { w: number; h: number } {
  const zone = SLOT_RECTS[slot];
  let w = zone.w;
  let h = zone.h;
  const right = slot === "tr" || slot === "br";
  const bottom = slot === "bl" || slot === "br";
  for (const o of obstacles) {
    if (!overlaps(zone, o)) continue;
    // Просвет по горизонтали: сколько остаётся от края слайда до препятствия.
    const wGap = right ? Math.max(0, zone.x + zone.w - (o.x + o.w)) : Math.max(0, o.x - zone.x);
    const hGap = bottom ? Math.max(0, zone.y + zone.h - (o.y + o.h)) : Math.max(0, o.y - zone.y);
    // Ужимаем по той оси, где просвета больше — так логотип остаётся крупнее.
    if (wGap >= hGap) w = Math.min(w, wGap);
    else h = Math.min(h, hGap);
  }
  return { w: Math.max(0, w - 16), h: Math.max(0, h - 12) };
}

/**
 * Canva-подобный шаг 3: если свободного угла нет, логотип пропорционально
 * уменьшается под свободный просвет. Меньше LOGO_MIN_FIT — логотип убирается.
 */
function fitIntoFree(
  place: LogoPlacementPlan | null,
  frames: Rect[],
  full: boolean,
  blocked: Rect[],
): LogoPlacementPlan | null {
  if (!place) return null;
  if (place.slot === "hero" || place.slot === "footer" || place.slot === "free") {
    // Hero/footer живут в потоке контента, их ужимает только блок цены/текста,
    // если он физически накрывает область логотипа.
    return place;
  }
  const obstacles = [...blocked, ...(full ? [] : frames)];
  if (cornerFree(place.slot, frames, full, blocked)) return place;
  const { w, h } = freeSpace(place.slot, obstacles);
  const k = Math.min(w / place.maxW, h / place.maxH, 1);
  if (!Number.isFinite(k) || k < LOGO_MIN_FIT) return null;
  return { ...place, maxW: place.maxW * k, maxH: place.maxH * k };
}

const isTitleLike = (type: SlideType): boolean => type === "title" || type === "contacts";

/**
 * Свободная позиция логотипа (пользователь перетащил его мышью).
 * Размер подбирается под свободное место: если логотип накрывает текст или
 * блок цены, он пропорционально уменьшается (но не мельче LOGO_MIN_FIT).
 * Фотографии препятствием не считаются — поверх картинки логотип допустим.
 */
function freePlacement(
  pos: { x: number; y: number },
  baseW: number,
  baseH: number,
  blocked: Rect[],
): LogoPlacementPlan {
  let w = baseW;
  let h = baseH;
  const rectAt = (ww: number, hh: number): Rect => ({
    x: clampNum(pos.x * SLIDE_W, 0, SLIDE_W - ww),
    y: clampNum(pos.y * SLIDE_H, 0, SLIDE_H - hh),
    w: ww,
    h: hh,
  });
  for (let i = 0; i < 8; i += 1) {
    if (!blocked.some((b) => overlaps(rectAt(w, h), b))) break;
    const next = Math.max(LOGO_MIN_FIT, (w / baseW) * 0.9);
    if (next === w / baseW) break;
    w = baseW * next;
    h = baseH * next;
  }
  const r = rectAt(w, h);
  return { slot: "free", maxW: w, maxH: h, x: r.x, y: r.y };
}


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
  const ov = input.overrides ?? DEFAULT_LAYOUT_OVERRIDES;

  const blockedRects = input.blocked ?? [];
  // Базовый размер логотипа: на титульных слайдах крупнее, на остальных — компактный.
  const baseW = (titleLike ? 260 : 170) * scale;
  const baseH = (titleLike ? 62 : 42) * scale;

  // --- Логотип компании: ровно одно место ---
  let brand: LogoPlacementPlan | null = null;
  if (hasBrandLogo && layout.brand !== "off" && ov.brandLogo.pos) {
    const k = ovScale(ov.brandLogo);
    brand = freePlacement(ov.brandLogo.pos, baseW * k, baseH * k, blockedRects);
  } else if (hasBrandLogo && layout.brand !== "off" && ov.brandLogo.zone !== "auto") {
    const k = scale * ovScale(ov.brandLogo);
    brand = ov.brandLogo.zone === "hero"
      ? { slot: "hero", maxW: 320 * k, maxH: 76 * k }
      : ov.brandLogo.zone === "footer"
        ? { slot: "footer", maxW: 180 * k, maxH: 28 * k }
        : { slot: ov.brandLogo.zone, maxW: 200 * k, maxH: 48 * k };
  } else if (hasBrandLogo && layout.brand !== "off") {
    if (slideType === "title") {
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

  if (clientAllowed && ov.clientLogo.pos) {
    const k = ovScale(ov.clientLogo);
    client = freePlacement(ov.clientLogo.pos, baseW * k, baseH * k, blockedRects);
  } else if (clientAllowed && ov.clientLogo.zone !== "auto" && ov.clientLogo.zone !== "hero") {
    const k = scale * ovScale(ov.clientLogo);
    const slot = ov.clientLogo.zone;
    client = slot === "footer"
      ? { slot: "footer", maxW: 160 * k, maxH: 26 * k }
      : { slot, maxW: (titleLike ? 220 : 170) * k, maxH: (titleLike ? 54 : 42) * k };
    // Один слот — один логотип: если совпал с логотипом компании, двигаем компанию.
    if (brand && brand.slot === client.slot) {
      brand = { ...brand, slot: brand.slot === "footer" ? "bl" : "footer" };
    }
  } else if (clientAllowed) {
    const taken = new Set<LogoSlot>();
    if (brand) taken.add(brand.slot);
    const order: Corner[] = titleLike
      ? ["tr", "tl", "br"]
      : ["tr", "tl", "br", "bl"];
    const candidates: Corner[] = order.filter((slot) => {
      if (taken.has(slot)) return false;
      // Футер компании занимает низ слева — не ставим клиента в bl.
      if (brand?.slot === "footer" && slot === "bl") return false;
      return true;
    });
    const free = candidates.find((slot) => cornerFree(slot, frames, full, blockedRects));
    // Свободного угла нет — берём первый допустимый: fitIntoFree ниже
    // либо ужмёт логотип под просвет, либо уберёт его совсем.
    const slot = free ?? candidates[0] ?? null;
    if (slot) {
      client = titleLike
        ? { slot, maxW: 220 * scale, maxH: 54 * scale }
        : { slot, maxW: 170 * scale, maxH: 42 * scale };
    }
  }

  // Финальная проверка: логотип не должен накрывать текст или блок цены.
  const blocked = blockedRects;
  if (blocked.length) {
    client = relocate(client, new Set([brand?.slot].filter(Boolean) as LogoSlot[]), frames, full, blocked);
    brand = relocate(brand, new Set([client?.slot].filter(Boolean) as LogoSlot[]), frames, full, blocked);
  }
  // Шаг 3: свободного угла не нашлось — уменьшаем логотип под просвет.
  client = fitIntoFree(client, frames, full, blocked);
  brand = fitIntoFree(brand, frames, full, blocked);

  // Оба логотипа на слайде — одинакового размера (правило Canva-подобной пары).
  if (brand && client) {
    const w = Math.min(brand.maxW, client.maxW);
    const h = Math.min(brand.maxH, client.maxH);
    brand = { ...brand, maxW: w, maxH: h };
    client = { ...client, maxW: w, maxH: h };
  }

  return { brand, client };

}

/** Показывать ли текстовое название компании в футере (когда логотипа там нет). */
export function footerShowsBrandText(plan: SlideLogoPlan): boolean {
  return plan.brand?.slot !== "footer";
}
