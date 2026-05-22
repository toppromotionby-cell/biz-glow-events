// Global search across catalog, cases, blog.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SearchHit = {
  id: string;
  kind: "zones" | "tech_equipment" | "services" | "production_items" | "cases" | "blog_posts";
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
};

const KINDS = ["zones", "tech_equipment", "services", "production_items"] as const;

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ q: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const q = data.q.trim();
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const hits: SearchHit[] = [];

    await Promise.all([
      ...KINDS.map(async (kind) => {
        const { data: rows } = await supabaseAdmin
          .from(kind)
          .select("id,slug,title,short_description,photo_urls")
          .eq("published", true)
          .or(`title.ilike.${like},short_description.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({
            id: r.id, kind, slug: r.slug, title: r.title,
            excerpt: r.short_description ?? null,
            image: r.photo_urls?.[0] ?? null,
          });
        }
      }),
      (async () => {
        const { data: rows } = await supabaseAdmin
          .from("cases")
          .select("id,slug,title,summary,cover_url")
          .eq("published", true)
          .or(`title.ilike.${like},summary.ilike.${like},client.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({ id: r.id, kind: "cases", slug: r.slug, title: r.title, excerpt: r.summary, image: r.cover_url });
        }
      })(),
      (async () => {
        const { data: rows } = await supabaseAdmin
          .from("blog_posts")
          .select("id,slug,title,excerpt,cover_url")
          .eq("published", true)
          .or(`title.ilike.${like},excerpt.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({ id: r.id, kind: "blog_posts", slug: r.slug, title: r.title, excerpt: r.excerpt, image: r.cover_url });
        }
      })(),
    ]);

    return hits;
  });
