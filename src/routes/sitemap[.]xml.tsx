import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://event-hub.by";
const STATIC: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/zones", priority: "0.9", changefreq: "weekly" },
  { path: "/equipment", priority: "0.9", changefreq: "weekly" },
  { path: "/services", priority: "0.9", changefreq: "weekly" },
  { path: "/production", priority: "0.9", changefreq: "weekly" },
  { path: "/blog", priority: "0.6", changefreq: "weekly" },
  { path: "/contacts", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/offer", priority: "0.2", changefreq: "yearly" },
  { path: "/login", priority: "0.3", changefreq: "yearly" },
  { path: "/register", priority: "0.3", changefreq: "yearly" },
];

type Row = { slug: string; updated_at: string };

async function fetchSlugs(table: "zones" | "tech_equipment" | "services" | "production_items" | "blog_posts"): Promise<Row[]> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("slug, updated_at")
    .eq("published", true);
  return (data ?? []) as Row[];
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [zones, equipment, services, production, posts] = await Promise.all([
            fetchSlugs("zones"),
            fetchSlugs("tech_equipment"),
            fetchSlugs("services"),
            fetchSlugs("production_items"),
            fetchSlugs("blog_posts"),
          ]);

          const dynamic: Array<{ path: string; lastmod?: string }> = [
            ...zones.map((r) => ({ path: `/zones/${r.slug}`, lastmod: r.updated_at })),
            ...equipment.map((r) => ({ path: `/equipment/${r.slug}`, lastmod: r.updated_at })),
            ...services.map((r) => ({ path: `/services/${r.slug}`, lastmod: r.updated_at })),
            ...production.map((r) => ({ path: `/production/${r.slug}`, lastmod: r.updated_at })),
            ...posts.map((r) => ({ path: `/blog/${r.slug}`, lastmod: r.updated_at })),
          ];

          const staticXml = STATIC.map(
            (u) => `<url><loc>${BASE}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
          ).join("");

          const dynXml = dynamic
            .map((u) => {
              const lm = u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : "";
              return `<url><loc>${BASE}${escape(u.path)}</loc>${lm}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
            })
            .join("");

          const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticXml}${dynXml}</urlset>`;
          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch {
          const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${STATIC.map((u) => `<url><loc>${BASE}${u.path}</loc></url>`).join("")}</urlset>`;
          return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
        }
      },
    },
  },
});
