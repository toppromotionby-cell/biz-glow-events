import { useEffect, useMemo, useRef, useState } from "react";
import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import { CatalogQuickView } from "@/components/CatalogQuickView";
import { PaginationControls, type PerPage, PER_PAGE_OPTIONS } from "@/components/ui/PaginationControls";
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
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(30);

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
    if (page > 1) params.set("page", String(page)); else params.delete("page");
    if (perPage !== 30) params.set("per", String(perPage)); else params.delete("per");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [activeTags, page, perPage]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [activeTags, perPage]);

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    if (!activeTags.length) return items;
    return items.filter((it) => activeTags.every((t) => it.tags?.includes(t)));
  }, [items, activeTags]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
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




  return (
    <article
      className="glass rounded-xl sm:rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col"
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
              <img
                key={src + i}
                src={src}
                alt={item.title}
                loading={i === 0 ? "lazy" : "lazy"}
                aria-hidden={i !== index}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                  i === index ? "opacity-100" : "opacity-0"
                } group-hover:scale-105 transition-transform [transition-duration:700ms]`}
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
        <h3 className="font-display font-semibold text-base sm:text-lg leading-tight">
          <button
            type="button"
            onClick={onOpen}
            className="hover:text-primary transition text-left line-clamp-2"
          >
            {item.title}
          </button>
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 flex-1 line-clamp-2 sm:line-clamp-3">{item.description}</p>
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
        </div>
      </div>
    </article>
  );
}

