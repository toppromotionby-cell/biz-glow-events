import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getBlogPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, excerpt, body, cover_url, tags, published_at, seo_title, seo_description, published")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    return { post: post ?? null };
  });
