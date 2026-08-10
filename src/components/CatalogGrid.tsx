import { useEffect, useMemo, useRef, useState } from "react";
import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import { CatalogQuickView } from "@/components/CatalogQuickView";
import { CompareButton } from "@/components/CompareButton";

import { PaginationControls, type PerPage, PER_PAGE_OPTIONS } from "@/components/ui/PaginationControls";
import { useResolvedUrl } from "@/components/StorageMedia";
import { useClampedText } from "@/components/ui/ClampedTitle";

import type { CatalogItem } from "@/lib/catalog-mock";
import type { CatalogType } from "@/lib/catalog.functions";
import { Info, X, ShoppingCart, ArrowUpDown } from "lucide-react";

type SortKey = "default" | "price-asc" | "price-desc" | "title-asc";

const SORT_LABELS: Record<SortKey, string> = {
  default: "По умолчанию",
  "price-asc": "Сначала дешевле",
  "price-desc": "Сначала дороже",
  "title-asc": "По названию (А–Я)",
};

export function CatalogGrid({
  items,
  category,
  basePath,
  entityType,
  categories,
}: {
  items: CatalogItem[];
  category: string;
  basePath: string;
  entityType: CatalogType;
  /** Категории из админки (таблица catalog_categories) — единый источник истины. */
  categories?: { id: string; name: string }[];
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(30);
  const [sort, setSort] = useState<SortKey>("default");

  // Категории фильтра берём из админского справочника, но показываем
  // только те, по которым реально есть опубликованные позиции.
  const usedCategoryNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category.trim().toLowerCase());
    });
    return set;
  }, [items]);

  const categoryChips = useMemo(() => {
    const source = categories ?? [];
    // Сохраняем порядок из админки и оставляем только используемые.
    const fromAdmin = source
      .map((c) => c.name)
      .filter((name) => usedCategoryNames.has(name.trim().toLowerCase()));
    // Если у позиции есть категория, которой ещё нет в справочнике, всё равно
    // покажем её — чтобы публичный каталог не «прятал» элементы.
    const orphans: string[] = [];
    const known = new Set(fromAdmin.map((n) => n.trim().toLowerCase()));
    items.forEach((it) => {
      const key = it.category?.trim().toLowerCase();
      if (it.category && key && !known.has(key) && !orphans.includes(it.category)) {
        orphans.push(it.category);
      }
    });
    return [...fromAdmin, ...orphans];
  }, [categories, usedCategoryNames, items]);

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
    const cat = params.get("category");
    if (cat) setActiveCategory(cat);
    const pg = Number(params.get("page"));
    if (pg > 0) setPage(pg);
    const pp = Number(params.get("per"));
    if ((PER_PAGE_OPTIONS as readonly number[]).includes(pp)) setPerPage(pp as PerPage);
  }, []);

  // Sync to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (activeTags.length) params.set("tags", activeTags.join(",")); else params.delete("tags");
    if (activeCategory) params.set("category", activeCategory); else params.delete("category");
    if (page > 1) params.set("page", String(page)); else params.delete("page");
    if (perPage !== 30) params.set("per", String(perPage)); else params.delete("per");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [activeTags, activeCategory, page, perPage]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [activeTags, activeCategory, perPage, sort]);

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    let result = items;
    if (activeCategory) {
      const key = activeCategory.trim().toLowerCase();
      result = result.filter((it) => (it.category ?? "").trim().toLowerCase() === key);
    }
    if (activeTags.length) {
      result = result.filter((it) => activeTags.every((t) => it.tags?.includes(t)));
    }
    if (sort !== "default") {
      // Позиции «по запросу» (цена 0) всегда в конце при сортировке по цене.
      const byPrice = (dir: 1 | -1) => (a: CatalogItem, b: CatalogItem) => {
        const pa = a.priceFrom || 0;
        const pb = b.priceFrom || 0;
        if (!pa !== !pb) return pa ? -1 : 1;
        return (pa - pb) * dir;
      };
      result = [...result].sort(
        sort === "title-asc"
          ? (a, b) => a.title.localeCompare(b.title, "ru")
          : byPrice(sort === "price-asc" ? 1 : -1),
      );
    }
    return result;
  }, [items, activeTags, activeCategory, sort]);


  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filtered, currentPage, perPage],
  );

  const handlePage = (p: number) => {
    setPage(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {categoryChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 min-h-[2.25rem]">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            aria-pressed={!activeCategory}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              !activeCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "glass border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            Все категории
          </button>
          {categoryChips.map((name) => {
            const active = !!activeCategory && activeCategory.trim().toLowerCase() === name.trim().toLowerCase();
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActiveCategory(active ? null : name)}
                aria-pressed={active}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "glass border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Найдено позиций: <span className="font-semibold text-foreground">{filtered.length}</span>
        </p>
        <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Сортировка</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="glass rounded-md border border-primary/20 bg-transparent px-2 py-1.5 text-xs sm:text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k} className="bg-background text-foreground">
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
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
        <>
          <div className="grid-cards">
            {paged.map((it) => (
              <CatalogCard
                key={it.slug}
                item={it}
                category={category}
                activeTags={activeTags}
                
                onOpen={() => setOpenSlug(it.slug)}
                onToggleTag={toggleTag}
              />
            ))}
          </div>
          <PaginationControls
            total={filtered.length}
            page={currentPage}
            perPage={perPage}
            onPageChange={handlePage}
            onPerPageChange={setPerPage}
          />
        </>
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

function SlidePhoto({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  const url = useResolvedUrl(src);
  if (!url) {
    return (
      <div
        aria-hidden={!active}
        className={`absolute inset-0 h-full w-full bg-muted/30 transition-opacity duration-500 ${active ? "opacity-100" : "opacity-0"}`}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      aria-hidden={!active}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0"
      } group-hover:scale-105 transition-transform [transition-duration:700ms]`}
    />
  );
}

function CatalogCard({
  item,
  category,
  activeTags,
  onOpen,
  onToggleTag,
}: {
  item: CatalogItem;
  category: string;
  activeTags: string[];
  onOpen: () => void;
  onToggleTag: (t: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photos = (item.images && item.images.length > 0 ? item.images : [item.image]).filter(Boolean);
  const hasMultiple = photos.length > 1;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  // Автоскролл каждые 5 секунд, пауза при наведении
  useEffect(() => {
    if (!hasMultiple || hovered) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasMultiple, hovered, photos.length]);

  const handleEnter = () => {
    setHovered(true);
    const el = videoRef.current;
    if (el) el.play().catch(() => {});
  };
  const handleLeave = () => {
    setHovered(false);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  };




  const titleRef = useRef<HTMLButtonElement>(null);
  const clamped = useClampedText(titleRef, item.title, 2);

  return (
    <article
      className="glass rounded-xl sm:rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col [contain:layout_style]"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть ${item.title}`}
        className="block text-left"
      >
        <MediaShield>
          <div className="aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-surface relative">
            {photos.map((src, i) => (
              <SlidePhoto
                key={src + i}
                src={src}
                alt={item.title}
                active={i === index}
              />
            ))}
            {item.video ? (
              <>
                <video
                  ref={videoRef}
                  src={item.video}
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                />
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur opacity-90 group-hover:opacity-0 transition">
                  ▶ Video
                </span>
              </>
            ) : null}

          </div>
        </MediaShield>
      </button>
      <div className="p-3.5 sm:p-4 lg:p-5 flex-1 flex flex-col">
        <h3 className="font-display font-bold text-lg sm:text-xl leading-tight tracking-tight">
          <button
            ref={titleRef}
            type="button"
            onClick={onOpen}
            title={item.title}
            aria-label={`Открыть: ${item.title}`}
            className="card-title-gradient"
          >
            {clamped}
          </button>
        </h3>
        <span className="card-title-accent mt-2" aria-hidden />
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 flex-1 line-clamp-2 sm:line-clamp-3 min-h-[2.5rem] sm:min-h-[3.9rem]">{item.description}</p>
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2 sm:mt-3">
          {item.tags.slice(0, 3).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onToggleTag(t)}
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
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40" data-category={category}>
          <PriceGate>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[11px] sm:text-xs text-muted-foreground">от</span>
              <span className="text-xl sm:text-2xl font-display font-bold gradient-text">{item.priceFrom.toLocaleString("ru-BY")}</span>
              <span className="text-xs sm:text-sm text-muted-foreground">BYN</span>
            </div>
          </PriceGate>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              aria-label={`Подробнее: ${item.title}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              Подробнее
            </button>
          </div>



        </div>
      </div>
    </article>
  );
}

