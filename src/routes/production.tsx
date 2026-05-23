import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { PRODUCTION } from "@/lib/catalog-mock";
import { listCatalog } from "@/lib/catalog.functions";
import { rowsToItems } from "@/lib/catalog-adapter";
import { itemListJsonLd } from "@/lib/seo-jsonld";

export const Route = createFileRoute("/production")({
  loader: async () => {
    try {
      const rows = await listCatalog({ data: { type: "production_items" } });
      const items = rowsToItems(rows);
      return { items: items.length ? items : PRODUCTION };
    } catch {
      return { items: PRODUCTION };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "Производство декораций и конструкций — event-hub.by" },
      { name: "description", content: "Фотостены, арки, сцены, реквизит, печать. Производство под ключ в Минске." },
      { property: "og:title", content: "Производство — event-hub.by" },
      { property: "og:description", content: "Event-производство: декор, конструкции, печать." },
    ],
    scripts: loaderData?.items?.length
      ? [{
          type: "application/ld+json",
          children: itemListJsonLd({
            basePath: "/production",
            pageUrl: "https://event-hub.by/production",
            name: "Производство декораций и конструкций для мероприятий",
            items: loaderData.items as { title?: string; slug?: string }[],
          }),
        }]
      : [],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { items } = Route.useLoaderData();
  return (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Производство</h1>
        <p className="mt-4 text-muted-foreground">Декорации, фотозоны, сцены и печать. От эскиза до монтажа на площадке.</p>
      </header>
      <CatalogGrid items={items} category="production" basePath="/production" entityType="production_items" />
    </div>
  );
}
