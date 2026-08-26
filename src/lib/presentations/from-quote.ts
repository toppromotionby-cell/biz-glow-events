// Сборка черновика презентации из коммерческого предложения.
// Чистые функции, browser-safe: используются и в окне сборки (превью сториборда),
// и на сервере при создании слайдов.
import { EMPTY_CONTENT, type SlideType } from "@/lib/presentations/model";
import type { QuoteItemLite } from "@/lib/presentations/check";

/** Позиция КП с разделом и картинкой из каталога — вход для сборки. */
export type StoryItem = QuoteItemLite & {
  section?: string;
  image?: string | null;
  images?: string[];
  cardDescription?: string;
  cardFeatures?: string[];
};

export type StoryMeta = {
  /** Тема КП. */
  title: string;
  /** Номер документа для подзаголовка обложки. */
  number: string;
  clientName: string;
  clientCompany: string;
  eventDate: string;
  venue: string;
  /** Абзацы «О нас» / условий (уже готовый текст). */
  about: string;
  terms: string;
  /** Валюта для бюджетного слайда. */
  currency: string;
};

export type StoryTotals = {
  subtotal: number;
  discount: number;
  delivery: number;
  management: number;
  agencyFee: number;
  vat: number;
  total: number;
  prepayment: number;
};

export type StoryboardOptions = {
  cover: boolean;
  about: boolean;
  sections: boolean;
  extras: boolean;
  terms: boolean;
  budget: boolean;
  contacts: boolean;
  /** Показывать цены на слайдах позиций. */
  prices: boolean;
  /** Какие позиции включать (id). Пустой массив = все. */
  itemIds: string[];
};

export const DEFAULT_STORYBOARD_OPTIONS: StoryboardOptions = {
  cover: true,
  about: true,
  sections: true,
  extras: true,
  terms: true,
  budget: true,
  contacts: true,
  prices: true,
  itemIds: [],
};

/** Один шаг сценария — и для превью, и для создания слайда. */
export type StoryStep = {
  key: string;
  type: SlideType;
  title: string;
  subtitle: string;
  /** Пояснение в превью сториборда («3 позиции», «нет фото»). */
  note: string;
  image_url: string | null;
  content: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  quote_item_id: string | null;
};

const MAX_SLIDE_PHOTOS = 15;

const money = (n: number, currency: string) =>
  `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.round((Number(n) || 0) * 100) / 100,
  )} ${currency}`;

const clean = (s: unknown) => String(s ?? "").trim();

function itemPhotos(item: StoryItem): string[] {
  const list = [...(item.images ?? []), ...(item.image ? [item.image] : [])]
    .map((s) => clean(s))
    .filter(Boolean);
  return [...new Set(list)].slice(0, MAX_SLIDE_PHOTOS);
}

/** Позиция достойна отдельного слайда, если есть фото или содержательное описание. */
export function isFeatureItem(item: StoryItem): boolean {
  const photos = itemPhotos(item);
  const text = clean(item.description) || clean(item.cardDescription);
  return photos.length > 0 || text.length >= 40 || (item.includes ?? []).length > 0;
}

function productStep(item: StoryItem, opts: StoryboardOptions, currency: string): StoryStep {
  const photos = itemPhotos(item);
  const includes = item.includes?.length ? item.includes : (item.cardFeatures ?? []);
  return {
    key: `item:${item.id}`,
    type: "product",
    title: clean(item.title) || "Позиция",
    subtitle: clean(item.section),
    note: photos.length ? `${photos.length} фото` : "без фото",
    image_url: photos[0] ?? null,
    content: {
      ...EMPTY_CONTENT,
      description: clean(item.description) || clean(item.cardDescription),
      includes,
      specs: [],
      price: opts.prices ? (Number(item.price) || null) : null,
      priceUnit: clean(item.unit) || "шт.",
      qty: Number(item.qty) || null,
      images: photos,
      showPrice: opts.prices,
      showImage: photos.length > 0,
    },
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    quote_item_id: item.id,
  };
}

function textStep(key: string, title: string, subtitle: string, description: string, note = ""): StoryStep {
  return {
    key,
    type: "text",
    title,
    subtitle,
    note,
    image_url: null,
    content: { ...EMPTY_CONTENT, description, showImage: false, showPrice: false },
    entity_type: null,
    entity_id: null,
    quote_item_id: null,
  };
}

/**
 * Сценарий деки: обложка → о нас → (раздел → позиции)* → дополнительно →
 * условия → бюджет → контакты.
 */
