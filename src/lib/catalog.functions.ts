// Public catalog reads. Uses supabaseAdmin to bypass auth for public pages
// (RLS already restricts to published=true, but admin client avoids any
// reliance on the visitor's session during SSR).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  faq: Json;
  requirements: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category: string | null;
};

const SELECT = "id,slug,title,short_description,description,photo_urls,video_urls,pricing,features,faq,requirements,seo_title,seo_description,category";

export const listCatalog = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ type: z.enum(TYPES) }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from(data.type)
      .select(SELECT)
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CatalogRow[];
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
    if (error) throw new Error(error.message);
    return (row ?? null) as CatalogRow | null;
  });
