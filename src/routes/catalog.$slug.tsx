// Витрина «своего» раздела каталога: /catalog/<slug>.
// Собирает опубликованные позиции из выбранных направлений разных разделов.
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getVirtualSection } from "@/lib/catalog-nav.functions";
import { rowsToItems } from "@/lib/catalog-adapter";
import { CatalogGrid } from "@/components/CatalogGrid";
import { CATALOG_PAGE_CONFIG, type CatalogBasePath } from "@/lib/catalog-page-config";
import type { CatalogRow } from "@/lib/catalog.functions";

type Group = { type: string; basePath: string; categories: string[]; rows: CatalogRow[] };

export const Route = createFileRoute("/catalog/$slug")({
  loader: async ({ params }) => {
    const data = await getVirtualSection({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ? `${loaderData.title} — event-hub.by` : "Раздел каталога — event-hub.by";
    const description =
      loaderData?.description ||
      "Подборка оборудования, зон и услуг event-hub.by для вашего мероприятия в Беларуси.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VirtualSectionPage,
  errorComponent: () => (
    <div className="page-shell section-y" role="alert">
      <h1 className="text-3xl font-display font-bold">Раздел временно недоступен</h1>
      <p className="mt-3 text-muted-foreground">Обновите страницу — мы уже чиним.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="page-shell section-y">
      <h1 className="text-3xl font-display font-bold">Раздел не найден</h1>
      <p className="mt-3 text-muted-foreground">Возможно, он был удалён или пока пуст.</p>
    </div>
  ),
});

function VirtualSectionPage() {
  const data = Route.useLoaderData() as { title: string; description: string; groups: Group[] };

  return (
    <div className="page-shell section-y">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">{data.title}</h1>
        {data.description && <p className="mt-4 text-muted-foreground">{data.description}</p>}
      </header>

      {data.groups.length === 0 && (
        <p className="text-muted-foreground">В этом разделе пока нет позиций.</p>
      )}

      <div className="space-y-14">
        {data.groups.map((group) => {
          const config = CATALOG_PAGE_CONFIG[group.basePath as CatalogBasePath];
          return (
            <section key={group.type}>
              <h2 className="text-2xl font-display font-semibold mb-6">{config.h1}</h2>
              <CatalogGrid
                items={rowsToItems(group.rows)}
                category={config.category}
                basePath={config.basePath}
                entityType={config.type}
                categories={group.categories.map((name: string) => ({ id: name, name }))}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
