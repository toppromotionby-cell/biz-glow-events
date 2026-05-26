// Public catalog reads. Uses supabaseAdmin to bypass auth for public pages
// (RLS already restricts to published=true, but admin client avoids any
// reliance on the visitor's session during SSR). Pricing is public.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


function isAbsolute(u: string): boolean {
  return /^(https?:|blob:|data:)/i.test(u);
}

// Sign relative storage paths in photo_urls/video_urls so anonymous visitors
// can render private-bucket media on public catalog pages.
async function signMediaUrls<T extends { photo_urls?: string[] | null; video_urls?: string[] | null }>(
  rows: T[],
): Promise<T[]> {
  const paths = new Set<string>();
  for (const r of rows) {
    for (const u of r.photo_urls ?? []) if (u && !isAbsolute(u)) paths.add(u);
    for (const u of r.video_urls ?? []) if (u && !isAbsolute(u)) paths.add(u);
  }
  if (paths.size === 0) return rows;
  const list = Array.from(paths);
  const TTL = 60 * 60 * 24 * 7; // 7 days
  const { data, error } = await supabaseAdmin.storage.from("media").createSignedUrls(list, TTL);
  if (error || !data) {
    console.error("[signMediaUrls] failed:", error);
    return rows;
  }
  const map = new Map<string, string>();
  data.forEach((d, i) => { if (d.signedUrl) map.set(list[i], d.signedUrl); });
  return rows.map((r) => ({
    ...r,
    photo_urls: (r.photo_urls ?? []).map((u) => (u && !isAbsolute(u) ? map.get(u) ?? u : u)),
    video_urls: (r.video_urls ?? []).map((u) => (u && !isAbsolute(u) ? map.get(u) ?? u : u)),
  }));
}

export type CatalogType = "zones" | "tech_equipment" | "services" | "production_items";

const TYPES = ["zones", "tech_equipment", "services", "production_items"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type CatalogRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  photo_urls: string[] | null;
  video_urls: string[] | null;
  pricing: Json;
  features: Json;
  extras: Json;
  faq: Json;
  requirements: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category: string | null;
};

const SELECT = "id,slug,title,short_description,description,photo_urls,video_urls,pricing,features,extras,faq,requirements,seo_title,seo_description,category";

export const listCatalog = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ type: z.enum(TYPES) }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from(data.type)
      .select(SELECT)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listCatalog] DB error:", error);
      throw new Error("Не удалось загрузить каталог.");
    }
    const signed = await signMediaUrls((rows ?? []) as CatalogRow[]);
    return signed;
  });

export const getCatalogItem = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ type: z.enum(TYPES), slug: z.string().min(1).max(160) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from(data.type)
      .select(SELECT)
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[getCatalogItem] DB error:", error);
      throw new Error("Не удалось загрузить элемент каталога.");
    }
    if (!row) return null;
    const signed = await signMediaUrls([row as CatalogRow]);
    return signed[0];
  });

// Категории каталога — единый источник истины (таблица catalog_categories).
// Используется и админкой (CategoryCombobox), и публичными страницами,
// чтобы фильтры/значения всегда совпадали.
export const listCatalogCategories = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ type: z.enum(TYPES) }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("catalog_categories")
      .select("id,name,sort_order")
      .eq("entity_type", data.type)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("[listCatalogCategories] DB error:", error);
      return [] as { id: string; name: string; sort_order: number }[];
    }
    return (rows ?? []) as { id: string; name: string; sort_order: number }[];
  });
