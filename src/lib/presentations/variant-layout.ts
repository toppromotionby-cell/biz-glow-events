// Что именно меняет вариант оформления у базовых типов слайда (титул, позиция,
// текст, раздел, контакты). Один источник правды: его читают и движок раскладки
// (design.ts), и спеки слайдов (slide-spec / content-spec), поэтому превью и PDF
// показывают один результат. Ручные настройки пользователя всегда сильнее плана.
import type { PhotoZone, SlideType, TextAlignX } from "@/lib/presentations/model";

export type ContactsMode = "cards" | "center" | "columns" | "band" | "split";

export type VariantPlan = {
  /** Базовая зона фото, если пользователь не задал свою. */
  photoZone: PhotoZone;
  /** Базовое горизонтальное выравнивание текста. */
  alignX: Exclude<TextAlignX, "auto">;
  /** Доля ширины текстовой колонки (1 — вся колонка). */
  textWidth: number;
  /** Текст разложен в две колонки. */
  columns: 1 | 2;
  /** Описание превращается в маркированный чек-лист. */
  checklist: boolean;
  /** Множители кегля заголовка и основного текста. */
  titleBoost: number;
  bodyBoost: number;
  /** Декоративный круг на титульном (в «минимале» и на фото он лишний). */
  decor: boolean;
  /** Акцентная полоса слева от заголовка (разделитель / контакты). */
  band: boolean;
  /** Крупный номер главы у разделителя. */
  numbered: boolean;
  /** Крупная плашка цены у позиции. */
  priceAccent: boolean;
  /** Раскладка контактных карточек. */
  contacts: ContactsMode;
};

const BASE: VariantPlan = {
  photoZone: "auto",
  alignX: "left",
  textWidth: 1,
  columns: 1,
  checklist: false,
  titleBoost: 1,
  bodyBoost: 1,
  decor: true,
  band: false,
  numbered: false,
  priceAccent: false,
  contacts: "cards",
};

const plan = (patch: Partial<VariantPlan>): VariantPlan => ({ ...BASE, ...patch });

/** Планы по типам слайда: ключ — id варианта из SLIDE_VARIANTS. */
const PLANS: Partial<Record<SlideType, Record<string, VariantPlan>>> = {
  title: {
    classic: plan({ textWidth: 0.72 }),
    "hero-photo": plan({ photoZone: "full", decor: false, titleBoost: 1.05 }),
    split: plan({ photoZone: "right", textWidth: 1 }),
    minimal: plan({ photoZone: "none", alignX: "center", textWidth: 0.78, decor: false }),
    bento: plan({ photoZone: "top", textWidth: 0.9 }),
  },
  product: {
    classic: plan({ photoZone: "left" }),
    "hero-top": plan({ photoZone: "top" }),
    gallery: plan({ photoZone: "right" }),
    "price-accent": plan({ photoZone: "left", priceAccent: true }),
    full: plan({ photoZone: "full", decor: false }),
  },
  text: {
    classic: plan({ photoZone: "none" }),
    "two-cols": plan({ photoZone: "none", columns: 2 }),
    checklist: plan({ photoZone: "none", checklist: true }),
    quote: plan({ photoZone: "none", alignX: "center", textWidth: 0.82, titleBoost: 1.35, bodyBoost: 1.25 }),
    "with-photo": plan({ photoZone: "right" }),
  },
  section: {
    classic: plan({ photoZone: "none" }),
    number: plan({ photoZone: "none", numbered: true, titleBoost: 1.1 }),
    band: plan({ photoZone: "none", band: true }),
    photo: plan({ photoZone: "full", decor: false }),
    minimal: plan({ photoZone: "none", alignX: "center", textWidth: 0.8, titleBoost: 1.15 }),
  },
  contacts: {
    classic: plan({ photoZone: "none", contacts: "cards" }),
    center: plan({ photoZone: "none", alignX: "center", contacts: "center" }),
    columns: plan({ photoZone: "none", contacts: "columns" }),
    band: plan({ photoZone: "none", contacts: "band", band: true }),
    split: plan({ photoZone: "none", contacts: "split" }),
  },
};

/**
 * План оформления для типа и варианта. Неизвестный вариант (или тип с
 * собственным движком блоков) получает нейтральный план — поведение «как было».
 */
export function variantPlan(type: SlideType, variant: string | undefined): VariantPlan {
  return PLANS[type]?.[variant ?? ""] ?? BASE;
}

/** Вариант реально влияет на базовые типы (для UI-подсказок и тестов). */
export function hasVariantPlan(type: SlideType): boolean {
  return !!PLANS[type];
}