export function buildStoryboard(
  meta: StoryMeta,
  items: StoryItem[],
  totals: StoryTotals,
  options: Partial<StoryboardOptions> = {},
): StoryStep[] {
  const opts = { ...DEFAULT_STORYBOARD_OPTIONS, ...options };
  const wanted = new Set(opts.itemIds);
  const picked = opts.itemIds.length ? items.filter((i) => wanted.has(i.id)) : items;
  const currency = meta.currency || "BYN";
  const steps: StoryStep[] = [];

  if (opts.cover) {
    const parts = [meta.clientCompany || meta.clientName, meta.eventDate, meta.venue].map(clean).filter(Boolean);
    steps.push({
      key: "cover",
      type: "title",
      title: clean(meta.title) || "Коммерческое предложение",
      subtitle: parts.join(" · "),
      note: meta.number ? `КП ${meta.number}` : "обложка",
      image_url: null,
      content: { ...EMPTY_CONTENT },
      entity_type: null,
      entity_id: null,
      quote_item_id: null,
    });
  }

  if (opts.about && clean(meta.about)) {
    steps.push(textStep("about", "О нас", "", clean(meta.about), "из карточки компании"));
  }

  const feature = picked.filter(isFeatureItem);
  const extras = picked.filter((i) => !isFeatureItem(i));

  const groups = new Map<string, StoryItem[]>();
  for (const it of feature) {
    const key = opts.sections ? clean(it.section) : "";
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }
  const useSections = opts.sections && [...groups.keys()].filter(Boolean).length > 1;

  for (const [section, list] of groups) {
    if (useSections && section) {
      steps.push({
        key: `section:${section}`,
        type: "section",
        title: section,
        subtitle: `${list.length} ${list.length === 1 ? "позиция" : "позиции"}`,
        note: "разделитель",
        image_url: list.find((i) => itemPhotos(i).length)?.image ?? null,
        content: { ...EMPTY_CONTENT },
        entity_type: null,
        entity_id: null,
        quote_item_id: null,
      });
    }
    for (const item of list) steps.push(productStep(item, opts, currency));
  }

  if (opts.extras && extras.length) {
    const lines = extras.map((i) => {
      const qty = Number(i.qty) || 1;
      const price = opts.prices && i.price ? ` — ${money(qty * Number(i.price), currency)}` : "";
      return `• ${clean(i.title)}${qty > 1 ? ` × ${qty} ${clean(i.unit) || "шт."}` : ""}${price}`;
    });
    steps.push(
      textStep("extras", "Дополнительно", "Позиции без отдельного слайда", lines.join("\n"), `${extras.length} позиций`),
    );
  }

  if (opts.terms && clean(meta.terms)) {
    steps.push(textStep("terms", "Условия работы", "", clean(meta.terms), "из блоков КП"));
  }

  if (opts.budget) {
    const rows: Array<[string, number]> = [
      ["Позиции", totals.subtotal],
      ["Скидка", -totals.discount],
      ["Доставка и логистика", totals.delivery],
      ["Менеджмент", totals.management],
      ["Комиссия агентства", totals.agencyFee],
      ["НДС", totals.vat],
    ];
    const body = rows
      .filter(([, v]) => Math.abs(v) > 0.004)
      .map(([label, v]) => `${label}: ${money(Math.abs(v), currency)}${v < 0 ? " (минус)" : ""}`);
    body.push(`Итого: ${money(totals.total, currency)}`);
    if (totals.prepayment > 0) body.push(`Предоплата: ${money(totals.prepayment, currency)}`);
    steps.push(textStep("budget", "Бюджет", "Итоги по коммерческому предложению", body.join("\n"), "суммы из КП"));
  }

  if (opts.contacts) {
    steps.push({
      key: "contacts",
      type: "contacts",
      title: "Свяжитесь с нами",
      subtitle: "Ответим на вопросы и подготовим смету",
      note: "финальный слайд",
      image_url: null,
      content: { ...EMPTY_CONTENT },
      entity_type: null,
      entity_id: null,
      quote_item_id: null,
    });
  }

  return steps;
}

/** Строки для вставки в presentation_slides. */
export function stepsToSlideRows(steps: StoryStep[]) {
  return steps.map((s, i) => ({
    position: i,
    type: s.type,
    title: s.title,
    subtitle: s.subtitle,
    image_url: s.image_url,
    content_json: s.content,
    entity_type: s.entity_type,
    entity_id: s.entity_id,
    quote_item_id: s.quote_item_id,
    is_visible: true,
  }));
}

export type QuoteDiff = {
  added: Array<{ id: string; title: string }>;
  removed: Array<{ slideId: string; title: string }>;
  changed: Array<{ slideId: string; itemId: string; title: string; field: "title" | "price" | "qty"; from: string; to: string }>;
};

/** Расхождения между слайдами презентации и текущими позициями КП. */
export function diffSlidesAgainstItems(
  slides: Array<{ id: string; type: string; title: string; quote_item_id: string | null; content: { price: number | null; qty: number | null } }>,
  items: StoryItem[],
): QuoteDiff {
  const productSlides = slides.filter((s) => s.type === "product");
  const byItem = new Map(productSlides.filter((s) => s.quote_item_id).map((s) => [s.quote_item_id as string, s]));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const added = items.filter((i) => !byItem.has(i.id)).map((i) => ({ id: i.id, title: clean(i.title) }));
  const removed = productSlides
    .filter((s) => !s.quote_item_id || !itemMap.has(s.quote_item_id))
    .map((s) => ({ slideId: s.id, title: s.title }));

  const changed: QuoteDiff["changed"] = [];
  for (const [itemId, slide] of byItem) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    if (clean(item.title) && clean(item.title) !== clean(slide.title)) {
      changed.push({ slideId: slide.id, itemId, title: clean(item.title), field: "title", from: slide.title, to: clean(item.title) });
    }
    const price = Number(item.price) || 0;
    if (slide.content.price != null && Math.abs(Number(slide.content.price) - price) > 0.004) {
      changed.push({ slideId: slide.id, itemId, title: clean(item.title), field: "price", from: String(slide.content.price), to: String(price) });
    }
    const qty = Number(item.qty) || 0;
    if (slide.content.qty != null && Math.abs(Number(slide.content.qty) - qty) > 0.004) {
      changed.push({ slideId: slide.id, itemId, title: clean(item.title), field: "qty", from: String(slide.content.qty), to: String(qty) });
    }
  }
  return { added, removed, changed };
}
