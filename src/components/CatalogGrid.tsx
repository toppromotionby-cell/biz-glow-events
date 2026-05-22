import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import type { CatalogItem } from "@/lib/catalog-mock";

export function CatalogGrid({ items, category }: { items: CatalogItem[]; category: string }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((it) => (
        <article key={it.slug} className="glass rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col">
          <MediaShield>
            <div className="aspect-[4/3] overflow-hidden bg-surface">
              <img
                src={it.image}
                alt={it.title}
                loading="lazy"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-700"
              />
            </div>
          </MediaShield>
          <div className="p-5 flex-1 flex flex-col">
            <h3 className="font-display font-semibold text-lg">{it.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 flex-1">{it.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {it.tags.map((t) => (
                <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full glass border border-primary/20 text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <PriceGate price={it.priceFrom} currency="BYN" name={it.title} category={category} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
