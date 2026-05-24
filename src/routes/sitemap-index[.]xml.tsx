// Sitemap-index: ссылается на тематические подкарты.
import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://event-hub.by";

export const Route = createFileRoute("/sitemap-index.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const subs = [
          "/sitemap.xml",          // основной (статика + всё)
          "/sitemap-services.xml",
          "/sitemap-equipment.xml",
          "/sitemap-blog.xml",
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
          subs.map((s) => `<sitemap><loc>${BASE}${s}</loc><lastmod>${today}</lastmod></sitemap>`).join("")
        }</sitemapindex>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
      },
    },
  },
});
