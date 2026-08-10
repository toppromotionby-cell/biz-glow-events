// Сверка презентации со связанным КП: какие позиции есть, каких не хватает,
// какие слайды лишние и где не хватает фото или описания.
import type { PresentationSlide } from "@/lib/presentations/model";

export type QuoteItemLite = {
  id: string;
  title: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  includes: string[];
  entity_type: string | null;
  entity_id: string | null;
};

export type PresentationCheck = {
  matched: { item: QuoteItemLite; slide: PresentationSlide }[];
  missing: QuoteItemLite[];
  extra: PresentationSlide[];
  incomplete: PresentationSlide[];
  status: "synced" | "missing" | "extra" | "incomplete";
  statusLabel: string;
};

export function checkAgainstQuote(
  slides: PresentationSlide[],
  items: QuoteItemLite[],
): PresentationCheck {
  const productSlides = slides.filter((s) => s.type === "product");
  const byItemId = new Map<string, PresentationSlide>();
  for (const s of productSlides) if (s.quote_item_id) byItemId.set(s.quote_item_id, s);

  const matched: PresentationCheck["matched"] = [];
  const missing: QuoteItemLite[] = [];
  for (const item of items) {
    const slide =
      byItemId.get(item.id) ??
      productSlides.find(
        (s) => !s.quote_item_id && s.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
      );
    if (slide) matched.push({ item, slide });
    else missing.push(item);
  }

  const usedSlides = new Set(matched.map((m) => m.slide.id));
  const extra = productSlides.filter((s) => !usedSlides.has(s.id));

  const incomplete = productSlides.filter(
    (s) => !s.image_url || !s.content.description.trim(),
  );

  const status: PresentationCheck["status"] = missing.length
    ? "missing"
    : extra.length
      ? "extra"
      : incomplete.length
        ? "incomplete"
        : "synced";

  const statusLabel = {
    synced: "Полностью синхронизировано",
    missing: "Есть позиции из КП без слайдов",
    extra: "Есть лишние слайды",
    incomplete: "Есть позиции без фото или описания",
  }[status];

  return { matched, missing, extra, incomplete, status, statusLabel };
}
