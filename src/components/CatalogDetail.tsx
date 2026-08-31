// Universal catalog detail view: gallery, lightbox, video, description, FAQ, JSON-LD.
import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useState, useCallback } from "react";
import type { CatalogRow, CatalogType } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { StorageImg, StorageVideo } from "@/components/StorageMedia";
import { PriceGate } from "@/components/PriceGate";
import { AddToCartButton } from "@/components/AddToCartButton";

import { RelatedItems } from "@/components/RelatedItems";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { CatalogSocialProof } from "@/components/CatalogSocialProof";
import { RecentlyViewed } from "@/components/RecentlyViewed";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuickQuoteForm } from "@/components/QuickQuoteForm";
import { trackView } from "@/lib/recent";
import { signalDemand } from "@/lib/demand";
import { useSectionEnabled } from "@/lib/site-sections";
import { ChevronLeft, ChevronRight, ShoppingCart, MessageSquare, Check } from "lucide-react";
import { PriceTableView, getTiers } from "@/components/PriceTable";
import { addToCart } from "@/lib/cart";
import { trackViewItem, trackAddToCart, trackLead } from "@/lib/analytics";
import { toast } from "sonner";
import { priceFrom, formatBYN } from "@/lib/utils";
import { PriceFactorsPopup } from "@/components/PriceFactorsPopup";
import { CatalogProse } from "@/components/CatalogProse";
import { toCardExcerpt } from "@/lib/rich-text";
import { ExtrasBlock } from "@/components/ExtrasBlock";
import { safeJsonLd } from "@/lib/seo-jsonld";
import { QuantityStepper } from "@/components/QuantityStepper";
import { HourPriceSlider } from "@/components/HourPriceSlider";
import { detectQuantityKind, maxQtyFor, unitFromPricing, parseHourTiers, priceForHours, pluralizeUnit, formatBYNTotal } from "@/lib/pricing";


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
  useEffect(() => {
    signalDemand(entityType, item.id, "view");
  }, [entityType, item.id]);
  const from = priceFrom(item.pricing);
  const features = asArray<string>(item.features);
  const faq = asArray<{ q?: string; a?: string }>(item.faq);
  const tiers = getTiers(item.pricing);
  const itemUnit = unitFromPricing(item.pricing);
  const hasTiers = tiers.length > 0;
  const hourPricing = parseHourTiers(tiers, (item.pricing as { extraHourPrice?: number } | null)?.extraHourPrice);
  const isHourMode = hourPricing !== null;
  const [hours, setHours] = useState<number>(hourPricing?.popularHours ?? hourPricing?.minHours ?? 1);
  const [selectedTier, setSelectedTier] = useState<number | null>(tiers.length === 1 ? 0 : null);
  const activeTier = selectedTier !== null ? tiers[selectedTier] : null;
  const tierPrice = activeTier && Number(activeTier.price) > 0 ? Number(activeTier.price) : null;
  const effectiveUnitPrice = tierPrice ?? from ?? 0;
  const qtyKind = !isHourMode ? detectQuantityKind(activeTier?.unit) : null;
  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [selectedTier]);
  const effectiveQty = qtyKind ? qty : 1;
  const effectivePrice = effectiveUnitPrice;
  const hourTotal = isHourMode ? priceForHours(hourPricing!, hours) : 0;
  const effectiveTotal = isHourMode ? hourTotal : effectiveUnitPrice * effectiveQty;
  const qtySuffix = isHourMode
    ? ` — ${hours} ${pluralizeUnit("hour", hours)}`
    : qtyKind ? ` — ${effectiveQty} ${pluralizeUnit(qtyKind, effectiveQty)}` : "";
  const effectiveTitle = (!isHourMode && activeTier?.label ? `${item.title} — ${activeTier.label}` : item.title) + qtySuffix;
  const effectiveId = isHourMode
    ? `${item.id}::h${hours}`
    : activeTier ? `${item.id}::${selectedTier}${qtyKind ? `::${qty}` : ""}` : item.id;
  const needsSelection = !isHourMode && hasTiers && selectedTier === null;
  const isByRequest = !needsSelection && !isHourMode && effectiveUnitPrice <= 0;


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
      price: effectiveTotal,
      image: item.photo_urls?.[0] ?? null,
      unit: itemUnit,
      qty: 1,
    });
    trackAddToCart({
      item_id: effectiveId,
      item_name: effectiveTitle,
      item_category: entityType,
      price: effectiveTotal,
      quantity: effectiveQty,
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
    <div className="page-shell py-10 max-w-6xl pb-24 lg:pb-10">
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
                  <StorageImg path={cover} alt={item.title} className="h-full w-full object-cover transition-opacity duration-500" fallbackClassName="h-full w-full" />
                </button>
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
                  <StorageImg path={p} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>


        <aside className="lg:col-span-2 space-y-5">
          <header>
            {item.category && <div className="text-xs uppercase tracking-wide text-primary">{item.category}</div>}
            <h1 className="mt-1 text-3xl font-display font-bold gradient-text">{item.title}</h1>
          </header>



          <div className="glass rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Стоимость актуальна в безналичном расчете</span>
              <PriceFactorsPopup />
            </div>
            <PriceGate fromPrice={from}>
              {isHourMode ? (
                <HourPriceSlider
                  pricing={hourPricing!}
                  hours={hours}
                  onChange={setHours}
                  rawPricing={item.pricing}
                />
              ) : (
                <>
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
                </>
              )}
            </PriceGate>


            {qtyKind && !needsSelection && !isByRequest && (
              <>
                <QuantityStepper
                  value={qty}
                  onChange={setQty}
                  kind={qtyKind}
                  min={1}
                  max={maxQtyFor(qtyKind)}
                  label={qtyKind === "hour" ? "Часов" : qtyKind === "day" ? "Дней" : qtyKind === "person" ? "Гостей" : "Кол-во"}
                />
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Итого</span>
                  <span className="text-lg font-display font-bold tabular-nums">
                    {formatBYNTotal(effectiveTotal)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {effectiveQty} × {formatBYNTotal(effectiveUnitPrice)}
                    </span>
                  </span>
                </div>
              </>
            )}

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
                  <><MessageSquare className="h-4 w-4" /> Оставить заявку</>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    В корзину{(qtyKind || isHourMode) ? ` — ${formatBYNTotal(effectiveTotal)}` : activeTier?.label ? ` «${activeTier.label}»` : ""}
                  </>
                )}
              </button>
            )}

            {needsSelection ? (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Добавление в корзину станет доступно после выбора позиции
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
                    unit={itemUnit}
                  />
                )}
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

          <ExtrasBlock extras={(item as unknown as { extras?: unknown }).extras} variant="page" />


        </aside>
      </div>

      <CatalogProse description={item.description} requirements={item.requirements} variant="page" />


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
                  <StorageVideo key={url + i} path={url} className="w-full rounded-xl bg-black aspect-video glass" />
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
            __html: safeJsonLd({
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
              <StorageImg path={photos[lightbox]} alt={item.title} className="w-full max-h-[85vh] object-contain rounded-lg" fallbackClassName="w-full max-h-[85vh] rounded-lg" />
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
          <span>{needsSelection ? "Выберите" : isByRequest ? "Заявка" : "В корзину"}</span>
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

  return safeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: item.title,
        description: toCardExcerpt(item.description, 300) || undefined,
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
