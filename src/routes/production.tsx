import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid } from "@/components/CatalogGrid";
import { PRODUCTION } from "@/lib/catalog-mock";

export const Route = createFileRoute("/production")({
  head: () => ({
    meta: [
      { title: "Производство декораций и конструкций — event-hub.by" },
      { name: "description", content: "Фотостены, арки, сцены, реквизит, печать. Производство под ключ в Минске." },
      { property: "og:title", content: "Производство — event-hub.by" },
      { property: "og:description", content: "Event-производство: декор, конструкции, печать." },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "OfferCatalog", name: "Производство",
        itemListElement: PRODUCTION.map((z, i) => ({
          "@type": "Offer", position: i + 1, name: z.title,
          priceSpecification: { "@type": "PriceSpecification", price: z.priceFrom, priceCurrency: "BYN", minPrice: z.priceFrom },
        })),
      }),
    }],
  }),
  component: () => (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Производство</h1>
        <p className="mt-4 text-muted-foreground">Декорации, фотозоны, сцены и печать. От эскиза до монтажа на площадке.</p>
      </header>
      <CatalogGrid items={PRODUCTION} category="production" />
    </div>
  ),
});
