import { createFileRoute, Link } from "@tanstack/react-router";
import { useCompare, removeFromCompare, clearCompare } from "@/lib/compare";
import { Button } from "@/components/ui/button";
import { Scale, X, Trash2 } from "lucide-react";
import { CATALOG_SLUG_ROUTE } from "@/lib/catalog-routes";
import type { CatalogType } from "@/lib/catalog.functions";

const KIND_LABELS: Record<string, string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Производство",
};

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Сравнение — event-hub.by" },
      { name: "description", content: "Сравните характеристики и цены позиций каталога event-hub.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { items } = useCompare();
  const type = items[0]?.entity_type;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <header className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Сравнение</h1>
          {type && <p className="mt-2 text-sm text-muted-foreground">{KIND_LABELS[type]} · {items.length} позиций</p>}
        </div>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => clearCompare()}>
            <Trash2 className="h-4 w-4 mr-2" />Очистить
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Список сравнения пуст. Добавляйте позиции из каталога.</p>
          <Link to="/zones"><Button className="bg-gradient-primary glow-primary">Перейти в каталог</Button></Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-4 min-w-fit" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(220px, 1fr))` }}>
            {items.map(it => (
              <article key={`${it.entity_type}-${it.id}`} className="glass rounded-2xl overflow-hidden">
                <div className="relative aspect-[4/3] bg-surface">
                  {it.image && <img src={it.image} alt={it.title} className="h-full w-full object-cover" loading="lazy" />}
                  <button
                    onClick={() => removeFromCompare(it.id, it.entity_type)}
                    aria-label="Убрать"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <Link
                    to={`${KIND_PATHS[it.entity_type]}/${it.slug}`}
                    className="font-display font-semibold hover:text-primary transition line-clamp-2"
                  >
                    {it.title}
                  </Link>
                  <dl className="text-sm space-y-2 border-t border-border/40 pt-3">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Цена от</dt>
                      <dd className="font-medium">{it.price > 0 ? `${it.price.toLocaleString("ru-BY")} BYN` : "по запросу"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Раздел</dt>
                      <dd className="text-xs">{KIND_LABELS[it.entity_type]}</dd>
                    </div>
                  </dl>
                  <Link to={`${KIND_PATHS[it.entity_type]}/${it.slug}`} className="block">
                    <Button size="sm" variant="outline" className="w-full">Подробнее</Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
