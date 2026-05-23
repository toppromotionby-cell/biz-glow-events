// Public catalog reads. Uses supabaseAdmin to bypass auth for public pages
// (RLS already restricts to published=true, but admin client avoids any
// reliance on the visitor's session during SSR).
// SECURITY: pricing is stripped from responses for unauthenticated callers —
// prices are gated to logged-in users (see PriceGate).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isAuthed(): Promise<boolean> {
  try {
    const h = getRequestHeader("authorization");
    if (!h?.startsWith("Bearer ")) return false;
    const token = h.slice(7);
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data, error } = await sb.auth.getClaims(token);
    return !error && !!data?.claims?.sub;
  } catch {
    return false;
  }
}

function stripPricing<T extends { pricing?: unknown }>(rows: T[], authed: boolean): T[] {
  return authed ? rows : rows.map((r) => ({ ...r, pricing: null }));
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
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listCatalog] DB error:", error);
      throw new Error("Не удалось загрузить каталог.");
    }
    const authed = await isAuthed();
    return stripPricing((rows ?? []) as CatalogRow[], authed);
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
    const authed = await isAuthed();
    return stripPricing([row as CatalogRow], authed)[0];
  });
