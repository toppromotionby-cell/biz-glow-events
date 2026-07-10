// Фабрика опций маршрутов каталога: единый loader/head/component для 4 типов.
// Используется в src/routes/{zones,equipment,services,production}.tsx.
import { getRouteApi } from "@tanstack/react-router";
import { listCatalog, listCatalogCategories } from "@/lib/catalog.functions";
import { rowsToItems } from "@/lib/catalog-adapter";
import { itemListJsonLd } from "@/lib/seo-jsonld";
import { CatalogListPage } from "@/components/catalog/CatalogListPage";
import { CATALOG_PAGE_CONFIG, type CatalogBasePath } from "@/lib/catalog-page-config";

/**
 * Возвращает options для `createFileRoute(basePath)(...)`.
 * Полностью покрывает list-страницу одного типа каталога.
 */
export function catalogListRouteOptions(basePath: CatalogBasePath) {
  const config = CATALOG_PAGE_CONFIG[basePath];
  // getRouteApi даёт типизированный useLoaderData без импорта Route в компоненте.
  const routeApi = getRouteApi(basePath);

  return {
    loader: async () => {
      try {
        const [rows, categories] = await Promise.all([
          listCatalog({ data: { type: config.type } }),
          listCatalogCategories({ data: { type: config.type } }),
        ]);
        const items = rowsToItems(rows);
        return { items: items.length ? items : config.fallback, categories };
      } catch {
        return { items: config.fallback, categories: [] as { id: string; name: string }[] };
      }
    },
    head: ({ loaderData }: { loaderData?: { items?: { title?: string; slug?: string }[] } }) => ({
      meta: [
        { title: config.list.title },
        { name: "description", content: config.list.description },
        { property: "og:title", content: config.list.ogTitle },
        { property: "og:description", content: config.list.ogDescription },
        { property: "og:url", content: config.pageUrl },
      ],
      // Canonical на чистый URL каталога — обрезаем дубли по ?filter/?sort/?page/?utm_*.
      links: [{ rel: "canonical", href: config.pageUrl }],
      scripts: loaderData?.items?.length
        ? [{
            type: "application/ld+json",
            children: itemListJsonLd({
              basePath: config.basePath,
              pageUrl: config.pageUrl,
              name: config.collectionName,
              items: loaderData.items as { title?: string; slug?: string }[],
            }),
          }]
        : [],
    }),

    component: function CatalogListRoutePage() {
      const { items, categories } = routeApi.useLoaderData();
      return <CatalogListPage config={config} items={items} categories={categories} />;
    },
  } as const;
}
