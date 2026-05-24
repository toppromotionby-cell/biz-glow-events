// Адаптер: CatalogRow (Supabase) → CatalogItem (UI grid).
import type { CatalogItem } from "@/lib/catalog-mock";
import type { CatalogRow } from "@/lib/catalog.functions";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=70";

export function rowToItem(r: CatalogRow): CatalogItem {
  const photos = Array.isArray(r.photo_urls) ? r.photo_urls : [];
  const videos = Array.isArray(r.video_urls) ? r.video_urls : [];
  const pricing = (r.pricing ?? {}) as { from?: number; price_from?: number };
  const priceFrom = Number(pricing.from ?? pricing.price_from ?? 0) || 0;
  const tags = r.category ? [r.category] : [];
  return {
    slug: r.slug,
    title: r.title,
    description: r.short_description ?? r.description ?? "",
    priceFrom,
    image: photos[0] ?? FALLBACK_IMG,
    video: videos[0] ?? null,
    tags,
  };
}

export function rowsToItems(rows: CatalogRow[]): CatalogItem[] {
  return rows.map(rowToItem);
}
