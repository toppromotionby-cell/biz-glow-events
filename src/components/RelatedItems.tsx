import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listCatalog, type CatalogRow, type CatalogType } from "@/lib/catalog.functions";
import { CATALOG_SLUG_ROUTE, type CatalogSlugRoute } from "@/lib/catalog-routes";

const fmt = new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 });

function priceFrom(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== "object") return null;
  const p = pricing as Record<string, unknown>;
  const v = p.from ?? p.priceFrom ?? p.min ?? p.base;
  return typeof v === "number" ? v : null;
}

const listQuery = (type: CatalogType) => queryOptions({
  queryKey: ["catalog-list", type],
  queryFn: () => listCatalog({ data: { type } }),
  staleTime: 5 * 60 * 1000,
});

export function RelatedItems({ type, currentId, category }: {
  type: CatalogType;
  currentId: string;
  category?: string | null;
}) {
  const { data } = useSuspenseQuery(listQuery(type));
  const items = useMemo(() => {
    const others = data.filter(d => d.id !== currentId);
    const sameCat = category ? others.filter(d => d.category === category) : [];
    const rest = others.filter(d => !sameCat.includes(d));
    return [...sameCat, ...rest].slice(0, 4);
  }, [data, currentId, category]);

  if (items.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-display font-semibold mb-5">Похожие позиции</h2>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(i => <Card key={i.id} item={i} to={CATALOG_SLUG_ROUTE[type]} />)}
      </ul>
    </section>
  );
}

function Card({ item, to }: { item: CatalogRow; to: CatalogSlugRoute }) {
  const from = priceFrom(item.pricing);
  return (
    <li className="glass rounded-xl overflow-hidden hover:glow-primary transition group">
      <Link to={to} params={{ slug: item.slug }} className="block">
        <div className="aspect-[16/10] bg-surface overflow-hidden">
          {item.photo_urls?.[0] && (
            <img src={item.photo_urls[0]} alt={item.title} loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
          )}
        </div>
        <div className="p-4">
          <div className="font-medium line-clamp-2">{item.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {from !== null ? `от ${fmt.format(from)}` : "По запросу"}
          </div>
        </div>
      </Link>
    </li>
  );
}
