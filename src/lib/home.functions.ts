import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HomeFeatured = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  photo_urls: string[] | null;
  basePath: string;
};
export type HomeBlogTeaser = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
};
export type HomeCaseTeaser = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  event_type: string | null;
  guests_count: number | null;
};

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const tables = [
    { name: "zones" as const, base: "/zones" },
    { name: "tech_equipment" as const, base: "/equipment" },
    { name: "services" as const, base: "/services" },
    { name: "production_items" as const, base: "/production" },
  ];

  const featuredResults = await Promise.all(
    tables.map(async (t) => {
      const { data } = await supabaseAdmin
        .from(t.name)
        .select("id, slug, title, short_description, photo_urls")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(2);
      return (data ?? []).map((row) => ({ ...row, basePath: t.base }) as HomeFeatured);
    }),
  );
  const featured = featuredResults.flat().slice(0, 6);

  const { data: blog } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_url, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(3);

  const { data: cs } = await supabaseAdmin
    .from("cases")
    .select("id, slug, title, summary, cover_url, event_type, guests_count")
    .eq("published", true)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(3);

  return {
    featured,
    posts: (blog ?? []) as HomeBlogTeaser[],
    cases: (cs ?? []) as HomeCaseTeaser[],
  };
});
