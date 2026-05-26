// Карточка блока "Наши рекомендации".
// Полностью повторяет визуал и логику CatalogCard, но получает данные
// в формате HomeFeatured (с серверно подписанным URL первой фотки).
import { useEffect, useState } from "react";
import { PriceGate } from "@/components/PriceGate";
import { MediaShield } from "@/components/MediaShield";
import { useResolvedUrl } from "@/components/StorageMedia";
import { priceFrom as priceFromUtil } from "@/lib/utils";
import type { HomeFeatured } from "@/lib/home.functions";

function SlidePhoto({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  const url = useResolvedUrl(src);
  if (!url) {
    return (
      <div
        aria-hidden
        className={`absolute inset-0 h-full w-full bg-muted/30 animate-pulse transition-opacity duration-500 ${active ? "opacity-100" : "opacity-0"}`}
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

export function FeaturedCard({
  item,
  onOpen,
}: {
  item: HomeFeatured;
  onOpen: () => void;
}) {
  const photos = (item.photo_urls ?? []).filter(Boolean);
  const hasMultiple = photos.length > 1;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const price = priceFromUtil(item.pricing);

  useEffect(() => {
    if (!hasMultiple || hovered) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasMultiple, hovered, photos.length]);

  return (
    <article
      className="glass rounded-xl sm:rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть ${item.title}`}
        className="block text-left w-full"
      >
        <MediaShield>
          <div className="aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-surface relative">
            {photos.length > 0 ? (
              photos.map((src, i) => (
                <SlidePhoto key={src + i} src={src} alt={item.title} active={i === index} />
              ))
            ) : (
              <div className="absolute inset-0 h-full w-full bg-muted/30 animate-pulse" aria-hidden />
            )}
          </div>
        </MediaShield>
      </button>
      <div className="p-3.5 sm:p-4 lg:p-5 flex-1 flex flex-col min-w-0">
        <h3 className="font-display font-semibold text-base sm:text-lg leading-tight break-words">
          <button
            type="button"
            onClick={onOpen}
            className="hover:text-primary transition text-left line-clamp-2 w-full"
          >
            {item.title}
          </button>
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 flex-1 line-clamp-2 sm:line-clamp-3 break-words min-h-[2.25rem] sm:min-h-[3.75rem]">
          {item.short_description ?? "\u00A0"}
        </p>
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40">
          <PriceGate>
            {price !== null && price > 0 ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[11px] sm:text-xs text-muted-foreground">от</span>
                <span className="text-xl sm:text-2xl font-display font-bold gradient-text break-all">
                  {price.toLocaleString("ru-BY")}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground">BYN</span>
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-muted-foreground">Цена по запросу</div>
            )}
          </PriceGate>
        </div>
      </div>
    </article>
  );
}

export function FeaturedCardSkeleton() {
  return (
    <article className="glass rounded-xl sm:rounded-2xl overflow-hidden flex flex-col">
      <div className="aspect-[16/10] sm:aspect-[4/3] bg-muted/30 animate-pulse" />
      <div className="p-3.5 sm:p-4 lg:p-5 flex-1 flex flex-col gap-2">
        <div className="h-5 sm:h-6 w-3/4 rounded bg-muted/40 animate-pulse" />
        <div className="h-3 sm:h-4 w-full rounded bg-muted/30 animate-pulse" />
        <div className="h-3 sm:h-4 w-5/6 rounded bg-muted/30 animate-pulse" />
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40">
          <div className="h-6 sm:h-7 w-1/3 rounded bg-muted/40 animate-pulse" />
        </div>
      </div>
    </article>
  );
}
