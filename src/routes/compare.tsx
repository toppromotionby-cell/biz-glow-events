import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { GitCompare, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StorageImg } from "@/components/StorageMedia";
import { useCompare, removeFromCompare, clearCompare, COMPARE_LIMIT } from "@/lib/compare";
import { getCatalogItem, type CatalogType, type CatalogRow } from "@/lib/catalog.functions";
import { CATALOG_SLUG_ROUTE } from "@/lib/catalog-routes";
import { minPriceFromPricing, unitFromPricing } from "@/lib/pricing";
import { addToCart } from "@/lib/cart";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Сравнение позиций — event-hub.by" },
      { name: "description", content: "Сравните до 4 позиций каталога event-hub.by: цена, единица измерения, состав, характеристики — и добавьте выбранное в заявку." },
      { property: "og:title", content: "Сравнение позиций каталога" },
      { property: "og:description", content: "Сравнение зон, оборудования, услуг, продакшна и аттракционов по цене и характеристикам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

const TYPE_LABEL: Record<CatalogType, string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

function featureList(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return (features as unknown[])
    .map((f) => {
      if (typeof f === "string") return f;
      if (f && typeof f === "object") {
        const o = f as Record<string, unknown>;
        const name = String(o.name ?? o.title ?? o.label ?? "").trim();
        const value = String(o.value ?? o.text ?? "").trim();
        return [name, value].filter(Boolean).join(": ");
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

function money(n: number | null) {
  return n == null ? "по запросу" : `от ${n.toLocaleString("ru-BY")} BYN`;
}

function ComparePage() {
  const { items, count } = useCompare();

  const results = useQueries({
    queries: items.map((it) => ({
      queryKey: ["catalog", it.entity_type, it.slug],
      queryFn: () => getCatalogItem({ data: { type: it.entity_type, slug: it.slug } }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const rows = items.map((it, i) => ({ meta: it, data: results[i]?.data as CatalogRow | undefined }));

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Сравнение позиций</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          До {COMPARE_LIMIT} позиций рядом: цена, единица, характеристики и состав. Добавляйте позиции кнопкой «Сравнить» в каталоге.
        </p>
      </header>

      {count === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <GitCompare className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <p className="mt-3 text-muted-foreground">Список сравнения пуст.</p>
          <Link to="/catalog" className="mt-4 inline-block text-primary hover:underline">Перейти в каталог</Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => clearCompare()}>
              <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" /> Очистить
            </Button>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid gap-4 min-w-[36rem]"
              style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(15rem, 1fr))` }}
            >
              {rows.map(({ meta, data }) => {
                const price = data ? minPriceFromPricing(data.pricing) : meta.priceFrom ?? null;
                const unit = data ? unitFromPricing(data.pricing) : null;
                const photo = data?.photo_urls?.[0] ?? meta.image ?? null;
                return (
                  <article key={`${meta.entity_type}-${meta.slug}`} className="glass rounded-2xl overflow-hidden flex h-full flex-col">
                    <div className="relative aspect-[4/3] bg-muted/30">
                      {photo ? (
                        <StorageImg path={photo} alt={meta.title} className="absolute inset-0 h-full w-full object-cover" />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeFromCompare(meta.slug, meta.entity_type)}
                        aria-label={`Убрать из сравнения: ${meta.title}`}
                        className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:text-foreground transition"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{TYPE_LABEL[meta.entity_type]}</span>
                        <h2 className="font-display font-bold text-lg leading-tight">{meta.title}</h2>
                      </div>

                      <dl className="text-sm space-y-1.5">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Цена</dt>
                          <dd className="font-semibold">{money(price)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Единица</dt>
                          <dd>{unit ?? "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Категория</dt>
                          <dd className="text-right">{data?.category ?? "—"}</dd>
                        </div>
                      </dl>

                      <p className="text-xs text-muted-foreground line-clamp-4">{data?.short_description ?? ""}</p>

                      {featureList(data?.features).length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          {featureList(data?.features).map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      )}

                      <div className="mt-auto pt-2 space-y-2">
                        <Button
                          size="sm"
                          className="w-full bg-gradient-primary"
                          onClick={() => {
                            const res = addToCart({
                              id: data?.id ?? meta.id ?? meta.slug,
                              entity_type: meta.entity_type,
                              slug: meta.slug,
                              title: meta.title,
                              price: price ?? 0,
                              qty: 1,
                              unit,
                              image: photo,
                            });
                            toast[res.added ? "success" : "info"](res.added ? "Добавлено в заявку" : "Уже в заявке");
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" aria-hidden="true" /> В заявку
                        </Button>
                        <Link
                          to={CATALOG_SLUG_ROUTE[meta.entity_type]}
                          params={{ slug: meta.slug }}
                          className="block text-center text-xs text-primary hover:underline"
                        >
                          Подробная страница
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
