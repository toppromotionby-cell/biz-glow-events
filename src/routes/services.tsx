import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { SERVICES } from "@/lib/catalog-mock";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Event-услуги в Беларуси — event-hub.by" },
      { name: "description", content: "Продакшн под ключ, BTL, онлайн-трансляции, букинг артистов." },
      { property: "og:title", content: "Услуги — event-hub.by" },
      { property: "og:description", content: "Комплексные event-услуги от event-hub.by." },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "OfferCatalog", name: "Услуги",
        itemListElement: SERVICES.map((z, i) => ({
          "@type": "Offer", position: i + 1, name: z.title,
          priceSpecification: { "@type": "PriceSpecification", price: z.priceFrom, priceCurrency: "BYN", minPrice: z.priceFrom },
        })),
      }),
    }],
  }),
  component: () => (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Услуги</h1>
        <p className="mt-4 text-muted-foreground">От креатива и продакшна до промо и трансляций.</p>
      </header>
      <CatalogGrid items={SERVICES} category="services" basePath="/services" />
    </div>
  ),
});
