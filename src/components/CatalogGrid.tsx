import { useState } from "react";
import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import { CatalogQuickView } from "@/components/CatalogQuickView";
import type { CatalogItem } from "@/lib/catalog-mock";
import type { CatalogType } from "@/lib/catalog.functions";

export function CatalogGrid({
  items,
  category,
  basePath,
  entityType,
}: {
  items: CatalogItem[];
  category: string;
  basePath: string;
  entityType: CatalogType;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((it) => (
          <article key={it.slug} className="glass rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col">
            <button
              type="button"
              onClick={() => setOpenSlug(it.slug)}
              aria-label={`Открыть ${it.title}`}
              className="block text-left"
            >
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
            </button>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-display font-semibold text-lg">
                <button
                  type="button"
                  onClick={() => setOpenSlug(it.slug)}
                  className="hover:text-primary transition text-left"
                >
                  {it.title}
                </button>
              </h3>
              <p className="text-sm text-muted-foreground mt-2 flex-1">{it.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {it.tags.map((t) => (
                  <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full glass border border-primary/20 text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/40" data-category={category}>
                <PriceGate>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-muted-foreground">от</span>
                    <span className="text-2xl font-display font-bold gradient-text">{it.priceFrom.toLocaleString("ru-BY")}</span>
                    <span className="text-sm text-muted-foreground">BYN</span>
                  </div>
                </PriceGate>
              </div>
            </div>
          </article>
        ))}
      </div>

      {openSlug && (
        <CatalogQuickView
          open={!!openSlug}
          onOpenChange={(v) => { if (!v) setOpenSlug(null); }}
          type={entityType}
          slug={openSlug}
          basePath={basePath}
        />
      )}
    </>
  );
}
