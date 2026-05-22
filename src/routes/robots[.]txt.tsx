import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          `User-agent: *\nAllow: /\nDisallow: /profile\nDisallow: /admin\nSitemap: https://event-hub.by/sitemap.xml\n`,
          { headers: { "Content-Type": "text/plain" } }
        ),
    },
  },
});
