// Карточка блока "Наши рекомендации".
// Полностью повторяет визуал и логику CatalogCard, но получает данные
// в формате HomeFeatured (с серверно подписанным URL первой фотки).
// Особенности:
//  - на мобильных управление слайдером через свайп/тап, а не hover;
//  - autoplay ставится на паузу при касании;
//  - skeleton удерживает геометрию, пока подписываются URL из Storage;
//  - цена публичная, как в каталоге (без PriceGate).
import { useEffect, useRef, useState } from "react";
import { MediaShield } from "@/components/MediaShield";
import { useResolvedUrl } from "@/components/StorageMedia";
import { priceFrom as priceFromUtil } from "@/lib/utils";
import type { HomeFeatured } from "@/lib/home.functions";


function SlidePhoto({
  src, alt, active, onLoaded,
}: { src: string; alt: string; active: boolean; onLoaded?: () => void }) {
  const url = useResolvedUrl(src);
  useEffect(() => { if (url && onLoaded) onLoaded(); }, [url, onLoaded]);
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
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${active ? "opacity-100" : "opacity-0"} group-hover:scale-105 transition-transform [transition-duration:700ms]`}
    />
  );
}

function PriceBlock({ price }: { price: number | null }) {
  if (price === null || price <= 0) {
    return (
      <div className="text-xs sm:text-sm text-muted-foreground" data-nosnippet>
        Цена по запросу
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap" data-nosnippet>
      <span className="text-[11px] sm:text-xs text-muted-foreground">от</span>
      <span className="text-lg sm:text-xl lg:text-2xl font-display font-bold gradient-text break-all">
        {price.toLocaleString("ru-BY")}
      </span>
      <span className="text-xs sm:text-sm text-muted-foreground">BYN</span>
    </div>
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
  const [paused, setPaused] = useState(false);
  const [firstImageReady, setFirstImageReady] = useState(false);
  const price = priceFromUtil(item.pricing);


  // Autoplay: пауза при hover (desktop) или активном касании (mobile).
  useEffect(() => {
    if (!hasMultiple || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasMultiple, paused, photos.length]);

  // Свайп на мобильных.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    swiped.current = false;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (sx == null || sy == null || !hasMultiple) {
      // авто-возобновление через паузу
      window.setTimeout(() => setPaused(false), 4000);
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    // горизонтальный свайп
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) setIndex((i) => (i + 1) % photos.length);
      else setIndex((i) => (i - 1 + photos.length) % photos.length);
    }
    window.setTimeout(() => setPaused(false), 4000);
  };

  const handleCardClick = () => {
    // Если был свайп — не открываем модалку.
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    onOpen();
  };

  return (
    <article
      className="glass rounded-xl sm:rounded-2xl overflow-hidden group hover:border-primary/50 transition flex flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={handleCardClick}
          aria-label={`Открыть ${item.title}`}
          className="block text-left w-full"
        >
          <MediaShield>
            <div className="aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-surface relative">
              {photos.length > 0 ? (
                photos.map((src, i) => (
                  <SlidePhoto
                    key={src + i}
                    src={src}
                    alt={item.title}
                    active={i === index}
                    onLoaded={i === 0 ? () => setFirstImageReady(true) : undefined}
                  />
                ))
              ) : (
                <div className="absolute inset-0 h-full w-full bg-muted/30 animate-pulse" aria-hidden />
              )}

              {/* Точки-индикаторы для мобильных, когда фото несколько */}
              {hasMultiple && (
                <div
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 sm:hidden"
                  aria-hidden
                >
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </MediaShield>
        </button>
      </div>
      <div className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col min-w-0">
        <h3 className="font-display font-bold text-base sm:text-lg lg:text-xl leading-snug tracking-tight break-words hyphens-auto">
          <button
            type="button"
            onClick={onOpen}
            title={item.title}
            aria-label={`Открыть: ${item.title}`}
            className="card-title-gradient"
          >
            {item.title}
          </button>
        </h3>
        <span className="card-title-accent mt-2" aria-hidden />
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 flex-1 line-clamp-2 sm:line-clamp-3 break-words hyphens-auto min-h-[2.25rem] sm:min-h-[3.75rem]">
          {item.short_description ?? "\u00A0"}
        </p>
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40 min-h-[3.25rem] sm:min-h-[3.5rem]">
          <PriceBlock price={price} />
        </div>
      </div>

      {/* Если первая фотка ещё не подписана/не загрузилась — наложим лёгкий скелет
          поверх текста, чтобы избежать визуального скачка после рендера данных. */}
      {!firstImageReady && photos.length > 0 ? null : null}
    </article>
  );
}

export function FeaturedCardSkeleton() {
  return (
    <article className="glass rounded-xl sm:rounded-2xl overflow-hidden flex flex-col" aria-hidden>
      <div className="aspect-[16/10] sm:aspect-[4/3] bg-muted/30 animate-pulse" />
      <div className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col gap-2">
        <div className="h-4 sm:h-5 w-3/4 rounded bg-muted/40 animate-pulse" />
        <div className="h-3 sm:h-4 w-full rounded bg-muted/30 animate-pulse" />
        <div className="h-3 sm:h-4 w-5/6 rounded bg-muted/30 animate-pulse" />
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40">
          <div className="h-6 sm:h-7 w-1/3 rounded bg-muted/40 animate-pulse" />
        </div>
      </div>
    </article>
  );
}
