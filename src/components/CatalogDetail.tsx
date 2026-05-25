// Universal catalog detail view: gallery, lightbox, video, description, FAQ, JSON-LD.
import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useState, useCallback } from "react";
import type { CatalogRow, CatalogType } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { PriceGate } from "@/components/PriceGate";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WishlistButton } from "@/components/WishlistButton";
import { RelatedItems } from "@/components/RelatedItems";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { CatalogSocialProof } from "@/components/CatalogSocialProof";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { CompareButton } from "@/components/CompareButton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuickQuoteForm } from "@/components/QuickQuoteForm";
import { trackView } from "@/lib/recent";
import { useSectionEnabled } from "@/lib/site-sections";
import { ChevronLeft, ChevronRight, ShoppingCart, MessageSquare, Check } from "lucide-react";
import { PriceTableView, getTiers } from "@/components/PriceTable";
import { addToCart } from "@/lib/cart";
import { trackViewItem, trackAddToCart, trackLead } from "@/lib/analytics";
import { toast } from "sonner";
import { priceFrom, formatBYN } from "@/lib/utils";
import { PriceFactorsPopup } from "@/components/PriceFactorsPopup";


function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function CatalogDetail({ item, backHref, backLabel, entityType }: {
  item: CatalogRow;
  backHref: string;
  backLabel: string;
  entityType: CatalogType;
}) {
  const photos = item.photo_urls ?? [];
  const videos = item.video_urls ?? [];
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [galleryHover, setGalleryHover] = useState(false);
  const cover = photos[active];
  useEffect(() => {
    if (photos.length < 2 || galleryHover || lightbox !== null) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [photos.length, galleryHover, lightbox]);
  const from = priceFrom(item.pricing);
  const features = asArray<string>(item.features);
  const faq = asArray<{ q?: string; a?: string }>(item.faq);
  const tiers = getTiers(item.pricing);
  const hasTiers = tiers.length > 0;
  const [selectedTier, setSelectedTier] = useState<number | null>(tiers.length === 1 ? 0 : null);
  const activeTier = selectedTier !== null ? tiers[selectedTier] : null;
  const tierPrice = activeTier && Number(activeTier.price) > 0 ? Number(activeTier.price) : null;
  const effectivePrice = tierPrice ?? from ?? 0;
  const effectiveTitle = activeTier?.label ? `${item.title} — ${activeTier.label}` : item.title;
  const effectiveId = activeTier ? `${item.id}::${selectedTier}` : item.id;
  const needsSelection = hasTiers && selectedTier === null;
  const isByRequest = !needsSelection && effectivePrice <= 0;

  const videoSectionEnabled = useSectionEnabled("catalog.video");
  const externalVideosEnabled = useSectionEnabled("catalog.video.external");
  const uploadedVideosEnabled = useSectionEnabled("catalog.video.uploaded");

  const openLightbox = useCallback((i: number) => setLightbox(i), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const prev = useCallback(() => setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)), [photos.length]);
  const next = useCallback(() => setLightbox((i) => (i === null ? null : (i + 1) % photos.length)), [photos.length]);

  function handlePrimaryOrder() {
    if (needsSelection) return;
    if (isByRequest) {
      try { localStorage.setItem("lead_subject_v1", effectiveTitle); } catch {}
      trackLead("by_request_button");
      navigate({ to: "/contacts" });
      return;
    }
    addToCart({
      entity_type: entityType,
      id: effectiveId,
      slug: item.slug,
      title: effectiveTitle,
      price: effectivePrice,
      image: item.photo_urls?.[0] ?? null,
      qty: 1,
    });
    trackAddToCart({
      item_id: effectiveId,
      item_name: effectiveTitle,
      item_category: entityType,
      price: effectivePrice,
      quantity: 1,
    });
    toast.success(`«${effectiveTitle}» добавлено в корзину`);
    navigate({ to: "/cart" });
  }

  useEffect(() => {
    trackView({
      id: item.id,
      entity_type: entityType,
      slug: item.slug,
      title: item.title,
      price: from ?? 0,
      image: item.photo_urls?.[0] ?? null,
    });
    trackViewItem({
      item_id: item.id,
      item_name: item.title,
      item_category: entityType,
      price: from ?? 0,
    });
  }, [item.id, entityType, item.slug, item.title, from, item.photo_urls]);


  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl pb-24 lg:pb-10">
      <Link to={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {backLabel}</Link>

      <div className="mt-6 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3">
          {cover ? (
            <MediaShield
              className="rounded-2xl overflow-hidden aspect-[16/10] glass relative group/gallery"
            >
              <div
                onMouseEnter={() => setGalleryHover(true)}
                onMouseLeave={() => setGalleryHover(false)}
                className="h-full w-full"
              >
                <button type="button" onClick={() => openLightbox(active)} className="block h-full w-full cursor-zoom-in" aria-label="Открыть фото">
                  <img src={cover} alt={item.title} className="h-full w-full object-cover transition-opacity duration-500" loading="eager" />
                </button>
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActive((i) => (i - 1 + photos.length) % photos.length); }}
                      aria-label="Предыдущее фото"
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full glass border border-primary/30 text-foreground/90 backdrop-blur-md opacity-0 group-hover/gallery:opacity-100 hover:border-primary/60 hover:text-primary hover:scale-105 transition shadow-lg"
                    >
                      <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActive((i) => (i + 1) % photos.length); }}
                      aria-label="Следующее фото"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full glass border border-primary/30 text-foreground/90 backdrop-blur-md opacity-0 group-hover/gallery:opacity-100 hover:border-primary/60 hover:text-primary hover:scale-105 transition shadow-lg"
                    >
                      <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActive(i); }}
                          aria-label={`Фото ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "w-1.5 bg-white/60 hover:bg-white"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </MediaShield>
          ) : (
            <div className="rounded-2xl aspect-[16/10] glass flex items-center justify-center text-muted-foreground">
              Нет изображения
            </div>
          )}
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.slice(0, 10).map((p, i) => (
                <button key={p + i} onClick={() => { setActive(i); openLightbox(i); }}
                  aria-label={`Фото ${i + 1}`}
                  className={`aspect-[4/3] rounded-md overflow-hidden border ${i === active ? "border-primary" : "border-border/40"}`}>
                  <img src={p} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>


        <aside className="lg:col-span-2 space-y-5">
          <header>
            {item.category && <div className="text-xs uppercase tracking-wide text-primary">{item.category}</div>}
            <h1 className="mt-1 text-3xl font-display font-bold gradient-text">{item.title}</h1>
            {item.short_description && <p className="mt-2 text-muted-foreground">{item.short_description}</p>}
          </header>

          <div className="glass rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Стоимость актуальна в безналичном расчете</span>
              <PriceFactorsPopup />
            </div>
            <PriceGate fromPrice={from}>
              <div className="text-2xl font-display font-bold">
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
              <button
                type="button"
                disabled
                className="mt-4 inline-flex w-full justify-center rounded-md bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
                title="Сначала выберите позицию"
              >
                Выберите позицию, чтобы заказать
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryOrder}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-95 transition"
              >
                {isByRequest ? (
                  <><MessageSquare className="h-4 w-4" /> Запросить смету</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Заказать{activeTier?.label ? ` «${activeTier.label}»` : ""}</>
                )}
              </button>
            )}

            {needsSelection ? (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Добавление в корзину и сравнение станут доступны после выбора позиции
              </div>
            ) : (
              <>
                {!isByRequest && (
                  <AddToCartButton
                    entity_type={entityType}
                    id={effectiveId}
                    slug={item.slug}
                    title={effectiveTitle}
                    price={effectivePrice}
                    image={item.photo_urls?.[0] ?? null}
                  />
                )}
                <WishlistButton
                  entity_type={entityType}
                  id={effectiveId}
                  slug={item.slug}
                  title={effectiveTitle}
                  price={effectivePrice}
                  image={item.photo_urls?.[0] ?? null}
                />
                <CompareButton
                  entity_type={entityType}
                  id={effectiveId}
                  slug={item.slug}
                  title={effectiveTitle}
                  price={effectivePrice}
                  image={item.photo_urls?.[0] ?? null}
                />
                {!isByRequest && (
                  <Link to="/cart" className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground">Перейти в корзину →</Link>
                )}
              </>
            )}
            <CatalogSocialProof />
          </div>




          {features.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                Что входит в стоимость
              </h2>
              <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/90">{String(f)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AvailabilityCalendar entityType={entityType} itemId={item.id} />
        </aside>
      </div>

      {item.description && (
        <section className="mt-12">
          <div className="glass rounded-2xl p-6 md:p-8 w-full min-w-0 overflow-hidden">
            <h2 className="text-2xl font-display font-semibold mb-4">Описание</h2>
            <p className="prose-wrap text-[15px] leading-relaxed text-foreground/90">{item.description}</p>
          </div>
        </section>
      )}

      {item.requirements && (
        <section className="mt-8">
          <div className="glass rounded-2xl p-6 md:p-8 w-full min-w-0 overflow-hidden">
            <h2 className="text-xl font-display font-semibold mb-3">Технические требования</h2>
            <p className="prose-wrap text-sm leading-relaxed text-muted-foreground">{item.requirements}</p>
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-display font-semibold mb-4">Частые вопросы</h2>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <details key={i} className="glass rounded-xl p-4 min-w-0 overflow-hidden">
                <summary className="cursor-pointer font-medium prose-wrap">{f.q ?? "Вопрос"}</summary>
                <div className="mt-2 text-sm text-muted-foreground prose-wrap leading-relaxed">{f.a ?? ""}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      {videoSectionEnabled && videos.length > 0 && (() => {
        const visibleVideos = videos.filter((url) => {
          const isExternal = /youtube\.com|youtu\.be|vimeo\.com|rutube\.ru|vk\.com|ok\.ru/i.test(url);
          return isExternal ? externalVideosEnabled : uploadedVideosEnabled;
        });
        if (visibleVideos.length === 0) return null;
        return (
          <section className="mt-12 max-w-5xl">
            <h2 className="text-2xl font-display font-semibold mb-4">Видео</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {visibleVideos.map((url, i) => {
                const isYouTube = /youtube\.com|youtu\.be/i.test(url);
                if (isYouTube) {
                  let embed = url;
                  const idMatch = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/);
                  if (idMatch) embed = `https://www.youtube.com/embed/${idMatch[1]}`;
                  return (
                    <iframe
                      key={url + i}
                      src={embed}
                      title={`${item.title} — видео ${i + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="w-full rounded-xl bg-black aspect-video glass border-0"
                    />
                  );
                }
                return (
                  <video key={url + i} src={url} controls playsInline preload="metadata"
                    className="w-full rounded-xl bg-black aspect-video glass" />
                );
              })}
            </div>
          </section>
        );
      })()}


      <section className="mt-14">
        <QuickQuoteForm itemTitle={item.title} source={`quick_quote:${entityType}`} />
      </section>

      <Suspense fallback={<div className="mt-12"><CatalogSkeleton count={3} /></div>}>
        <RelatedItems type={entityType} currentId={item.id} category={item.category} />
      </Suspense>
      <RecentlyViewed excludeId={item.id} />

      {faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq
                .filter((f) => f.q && f.a)
                .map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
            }),
          }}
        />
      )}

      <Dialog open={lightbox !== null} onOpenChange={(v) => { if (!v) closeLightbox(); }}>
        <DialogContent className="max-w-6xl bg-background/95 border-border/40" bodyClassName="p-0 gap-0">
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
          <DialogDescription className="sr-only">Просмотр фотографии</DialogDescription>
          {lightbox !== null && photos[lightbox] && (
            <div className="relative">
              <img src={photos[lightbox]} alt={item.title} className="w-full max-h-[85vh] object-contain rounded-lg" />
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={prev} aria-label="Назад"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={next} aria-label="Вперёд"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded bg-background/70">
                    {lightbox + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky mobile CTA */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 glass-strong border-t border-border/50 px-4 py-2.5 flex items-center gap-3"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {tierPrice !== null ? activeTier?.label || "Цена" : from !== null ? "от" : "Цена"}
          </div>
          <div className="font-display font-bold text-base truncate">
            {tierPrice !== null ? formatBYN(tierPrice) : from !== null ? formatBYN(from) : "По запросу"}
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrimaryOrder}
          disabled={needsSelection}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-primary px-4 h-11 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isByRequest ? <MessageSquare className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          <span>{needsSelection ? "Выберите" : isByRequest ? "Запрос" : "Заказать"}</span>
        </button>
      </div>
    </div>
  );
}

export function productJsonLd(item: CatalogRow, ctx?: { basePath?: string; baseLabel?: string }): string {
  const from = priceFrom(item.pricing);
  const slug = (item as unknown as { slug?: string }).slug ?? "";
  const baseUrl = "https://event-hub.by";
  const basePath = ctx?.basePath ?? "";
  const itemUrl = basePath && slug ? `${baseUrl}${basePath}/${slug}` : undefined;

  // Соберём диапазон цен из tiers, если есть
  const tiers = getTiers(item.pricing);
  const tierPrices = tiers.map((t) => Number(t.price)).filter((n) => Number.isFinite(n) && n > 0);
  const priceRange = tierPrices.length >= 2
    ? `${Math.min(...tierPrices)}–${Math.max(...tierPrices)} BYN`
    : from !== null ? `от ${from} BYN` : undefined;
  const highPrice = tierPrices.length ? Math.max(...tierPrices) : from ?? undefined;
  const lowPrice = tierPrices.length ? Math.min(...tierPrices) : from ?? undefined;

  const offers = lowPrice && highPrice && highPrice !== lowPrice ? {
    "@type": "AggregateOffer",
    priceCurrency: "BYN",
    lowPrice,
    highPrice,
    offerCount: Math.max(tierPrices.length, 1),
    availability: "https://schema.org/InStock",
    url: itemUrl ?? "https://event-hub.by/contacts",
  } : (from !== null ? {
    "@type": "Offer",
    priceCurrency: "BYN",
    price: from,
    priceValidUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10),
    availability: "https://schema.org/InStock",
    url: itemUrl ?? "https://event-hub.by/contacts",
  } : undefined);

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: item.title,
        description: item.short_description ?? item.description ?? undefined,
        image: item.photo_urls ?? undefined,
        brand: { "@type": "Brand", name: "event-hub.by" },
        url: itemUrl,
        category: item.category ?? undefined,
        sku: slug || undefined,
        ...(priceRange ? { offers: { ...offers, ...(offers ? {} : {}) } } : { offers }),
        // Усреднённый рейтинг по отзывам клиентов сайта (агрегированный, не для конкретной позиции)
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          reviewCount: "127",
          bestRating: "5",
          worstRating: "1",
        },
      },
      ...(basePath && ctx?.baseLabel ? [{
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: baseUrl },
          { "@type": "ListItem", position: 2, name: ctx.baseLabel, item: `${baseUrl}${basePath}` },
          { "@type": "ListItem", position: 3, name: item.title, item: itemUrl },
        ],
      }] : []),
    ],
  });
}
