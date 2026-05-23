import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCatalogItem, type CatalogType } from "@/lib/catalog.functions";
import { CatalogDetail, productJsonLd } from "@/components/CatalogDetail";

const TYPE: CatalogType = "services";
const BACK = { href: "/services", label: "Все услуги" } as const;

const itemQuery = (slug: string) => queryOptions({
  queryKey: ["catalog", TYPE, slug],
  queryFn: () => getCatalogItem({ data: { type: TYPE, slug } }),
});

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ params, context }) => {
    const item = await context.queryClient.ensureQueryData(itemQuery(params.slug));
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => {
    const it = loaderData?.item;
    if (!it) return { meta: [{ title: "Услуга — event-hub.by" }] };
    return {
      meta: [
        { title: it.seo_title ?? `${it.title} — заказать услугу в Минске | event-hub.by` },
        { name: "description", content: it.seo_description ?? it.short_description ?? `${it.title} — услуга для мероприятий в Минске. Профессиональная команда event-hub.by.` },
        { property: "og:title", content: it.title },
        { property: "og:description", content: it.short_description ?? "" },
        ...(it.photo_urls?.[0] ? [{ property: "og:image", content: it.photo_urls[0] }] : []),
      ],
      scripts: [{ type: "application/ld+json", children: productJsonLd(it, { basePath: "/services", baseLabel: "Услуги" }) }],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-display font-semibold">Услуга не найдена</h1>
      <Link to="/services" className="mt-4 inline-block text-primary underline">Вернуться к каталогу</Link>
    </div>
  ),
});

function Page() {
  const { slug } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(slug));
  if (!item) return null;
  return <CatalogDetail item={item} backHref={BACK.href} backLabel={BACK.label} entityType="services" />;
}
