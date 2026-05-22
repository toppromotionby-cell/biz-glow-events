import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://event-hub.by";
const STATIC = ["/", "/zones", "/equipment", "/services", "/production", "/blog", "/contacts", "/privacy", "/offer", "/login", "/register"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC.map(
          (p) => `<url><loc>${BASE}${p}</loc><changefreq>weekly</changefreq><priority>${p === "/" ? "1.0" : "0.7"}</priority></url>`
        ).join("");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});
