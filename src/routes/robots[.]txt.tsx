import { createFileRoute } from "@tanstack/react-router";

// Блокируем индексацию приватных и служебных страниц.
// Публичный каталог, блог, кейсы, услуги — остаются открытыми.
const BODY = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /profile",
  "Disallow: /cart",
  "Disallow: /wishlist",
  
  "Disallow: /login",
  "Disallow: /register",
  "Disallow: /reset-password",
  "Disallow: /lovable",
  "",
  "Sitemap: https://event-hub.by/sitemap-index.xml",
  "Sitemap: https://event-hub.by/sitemap.xml",
  "",
].join("\n");

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(BODY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
