// Публичные чтения блога. supabaseAdmin используется так же, как в кейсах:
// RLS ограничивает published, а SSR не зависит от сессии посетителя.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BlogListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

export const listBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_url,tags,published_at")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 200);
    if (error) {
      console.error("[listBlogPosts] DB error:", error);
      return [] as BlogListItem[];
    }
    return (rows ?? []) as BlogListItem[];
  });

export const getBlogPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, excerpt, body, cover_url, tags, published_at, seo_title, seo_description, published")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    return { post: post ?? null };
  });
