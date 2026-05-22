import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { EQUIPMENT } from "@/lib/catalog-mock";
import { listCatalog } from "@/lib/catalog.functions";
import { rowsToItems } from "@/lib/catalog-adapter";

export const Route = createFileRoute("/equipment")({
  loader: async () => {
    try {
      const rows = await listCatalog({ data: { type: "tech_equipment" } });
      const items = rowsToItems(rows);
      return { items: items.length ? items : EQUIPMENT };
    } catch {
      return { items: EQUIPMENT };
    }
  },
  head: () => ({
    meta: [
      { title: "Аренда event-оборудования в Минске — event-hub.by" },
      { name: "description", content: "LED-экраны, звук, свет, проекционный маппинг. Аренда и монтаж под мероприятие." },
      { property: "og:title", content: "Оборудование — event-hub.by" },
      { property: "og:description", content: "Профессиональное event-оборудование в аренду." },
    ],
  }),
  component: EquipmentPage,
});

function EquipmentPage() {
  const { items } = Route.useLoaderData();
  return (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Техническое оснащение</h1>
        <p className="mt-4 text-muted-foreground">Звук, свет, видео и маппинг — комплекты под формат вашего мероприятия.</p>
      </header>
      <CatalogGrid items={items} category="equipment" basePath="/equipment" />
    </div>
  );
}
