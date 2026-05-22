import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { ZONES } from "@/lib/catalog-mock";

export const Route = createFileRoute("/zones")({
  head: () => ({
    meta: [
      { title: "Интерактивные зоны для мероприятий — event-hub.by" },
      { name: "description", content: "VR/AR, фотозоны 360°, AR-зеркала, неоновые лаунж-зоны. Аренда в Минске и по Беларуси." },
      { property: "og:title", content: "Интерактивные зоны — event-hub.by" },
      { property: "og:description", content: "Каталог интерактивных зон для event-мероприятий." },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        name: "Интерактивные зоны",
        itemListElement: ZONES.map((z, i) => ({
          "@type": "Offer", position: i + 1, name: z.title,
          priceSpecification: { "@type": "PriceSpecification", price: z.priceFrom, priceCurrency: "BYN", minPrice: z.priceFrom },
        })),
      }),
    }],
  }),
  component: () => (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Интерактивные зоны</h1>
        <p className="mt-4 text-muted-foreground">VR-арены, фотозоны 360°, AR-зеркала и тематические лаунжи под ключ.</p>
      </header>
      <CatalogGrid items={ZONES} category="zones" basePath="/zones" />
    </div>
  ),
});
