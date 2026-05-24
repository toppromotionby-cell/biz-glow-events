// Sub-sitemap: services + zones + production. Часть индексной структуры.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://event-hub.by";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rows(table: "services" | "zones" | "production_items") {
  const { data } = await supabaseAdmin.from(table).select("slug, updated_at").eq("published", true);
  return (data ?? []) as Array<{ slug: string; updated_at: string }>;
}

export const Route = createFileRoute("/sitemap-services.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [services, zones, production] = await Promise.all([rows("services"), rows("zones"), rows("production_items")]);
        const all = [
          ...services.map((r) => ({ path: `/services/${r.slug}`, lm: r.updated_at })),
          ...zones.map((r) => ({ path: `/zones/${r.slug}`, lm: r.updated_at })),
          ...production.map((r) => ({ path: `/production/${r.slug}`, lm: r.updated_at })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
          all.map((u) => `<url><loc>${BASE}${esc(u.path)}</loc><lastmod>${new Date(u.lm).toISOString().slice(0,10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("")
        }</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
      },
    },
  },
});
