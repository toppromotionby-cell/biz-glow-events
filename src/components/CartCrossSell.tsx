// Cross-sell в корзине: услуги/оборудование, которые часто берут вместе.
// Подбираем по типам, которых ещё нет в корзине, чтобы увеличить средний чек.
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCatalog, type CatalogRow, type CatalogType } from "@/lib/catalog.functions";
import { CATALOG_SLUG_ROUTE } from "@/lib/catalog-routes";
import { Plus } from "lucide-react";
import { StorageImg } from "@/components/StorageMedia";
import { unitFromPricing } from "@/lib/pricing";
import { addToCart, type CartEntityType } from "@/lib/cart";
import { trackAddToCart } from "@/lib/analytics";
import { toast } from "sonner";
import { formatBYN, priceFrom as priceFromUtil } from "@/lib/utils";

const LABEL: Record<CatalogType, string> = {
  zones: "Зона",
  tech_equipment: "Оборудование",
  services: "Услуга",
  production_items: "Производство",
  attractions: "Аттракцион",
};

const priceFrom = (p: unknown): number => priceFromUtil(p) ?? 0;

export function CartCrossSell({ presentTypes }: { presentTypes: CartEntityType[] }) {
  // Приоритет: что предложить — услуги, потом оборудование, потом производство, потом зоны
  const order: CatalogType[] = ["services", "tech_equipment", "production_items", "zones"];
  const target = order.find(t => !presentTypes.includes(t)) ?? "services";

  const { data } = useQuery({
    queryKey: ["catalog-list", target],
    queryFn: () => listCatalog({ data: { type: target } }),
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => (data ?? []).slice(0, 4), [data]);
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-display font-semibold mb-3">Часто берут вместе</h2>
      <p className="text-sm text-muted-foreground mb-4">Дополните заявку — менеджер всё посчитает в одном договоре.</p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(i => <Card key={i.id} item={i} type={target} />)}
      </ul>
    </section>
  );
}

function Card({ item, type }: { item: CatalogRow; type: CatalogType }) {
  const price = priceFrom(item.pricing);
  const add = (() => {
    addToCart({
      id: item.id,
      entity_type: type,
      slug: item.slug,
      title: item.title,
      price,
      qty: 1,
      unit: unitFromPricing(item.pricing),
      image: item.photo_urls?.[0] ?? null,
    });
    trackAddToCart({ item_id: item.id, item_name: item.title, item_category: type, price, quantity: 1 });
    toast.success(`${LABEL[type]} добавлено в корзину`);
  });
  return (
    <li className="glass rounded-xl overflow-hidden hover:glow-primary transition group flex flex-col">
      <Link to={CATALOG_SLUG_ROUTE[type]} params={{ slug: item.slug }} className="block">
        <div className="aspect-[16/10] bg-surface overflow-hidden">
          {item.photo_urls?.[0] && (
            <StorageImg path={item.photo_urls[0]} alt={item.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
              fallbackClassName="h-full w-full" />
          )}
        </div>
      </Link>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <Link to={CATALOG_SLUG_ROUTE[type]} params={{ slug: item.slug }} className="font-medium text-sm line-clamp-2 hover:text-primary transition">
          {item.title}
        </Link>
        <div className="text-xs text-muted-foreground">
          {price > 0 ? `от ${formatBYN(price)}` : "По запросу"}
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 transition"
        >
          <Plus className="h-3.5 w-3.5" /> В корзину
        </button>
      </div>
    </li>
  );
}
