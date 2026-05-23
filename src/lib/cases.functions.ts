// Public reads for cases (portfolio). Uses supabaseAdmin (RLS already restricts to published).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CaseRow = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  guests_count: number | null;
  summary: string | null;
  description: string | null;
  cover_url: string | null;
  photo_urls: string[] | null;
  video_urls: string[] | null;
  services_used: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: any;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

const SELECT = "id,slug,title,client,event_type,event_date,location,guests_count,summary,description,cover_url,photo_urls,video_urls,services_used,metrics,featured,seo_title,seo_description";

export const listCases = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ featuredOnly: z.boolean().optional(), limit: z.number().int().min(1).max(50).optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("cases").select(SELECT).eq("published", true)
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: false, nullsFirst: false });
    if (data.featuredOnly) q = q.eq("featured", true);
    if (data.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listCases] DB error:", error);
      throw new Error("Не удалось загрузить кейсы.");
    }
    return (rows ?? []) as CaseRow[];
  });

export const getCase = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(160) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cases").select(SELECT)
      .eq("published", true).eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[getCase] DB error:", error);
      throw new Error("Не удалось загрузить кейс.");
    }
    return (row ?? null) as CaseRow | null;
  });
