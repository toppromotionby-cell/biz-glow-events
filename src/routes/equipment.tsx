import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { EQUIPMENT } from "@/lib/catalog-mock";

export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Аренда event-оборудования в Минске — event-hub.by" },
      { name: "description", content: "LED-экраны, звук, свет, проекционный маппинг. Аренда и монтаж под мероприятие." },
      { property: "og:title", content: "Оборудование — event-hub.by" },
      { property: "og:description", content: "Профессиональное event-оборудование в аренду." },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "OfferCatalog", name: "Оборудование",
        itemListElement: EQUIPMENT.map((z, i) => ({
          "@type": "Offer", position: i + 1, name: z.title,
          priceSpecification: { "@type": "PriceSpecification", price: z.priceFrom, priceCurrency: "BYN", minPrice: z.priceFrom },
        })),
      }),
    }],
  }),
  component: () => (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Оборудование</h1>
        <p className="mt-4 text-muted-foreground">Звук, свет, видео и маппинг — комплекты под формат вашего мероприятия.</p>
      </header>
      <CatalogGrid items={EQUIPMENT} category="equipment" basePath="/equipment" />
    </div>
  ),
});
