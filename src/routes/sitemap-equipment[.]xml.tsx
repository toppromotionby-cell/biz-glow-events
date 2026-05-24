// Sub-sitemap: equipment.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://event-hub.by";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/sitemap-equipment.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { data } = await supabaseAdmin.from("tech_equipment").select("slug, updated_at").eq("published", true);
        const rows = (data ?? []) as Array<{ slug: string; updated_at: string }>;
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
          rows.map((r) => `<url><loc>${BASE}/equipment/${esc(r.slug)}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0,10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("")
        }</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
      },
    },
  },
});
