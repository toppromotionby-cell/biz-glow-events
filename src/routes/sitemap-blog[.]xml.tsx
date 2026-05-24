// Sub-sitemap: blog posts + cases.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://event-hub.by";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rows(table: "blog_posts" | "cases") {
  const { data } = await supabaseAdmin.from(table).select("slug, updated_at").eq("published", true);
  return (data ?? []) as Array<{ slug: string; updated_at: string }>;
}

export const Route = createFileRoute("/sitemap-blog.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [posts, cases] = await Promise.all([rows("blog_posts"), rows("cases")]);
        const all = [
          ...posts.map((r) => ({ path: `/blog/${r.slug}`, lm: r.updated_at })),
          ...cases.map((r) => ({ path: `/cases/${r.slug}`, lm: r.updated_at })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
          all.map((u) => `<url><loc>${BASE}${esc(u.path)}</loc><lastmod>${new Date(u.lm).toISOString().slice(0,10)}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join("")
        }</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
      },
    },
  },
});
