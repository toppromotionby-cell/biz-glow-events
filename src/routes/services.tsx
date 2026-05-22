import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { SERVICES } from "@/lib/catalog-mock";
import { listCatalog } from "@/lib/catalog.functions";
import { rowsToItems } from "@/lib/catalog-adapter";

export const Route = createFileRoute("/services")({
  loader: async () => {
    try {
      const rows = await listCatalog({ data: { type: "services" } });
      const items = rowsToItems(rows);
      return { items: items.length ? items : SERVICES };
    } catch {
      return { items: SERVICES };
    }
  },
  head: () => ({
    meta: [
      { title: "Event-услуги в Беларуси — event-hub.by" },
      { name: "description", content: "Продакшн под ключ, BTL, онлайн-трансляции, букинг артистов." },
      { property: "og:title", content: "Услуги — event-hub.by" },
      { property: "og:description", content: "Комплексные event-услуги от event-hub.by." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { items } = Route.useLoaderData();
  return (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Услуги</h1>
        <p className="mt-4 text-muted-foreground">От креатива и продакшна до промо и трансляций.</p>
      </header>
      <CatalogGrid items={items} category="services" basePath="/services" />
    </div>
  );
}
