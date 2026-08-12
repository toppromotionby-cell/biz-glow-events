// Единая модель «позиция каталога сайта» для конструкторов КП и презентаций.
// Файл клиент-безопасный: типы и маппинги используются и в браузере, и на сервере.

export type CatalogPickType = "zones" | "services" | "tech_equipment" | "production_items" | "attractions";

export const CATALOG_PICK_TYPES: CatalogPickType[] = [
  "zones", "services", "tech_equipment", "production_items", "attractions",
];

export const CATALOG_PICK_LABELS: Record<CatalogPickType, string> = {
  zones: "Зоны",
  services: "Услуги",
  tech_equipment: "Оборудование",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

export type CatalogPriceOption = {
  /** Подпись варианта («от», «4 часа», «Базовый пакет»). */
  label: string;
  price: number;
  unit: string;
};

export type CatalogPick = {
  id: string;
  type: CatalogPickType;
  /** Раздел документа по умолчанию (человекочитаемый). */
  sectionLabel: string;
  title: string;
  description: string;
  /** «Что входит» — из features каталога. */
  includes: string[];
  /** Характеристики — из extras каталога. */
  specs: { label: string; value: string }[];
  priceOptions: CatalogPriceOption[];
  images: string[];
};

/** Как вставлять «что входит» в позицию КП. */
export type IncludesMode = "list" | "text";

export const defaultPriceOption = (pick: CatalogPick): CatalogPriceOption =>
  pick.priceOptions[0] ?? { label: "", price: 0, unit: "услуга" };

/** Текстовое представление «что входит» для описания позиции. */
export function includesAsText(includes: string[]): string {
  return includes.filter(Boolean).map((x) => `• ${x}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Маппинг в позицию КП (текст и цена; фотографии не переносятся)      */
/* ------------------------------------------------------------------ */

export type DocLineDraft = {
  title: string;
  description: string;
  includes: { text: string; note: string }[];
  unit: string;
  price: number;
  qty: number;
  section: string;
};

export function pickToDocLine(
  pick: CatalogPick,
  opts: { price?: CatalogPriceOption; includesMode: IncludesMode },
): DocLineDraft {
  const price = opts.price ?? defaultPriceOption(pick);
  const asList = opts.includesMode === "list";
  const extraText = asList ? "" : includesAsText(pick.includes);
  const description = [pick.description.trim(), extraText].filter(Boolean).join("\n\n");
  return {
    title: pick.title,
    description,
    includes: asList ? pick.includes.filter(Boolean).map((text) => ({ text, note: "" })) : [],
    unit: price.unit || "услуга",
    price: Number(price.price) || 0,
    qty: 1,
    section: pick.sectionLabel,
  };
}

/* ------------------------------------------------------------------ */
/* Маппинг в содержимое слайда презентации (всё, включая фото)         */
/* ------------------------------------------------------------------ */

export type SlideDraft = {
  title: string;
  subtitle: string;
  description: string;
  includes: string[];
  specs: { label: string; value: string }[];
  price: number | null;
  priceUnit: string;
  images: string[];
  entity_type: string;
  entity_id: string;
};

export const MAX_SLIDE_IMAGES = 5;

export function pickToSlideDraft(pick: CatalogPick, price?: CatalogPriceOption): SlideDraft {
  const p = price ?? defaultPriceOption(pick);
  return {
    title: pick.title,
    subtitle: pick.sectionLabel,
    description: pick.description,
    includes: pick.includes.filter(Boolean).slice(0, 12),
    specs: pick.specs.slice(0, 8),
    price: Number(p.price) > 0 ? Number(p.price) : null,
    priceUnit: p.unit || "",
    images: pick.images.filter(Boolean).slice(0, MAX_SLIDE_IMAGES),
    entity_type: pick.type,
    entity_id: pick.id,
  };
}
