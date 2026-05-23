import { useEffect, useMemo, useState } from "react";
import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import { CatalogQuickView } from "@/components/CatalogQuickView";
import type { CatalogItem } from "@/lib/catalog-mock";
import type { CatalogType } from "@/lib/catalog.functions";
import { X } from "lucide-react";

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
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Top tags by frequency (max 12)
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => it.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }, [items]);

  // Init from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tags");
    if (t) setActiveTags(t.split(",").filter(Boolean));
  }, []);

  // Sync to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (activeTags.length) params.set("tags", activeTags.join(","));
    else params.delete("tags");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [activeTags]);

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    if (!activeTags.length) return items;
    return items.filter((it) => activeTags.every((t) => it.tags?.includes(t)));
  }, [items, activeTags]);

  return (
    <>
      {topTags.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {topTags.map((t) => {
            const active = activeTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                aria-pressed={active}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "glass border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3 w-3" /> Сбросить
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          Ничего не найдено по выбранным тегам.{" "}
          <button onClick={() => setActiveTags([])} className="text-primary hover:underline">
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((it) => (
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
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border transition ${
                        activeTags.includes(t)
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "glass border-primary/20 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {t}
                    </button>
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
      )}

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
