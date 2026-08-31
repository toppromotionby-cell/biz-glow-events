import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CatalogSectionCard, catalogNavQueryOptions, FALLBACK_NAV } from "@/components/catalog/CatalogNav";

export const Route = createFileRoute("/catalog/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catalogNavQueryOptions);
  },
  head: () => ({
    meta: [
      { title: "Каталог — event-hub.by" },
      { name: "description", content: "Каталог event-hub.by: интерактивные зоны, оборудование, услуги, производство и аттракционы для мероприятий в Беларуси." },
      { property: "og:title", content: "Каталог — event-hub.by" },
      { property: "og:description", content: "Все разделы и направления каталога event-hub.by." },
    ],
  }),
  component: CatalogPage,
  errorComponent: () => (
    <div className="page-shell section-y" role="alert">
      <h1 className="text-3xl font-display font-bold">Каталог временно недоступен</h1>
      <p className="mt-3 text-muted-foreground">Обновите страницу — мы уже чиним.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="page-shell section-y">Разделы каталога не найдены.</div>
  ),
});

function CatalogPage() {
  const { data } = useSuspenseQuery(catalogNavQueryOptions);
  const sections = data && data.length ? data : FALLBACK_NAV;

  return (
    <div className="page-shell section-y">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Каталог</h1>
        <p className="mt-4 text-muted-foreground">
          Выберите раздел или сразу перейдите к нужному направлению.
        </p>
      </header>
      <div className="grid-cards">
        {sections.map((section, i) => (
          <CatalogSectionCard key={section.key} section={section} index={i} />
        ))}
      </div>
    </div>
  );
}
