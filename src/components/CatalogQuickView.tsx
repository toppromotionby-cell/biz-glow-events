// Модальное окно «быстрый просмотр» позиции каталога.
// Подтягивает полную запись из БД и показывает все поля, заполненные при создании.
import { useState } from "react";
import { SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCatalogItem, type CatalogType, type CatalogRow } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { PriceGate } from "@/components/PriceGate";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WishlistButton } from "@/components/WishlistButton";
import { CompareButton } from "@/components/CompareButton";
import { PriceTableView, getTiers } from "@/components/PriceTable";

import { priceFrom } from "@/lib/utils";
function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function CatalogQuickView({
  open,
  onOpenChange,
  type,
  slug,
  basePath,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: CatalogType;
  slug: string;
  basePath: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["catalog", type, slug],
    queryFn: () => getCatalogItem({ data: { type, slug } }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-5xl max-h-[90vh] bg-background ${(!isLoading && !data) ? 'border-0' : 'border-border/40'}`} bodyClassName="p-0 gap-0">
        <DialogTitle className="sr-only">{data?.title ?? "Просмотр позиции"}</DialogTitle>
        <DialogDescription className="sr-only">{data?.short_description ?? "Детальная информация о позиции каталога"}</DialogDescription>
        {isLoading && (
          <div className="p-6 md:p-8" aria-busy="true" aria-label="Загрузка позиции">
            <div className="grid md:grid-cols-5 gap-6">
              <div className="md:col-span-3 space-y-3">
                <div className="aspect-[16/10] rounded-2xl bg-muted/40 animate-pulse" />
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="aspect-[4/3] rounded-md bg-muted/30 animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-3">
                <div className="h-3 w-24 bg-muted/30 rounded animate-pulse" />
                <div className="h-7 w-3/4 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-muted/30 rounded animate-pulse" />
                <div className="h-24 w-full rounded-xl bg-muted/30 animate-pulse" />
                <div className="h-10 w-full rounded-md bg-muted/40 animate-pulse" />
              </div>
            </div>
          </div>
        )}
        {!isLoading && !data && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-10 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-5">
              <SearchX className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">Не найдено</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">
              Запись была удалена или перемещена
            </p>
          </div>
        )}
        {data && <Body item={data} basePath={basePath} type={type} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ item, basePath, type, onClose }: { item: CatalogRow; basePath: string; type: CatalogType; onClose: () => void }) {
  const photos = item.photo_urls ?? [];
  const videos = item.video_urls ?? [];
  const features = asArray<string>(item.features);
  const faq = asArray<{ q?: string; a?: string }>(item.faq);
  const from = priceFrom(item.pricing);
  const [active, setActive] = useState(0);
  const cover = photos[active];
  const tiers = getTiers(item.pricing);
  const hasTiers = tiers.length > 0;
  const [selectedTier, setSelectedTier] = useState<number | null>(tiers.length === 1 ? 0 : null);
  const activeTier = selectedTier !== null ? tiers[selectedTier] : null;
  const tierPrice = activeTier && Number(activeTier.price) > 0 ? Number(activeTier.price) : null;
  const effectivePrice = tierPrice ?? from ?? 0;
  const effectiveTitle = activeTier?.label ? `${item.title} — ${activeTier.label}` : item.title;
  const effectiveId = activeTier ? `${item.id}::${selectedTier}` : item.id;
  const needsSelection = hasTiers && selectedTier === null;

  return (
    <div className="p-6 md:p-8">



      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          {cover ? (
            <MediaShield className="rounded-2xl overflow-hidden aspect-[16/10] glass">
              <img src={cover} alt={item.title} className="h-full w-full object-cover" />
            </MediaShield>
          ) : (
            <div className="rounded-2xl aspect-[16/10] glass flex items-center justify-center text-muted-foreground">
              Нет изображения
            </div>
          )}
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.slice(0, 10).map((p, i) => (
                <button key={p + i} type="button" onClick={() => setActive(i)}
                  className={`aspect-[4/3] rounded-md overflow-hidden border ${i === active ? "border-primary" : "border-border/40"}`}>
                  <img src={p} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-2 space-y-4">
          <header>
            {item.category && <div className="text-xs uppercase tracking-wide text-primary">{item.category}</div>}
            <h2 className="mt-1 text-2xl font-display font-bold gradient-text">{item.title}</h2>
            {item.short_description && <p className="mt-2 text-sm text-muted-foreground">{item.short_description}</p>}
          </header>

          <div className="glass rounded-xl p-4 space-y-3">
            <div className="text-sm text-muted-foreground">Стоимость актуальна в безналичном расчете</div>
            <PriceGate>
              <div className="text-xl font-display font-bold">
                {tierPrice !== null
                  ? new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(tierPrice)
                  : from !== null
                  ? `от ${new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(from)}`
                  : "По запросу"}
              </div>
              {hasTiers && (
                <>
                  <div className="text-xs text-muted-foreground">
                    {needsSelection ? "Выберите позицию из таблицы" : `Выбрано: ${activeTier?.label || "—"}`}
                  </div>
                  <PriceTableView
                    pricing={item.pricing}
                    selectable
                    selectedIndex={selectedTier}
                    onSelect={(i) => setSelectedTier(i)}
                  />
                </>
              )}
            </PriceGate>
            {needsSelection ? (
              <button type="button" disabled className="mt-3 inline-flex w-full justify-center rounded-md bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Выберите позицию, чтобы заказать
              </button>
            ) : (
              <>
                <Link to="/contacts" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
                  Заказать{activeTier?.label ? ` «${activeTier.label}»` : ""}
                </Link>
                {type !== "services" && (
                  <>
                    <AddToCartButton entity_type={type} id={effectiveId} slug={item.slug} title={effectiveTitle} price={effectivePrice} image={photos[0] ?? null} />
                    <WishlistButton entity_type={type} id={effectiveId} slug={item.slug} title={effectiveTitle} price={effectivePrice} image={photos[0] ?? null} />
                    <CompareButton entity_type={type} id={effectiveId} slug={item.slug} title={effectiveTitle} price={effectivePrice} image={photos[0] ?? null} />
                  </>
                )}
              </>
            )}
          </div>


          {features.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="font-semibold mb-2 text-sm">Что входит</h3>
              <ul className="space-y-1.5 text-sm">
                {features.map((f, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{String(f)}</span></li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {item.description && (
        <section className="mt-10">
          <div className="glass rounded-2xl p-5 sm:p-6 md:p-8 w-full overflow-hidden">
            <h3 className="text-base sm:text-lg md:text-xl font-display font-semibold mb-3">Описание</h3>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-[14px] sm:text-[15px] md:text-base leading-relaxed text-foreground/90 max-w-[68ch]">{item.description}</p>
          </div>
        </section>
      )}

      {item.requirements && (
        <section className="mt-6">
          <div className="glass rounded-2xl p-5 sm:p-6 md:p-8 w-full overflow-hidden">
            <h3 className="text-sm sm:text-base md:text-lg font-display font-semibold mb-3">Технические требования</h3>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-[13px] sm:text-sm md:text-[15px] leading-relaxed text-muted-foreground max-w-[68ch]">{item.requirements}</p>
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section className="mt-6">
          <h3 className="text-base font-display font-semibold mb-3">Частые вопросы</h3>
          <div className="space-y-2">
            {faq.map((f, i) => (
              <details key={i} className="glass rounded-xl p-4">
                <summary className="cursor-pointer font-medium text-sm">{f.q ?? "Вопрос"}</summary>
                <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words hyphens-auto leading-relaxed">{f.a ?? ""}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="mt-8">
          <h3 className="text-lg font-display font-semibold mb-3">Видео</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {videos.map((url, i) => {
              const isYouTube = /youtube\.com|youtu\.be/i.test(url);
              if (isYouTube) {
                let embed = url;
                const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/);
                if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
                return (
                  <iframe key={url + i} src={embed} title={`${item.title} — видео ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen loading="lazy"
                    className="w-full rounded-xl bg-black aspect-video glass border-0" />
                );
              }
              return <video key={url + i} src={url} controls playsInline preload="metadata" className="w-full rounded-xl bg-black aspect-video glass" />;
            })}
          </div>
        </section>
      )}

    </div>
  );
}
