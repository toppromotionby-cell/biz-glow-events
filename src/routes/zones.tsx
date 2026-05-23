import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { ZONES } from "@/lib/catalog-mock";
import { listCatalog } from "@/lib/catalog.functions";
import { rowsToItems } from "@/lib/catalog-adapter";
import { itemListJsonLd } from "@/lib/seo-jsonld";

export const Route = createFileRoute("/zones")({
  loader: async () => {
    try {
      const rows = await listCatalog({ data: { type: "zones" } });
      const items = rowsToItems(rows);
      return { items: items.length ? items : ZONES };
    } catch {
      return { items: ZONES };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "Интерактивные зоны для мероприятий — event-hub.by" },
      { name: "description", content: "VR/AR, фотозоны 360°, AR-зеркала, неоновые лаунж-зоны. Аренда в Минске и по Беларуси." },
      { property: "og:title", content: "Интерактивные зоны — event-hub.by" },
      { property: "og:description", content: "Каталог интерактивных зон для event-мероприятий." },
    ],
    scripts: loaderData?.items?.length
      ? [{
          type: "application/ld+json",
          children: itemListJsonLd({
            basePath: "/zones",
            pageUrl: "https://event-hub.by/zones",
            name: "Интерактивные зоны для мероприятий в Минске",
            items: loaderData.items as { title?: string; slug?: string }[],
          }),
        }]
      : [],
  }),
  component: ZonesPage,
});

function ZonesPage() {
  const { items } = Route.useLoaderData();
  const titles = items.map((i: { title: string }) => i.title).filter(Boolean);
  const subtitle = titles.length
    ? titles[Math.floor(Math.random() * titles.length)]
    : "VR-арены, фотозоны 360°, AR-зеркала и тематические лаунжи под ключ.";
  return (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Интерактивные Зоны</h1>
        <p className="mt-4 text-muted-foreground">{subtitle}</p>
      </header>
      <CatalogGrid items={items} category="zones" basePath="/zones" entityType="zones" />
    </div>
  );
}
