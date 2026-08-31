// Фабрика опций маршрутов карточки каталога.
// Используется в src/routes/{zones,equipment,services,production}.$slug.tsx.
import { Link, notFound, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCatalogItem } from "@/lib/catalog.functions";
import { CatalogDetail, productJsonLd } from "@/components/CatalogDetail";
import { CATALOG_PAGE_CONFIG, type CatalogBasePath } from "@/lib/catalog-page-config";

type CatalogSlugRouteId =
  | "/zones/$slug"
  | "/equipment/$slug"
  | "/services/$slug"
  | "/production/$slug";

/**
 * Возвращает options для `createFileRoute("/<base>/$slug")(...)`.
 * Покрывает loader (с кэшем queryClient) + head (SEO) + компонент карточки.
 */
export function catalogSlugRouteOptions(basePath: CatalogBasePath) {
  const config = CATALOG_PAGE_CONFIG[basePath];
  const routeId = `${basePath}/$slug` as CatalogSlugRouteId;
  const routeApi = getRouteApi(routeId);

  const itemQuery = (slug: string) =>
    queryOptions({
      queryKey: ["catalog", config.type, slug],
      queryFn: () => getCatalogItem({ data: { type: config.type, slug } }),
    });

  return {
    loader: async ({
      params,
      context,
    }: {
      params: { slug: string };
      context: { queryClient: import("@tanstack/react-query").QueryClient };
    }) => {
      const item = await context.queryClient.ensureQueryData(itemQuery(params.slug));
      if (!item) throw notFound();
      return { item };
    },

    head: ({
      loaderData,
      params,
    }: {
      loaderData?: { item: Parameters<typeof productJsonLd>[0] };
      params: { slug: string };
    }) => {
      const it = loaderData?.item;
      if (!it) return { meta: [{ title: config.detail.fallbackTitle }] };
      const url = `${config.pageUrl}/${params.slug}`;
      return {
        meta: [
          { title: config.detail.buildTitle(it) },
          { name: "description", content: config.detail.buildDescription(it) },
          { property: "og:title", content: it.title },
          { property: "og:description", content: config.detail.buildDescription(it) },
          { property: "og:url", content: url },
          { property: "og:type", content: "product" },
          ...(it.photo_urls?.[0]
            ? [{ property: "og:image", content: it.photo_urls[0] }]
            : []),
        ],
        links: [{ rel: "canonical", href: url }],
        scripts: [{
          type: "application/ld+json",
          children: productJsonLd(it, { basePath: config.basePath, baseLabel: config.detail.jsonLdLabel }),
        }],
      };
    },
    component: function CatalogSlugRoutePage() {
      const { slug } = routeApi.useParams();
      const { data: item } = useSuspenseQuery(itemQuery(slug));
      if (!item) return null;
      return (
        <CatalogDetail
          item={item}
          backHref={config.basePath}
          backLabel={config.backLabel}
          entityType={config.type}
        />
      );
    },
    notFoundComponent: () => (
      <div className="page-shell section-y text-center">
        <h1 className="text-2xl font-display font-semibold">{config.detail.notFoundTitle}</h1>
        <Link to={config.basePath} className="mt-4 inline-block text-primary underline">
          Вернуться к каталогу
        </Link>
      </div>
    ),
  } as const;
}
