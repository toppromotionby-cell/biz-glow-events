// Global search across catalog, cases, blog.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SearchHit = {
  id: string;
  kind: "zones" | "tech_equipment" | "services" | "production_items" | "attractions" | "cases" | "blog_posts";
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  score: number; // higher = better match
};

const KINDS = ["zones", "tech_equipment", "services", "production_items", "attractions"] as const;

function scoreHit(q: string, title: string, excerpt: string | null): number {
  const ql = q.toLowerCase();
  const tl = (title ?? "").toLowerCase();
  if (tl === ql) return 100;
  if (tl.startsWith(ql)) return 80;
  if (tl.includes(ql)) return 60;
  if ((excerpt ?? "").toLowerCase().includes(ql)) return 30;
  return 10;
}

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ q: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return [] as SearchHit[];
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const hits: SearchHit[] = [];

    await Promise.all([
      ...KINDS.map(async (kind) => {
        const { data: rows } = await supabaseAdmin
          .from(kind)
          .select("id,slug,title,short_description,description,category,photo_urls")
          .eq("published", true)
          .or(`title.ilike.${like},short_description.ilike.${like},description.ilike.${like},category.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({
            id: r.id, kind, slug: r.slug, title: r.title,
            excerpt: r.short_description ?? null,
            image: r.photo_urls?.[0] ?? null,
            score: scoreHit(q, r.title, r.short_description ?? r.description ?? null),
          });
        }
      }),
      (async () => {
        const { data: rows } = await supabaseAdmin
          .from("cases")
          .select("id,slug,title,summary,description,client,cover_url")
          .eq("published", true)
          .or(`title.ilike.${like},summary.ilike.${like},description.ilike.${like},client.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({
            id: r.id, kind: "cases", slug: r.slug, title: r.title,
            excerpt: r.summary ?? null, image: r.cover_url ?? null,
            score: scoreHit(q, r.title, r.summary ?? r.description ?? null),
          });
        }
      })(),
      (async () => {
        const { data: rows } = await supabaseAdmin
          .from("blog_posts")
          .select("id,slug,title,excerpt,body,cover_url")
          .eq("published", true)
          .or(`title.ilike.${like},excerpt.ilike.${like},body.ilike.${like}`)
          .limit(5);
        for (const r of rows ?? []) {
          hits.push({
            id: r.id, kind: "blog_posts", slug: r.slug, title: r.title,
            excerpt: r.excerpt ?? null, image: r.cover_url ?? null,
            score: scoreHit(q, r.title, r.excerpt ?? null),
          });
        }
      })(),
    ]);

    hits.sort((a, b) => b.score - a.score);
    return hits;
  });
