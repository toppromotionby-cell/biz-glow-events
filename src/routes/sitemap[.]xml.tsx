import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://event-hub.by";

/**
 * Альтернативные локали. Сайт пока работает только на русском (рынок BY/RU),
 * EN-перевода нет — поэтому EN-альтернатив не указываем (фейковые hreflang
 * вредят SEO). Если появится EN — добавим { hreflang: "en", base: ... }.
 */
const HREFLANGS: Array<{ hreflang: string; base: string }> = [
  { hreflang: "ru", base: BASE },
  { hreflang: "ru-BY", base: BASE },
  { hreflang: "ru-RU", base: BASE },
  { hreflang: "x-default", base: BASE },
];

const STATIC: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/catalog", priority: "0.9", changefreq: "weekly" },
  { path: "/zones", priority: "0.9", changefreq: "weekly" },
  { path: "/equipment", priority: "0.9", changefreq: "weekly" },
  { path: "/services", priority: "0.9", changefreq: "weekly" },
  { path: "/production", priority: "0.9", changefreq: "weekly" },
  { path: "/blog", priority: "0.6", changefreq: "weekly" },
  { path: "/cases", priority: "0.8", changefreq: "monthly" },
  { path: "/testimonials", priority: "0.7", changefreq: "monthly" },
  { path: "/industries", priority: "0.7", changefreq: "monthly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/partners", priority: "0.7", changefreq: "monthly" },
  { path: "/contacts", priority: "0.7", changefreq: "monthly" },
  { path: "/faq", priority: "0.6", changefreq: "monthly" },
  { path: "/delivery", priority: "0.6", changefreq: "monthly" },
  { path: "/calculator", priority: "0.7", changefreq: "monthly" },
  { path: "/terms-rental", priority: "0.5", changefreq: "yearly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/offer", priority: "0.2", changefreq: "yearly" },
];

type Row = { slug: string; updated_at: string };

async function fetchSlugs(
  table: "zones" | "tech_equipment" | "services" | "production_items" | "blog_posts" | "cases",
): Promise<Row[]> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("slug, updated_at")
    .eq("published", true);
  return (data ?? []) as Row[];
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHreflangs(path: string): string {
  return HREFLANGS.map(
    (h) =>
      `<xhtml:link rel="alternate" hreflang="${h.hreflang}" href="${h.base}${escape(path)}"/>`,
  ).join("");
}

function renderUrl(opts: { path: string; lastmod?: string; changefreq?: string; priority?: string }): string {
  const lm = opts.lastmod
    ? `<lastmod>${new Date(opts.lastmod).toISOString().slice(0, 10)}</lastmod>`
    : "";
  const cf = opts.changefreq ? `<changefreq>${opts.changefreq}</changefreq>` : "";
  const pr = opts.priority ? `<priority>${opts.priority}</priority>` : "";
  return `<url><loc>${BASE}${escape(opts.path)}</loc>${lm}${cf}${pr}${renderHreflangs(opts.path)}</url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [zones, equipment, services, production, posts, cases] = await Promise.all([
            fetchSlugs("zones"),
            fetchSlugs("tech_equipment"),
            fetchSlugs("services"),
            fetchSlugs("production_items"),
            fetchSlugs("blog_posts"),
            fetchSlugs("cases"),
          ]);

          const dynamic: Array<{ path: string; lastmod?: string }> = [
            ...zones.map((r) => ({ path: `/zones/${r.slug}`, lastmod: r.updated_at })),
            ...equipment.map((r) => ({ path: `/equipment/${r.slug}`, lastmod: r.updated_at })),
            ...services.map((r) => ({ path: `/services/${r.slug}`, lastmod: r.updated_at })),
            ...production.map((r) => ({ path: `/production/${r.slug}`, lastmod: r.updated_at })),
            ...posts.map((r) => ({ path: `/blog/${r.slug}`, lastmod: r.updated_at })),
            ...cases.map((r) => ({ path: `/cases/${r.slug}`, lastmod: r.updated_at })),
          ];

          // Дедупликация по path: статические перебивают динамические дубли
          const seen = new Set<string>();
          const all: string[] = [];

          for (const u of STATIC) {
            if (seen.has(u.path)) continue;
            seen.add(u.path);
            all.push(renderUrl({ path: u.path, changefreq: u.changefreq, priority: u.priority }));
          }
          for (const u of dynamic) {
            if (!u.path || seen.has(u.path)) continue;
            seen.add(u.path);
            all.push(renderUrl({ path: u.path, lastmod: u.lastmod, changefreq: "weekly", priority: "0.8" }));
          }

          const xml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
            all.join("") +
            `</urlset>`;

          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch {
          const xml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
            STATIC.map((u) => renderUrl({ path: u.path, changefreq: u.changefreq, priority: u.priority })).join("") +
            `</urlset>`;
          return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
        }
      },
    },
  },
});
