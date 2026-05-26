// Модальное окно «быстрый просмотр» позиции каталога.
// Минималистично: галерея, цена с qty, основные блоки. Полный FAQ/видео — на детальной странице.
import { useEffect, useState } from "react";
import { SearchX, ShoppingCart, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCatalogItem, type CatalogType, type CatalogRow } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { StorageImg, StorageVideo } from "@/components/StorageMedia";
import { PriceGate } from "@/components/PriceGate";
import { WishlistButton } from "@/components/WishlistButton";
import { CompareButton } from "@/components/CompareButton";
import { PriceTableView, getTiers } from "@/components/PriceTable";
import { CatalogProse } from "@/components/CatalogProse";
import { ExtrasBlock } from "@/components/ExtrasBlock";
import { QuantityStepper } from "@/components/QuantityStepper";
import { HourPriceSlider } from "@/components/HourPriceSlider";
import { detectQuantityKind, maxQtyFor, parseHourTiers, priceForHours, pluralizeUnit, formatBYNTotal } from "@/lib/pricing";
import { addToCart } from "@/lib/cart";
import { toast } from "sonner";
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
      <DialogContent
        className={`max-w-4xl w-[min(96vw,56rem)] max-h-[92vh] bg-background flex flex-col ${(!isLoading && !data) ? 'border-0' : 'border-border/40'}`}
        bodyClassName="p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">{data?.title ?? "Просмотр позиции"}</DialogTitle>
        <DialogDescription className="sr-only">{data?.short_description ?? "Детальная информация о позиции каталога"}</DialogDescription>
        {isLoading && (
          <div className="p-6 md:p-7 overflow-y-auto" aria-busy="true" aria-label="Загрузка позиции">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="aspect-[4/3] rounded-2xl bg-muted/40 animate-pulse" />
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-md bg-muted/30 animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-3 w-24 bg-muted/30 rounded animate-pulse" />
                <div className="h-7 w-3/4 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                <div className="h-24 w-full rounded-xl bg-muted/30 animate-pulse" />
                <div className="h-10 w-full rounded-md bg-muted/40 animate-pulse" />
              </div>
            </div>
          </div>
        )}
        {!isLoading && !data && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] p-10 text-center">
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

function Body({ item, type, onClose }: { item: CatalogRow; basePath: string; type: CatalogType; onClose: () => void }) {
  const navigate = useNavigate();
  const photos = item.photo_urls ?? [];
  const videos = item.video_urls ?? [];
  const features = asArray<string>(item.features);
  const from = priceFrom(item.pricing);
  const [active, setActive] = useState(0);
  const cover = photos[active];
  useEffect(() => {
    if (photos.length < 2) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [photos.length]);

  const tiers = getTiers(item.pricing);
  const hasTiers = tiers.length > 0;
  const hourPricing = parseHourTiers(tiers, (item.pricing as { extraHourPrice?: number } | null)?.extraHourPrice);
  const isHourMode = hourPricing !== null;
  const [hours, setHours] = useState<number>(hourPricing?.popularHours ?? hourPricing?.minHours ?? 1);
  const [selectedTier, setSelectedTier] = useState<number | null>(tiers.length === 1 ? 0 : null);
  const activeTier = selectedTier !== null ? tiers[selectedTier] : null;
  const tierPrice = activeTier && Number(activeTier.price) > 0 ? Number(activeTier.price) : null;
  const unitPrice = tierPrice ?? from ?? 0;
  const qtyKind = !isHourMode ? detectQuantityKind(activeTier?.unit) : null;
  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [selectedTier]);
  const effectiveQty = qtyKind ? qty : 1;
  const hourTotal = isHourMode ? priceForHours(hourPricing!, hours) : 0;
  const total = isHourMode ? hourTotal : unitPrice * effectiveQty;
  const qtySuffix = isHourMode
    ? ` — ${hours} ${pluralizeUnit("hour", hours)}`
    : qtyKind ? ` — ${effectiveQty} ${pluralizeUnit(qtyKind, effectiveQty)}` : "";
  const effectiveTitle = (!isHourMode && activeTier?.label ? `${item.title} — ${activeTier.label}` : item.title) + qtySuffix;
  const effectiveId = isHourMode
    ? `${item.id}::h${hours}`
    : activeTier ? `${item.id}::${selectedTier}${qtyKind ? `::${qty}` : ""}` : item.id;
  const needsSelection = !isHourMode && hasTiers && selectedTier === null;
  const isByRequest = !needsSelection && !isHourMode && unitPrice <= 0;


  const hasPhotos = photos.length > 0;
  const hasDescription = Boolean(item.description || item.requirements);
  const extras = (item as unknown as { extras?: unknown }).extras;
  const hasExtras = Array.isArray(extras) && extras.length > 0;

  const { isAuthenticated } = useAuth();
  function handleOrder() {
    if (!isAuthenticated) { openAuthPrompt({ reason: "Войдите, чтобы оформить заказ или отправить запрос." }); return; }
    if (needsSelection) return;
    if (isByRequest) {
      try { localStorage.setItem("lead_subject_v1", effectiveTitle); } catch { /* ignore */ }
      onClose();
      navigate({ to: "/contacts" });
      return;
    }
    addToCart({
      entity_type: type,
      id: effectiveId,
      slug: item.slug,
      title: effectiveTitle,
      price: total,
      image: photos[0] ?? null,
      qty: 1,
    });
    toast.success(`«${effectiveTitle}» добавлено в корзину`);
    onClose();
    navigate({ to: "/cart" });
  }

  return (
    <div className="flex flex-col max-h-[92vh]">
      {/* Scrollable body */}
      <div className="overflow-y-auto overscroll-contain px-5 pt-5 pb-4 md:px-7 md:pt-7">
        <div className={`grid gap-6 ${hasPhotos ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Gallery */}
          {hasPhotos && (
            <div className="space-y-2.5">
              <MediaShield className="rounded-2xl overflow-hidden aspect-[4/3] glass">
                <StorageImg
                  path={cover!}
                  alt={item.title}
                  className="h-full w-full object-cover transition-opacity duration-500"
                  fallbackClassName="h-full w-full"
                />
              </MediaShield>
              {photos.length > 1 && (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 5)}, minmax(0, 1fr))` }}
                >
                  {photos.slice(0, 5).map((p, i) => (
                    <button
                      key={p + i}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Фото ${i + 1}`}
                      className={`aspect-square rounded-md overflow-hidden border transition ${i === active ? "border-primary" : "border-border/40 opacity-70 hover:opacity-100"}`}
                    >
                      <StorageImg path={p} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                    </button>
                  ))}
                </div>
              )}
              {hasDescription && (
                <CatalogProse description={item.description} requirements={item.requirements} variant="modal" />
              )}
            </div>
          )}

          {/* Info column */}
          <aside className="space-y-4 min-w-0">
            <header>
              {item.category && <div className="text-xs uppercase tracking-wide text-primary">{item.category}</div>}
              <h2 className="mt-1 text-2xl font-display font-bold gradient-text">{item.title}</h2>
              {item.short_description && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.short_description}</p>
              )}
            </header>

            {/* Price block (desktop) — sticky CTA on mobile lives in footer below */}
            <div className="glass rounded-xl p-4 space-y-3 hidden md:block">
              <div className="text-xs text-muted-foreground">Стоимость актуальна в безналичном расчёте</div>
              <PriceGate>
                {isHourMode ? (
                  <HourPriceSlider
                    pricing={hourPricing!}
                    hours={hours}
                    onChange={setHours}
                    rawPricing={item.pricing}
                  />
                ) : (
                  <>
                    <div className="text-2xl font-display font-bold tabular-nums">
                      {tierPrice !== null
                        ? formatBYNTotal(tierPrice)
                        : from !== null
                        ? `от ${formatBYNTotal(from)}`
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
                    label={qtyKind === "day" ? "Дней" : qtyKind === "person" ? "Гостей" : "Кол-во"}
                  />
                  <div className="flex items-baseline justify-between border-t border-border/30 pt-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Итого</span>
                    <span className="text-lg font-display font-bold tabular-nums">
                      {formatBYNTotal(total)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {effectiveQty} × {formatBYNTotal(unitPrice)}
                      </span>
                    </span>
                  </div>
                </>
              )}


              {needsSelection ? (
                <button type="button" disabled className="inline-flex w-full justify-center rounded-md bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed">
                  Выберите позицию, чтобы заказать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOrder}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-95 transition"
                >
                  {isByRequest ? (
                    <><MessageSquare className="h-4 w-4" /> Запросить смету</>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Заказать{(qtyKind || isHourMode) ? ` — ${formatBYNTotal(total)}` : ""}
                    </>
                  )}
                </button>
              )}

              {!needsSelection && type !== "services" && (
                <div className="flex gap-2 pt-1">
                  <WishlistButton entity_type={type} id={effectiveId} slug={item.slug} title={effectiveTitle} price={unitPrice} image={photos[0] ?? null} />
                  <CompareButton entity_type={type} id={effectiveId} slug={item.slug} title={effectiveTitle} price={unitPrice} image={photos[0] ?? null} />
                </div>
              )}
            </div>

            {features.length > 0 && (
              <div className="glass rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-sm">Что входит</h3>
                <ul className="space-y-1.5 text-sm">
                  {features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{String(f)}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {hasExtras && <ExtrasBlock extras={extras} variant="modal" />}
          </aside>
        </div>

        {videos.length > 0 && (
          <section className="mt-6">
            <h3 className="text-base font-display font-semibold mb-3">Видео</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {videos.map((url, i) => {
                const isYouTube = /youtube\.com|youtu\.be/i.test(url);
                if (isYouTube) {
                  let embed = url;
                  const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/);
                  if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
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
                return <StorageVideo key={url + i} path={url} className="w-full rounded-xl bg-black aspect-video glass" />;
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sticky mobile CTA */}
      <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur px-5 py-3 space-y-2">
        {hasTiers && !isHourMode && (
          <div className="text-xs text-muted-foreground">
            {needsSelection ? "Выберите позицию ↑" : `Выбрано: ${activeTier?.label || "—"}`}
          </div>
        )}
        {isHourMode && (
          <HourPriceSlider
            pricing={hourPricing!}
            hours={hours}
            onChange={setHours}
            rawPricing={item.pricing}
          />
        )}
        {qtyKind && !needsSelection && !isByRequest && (
          <QuantityStepper
            value={qty}
            onChange={setQty}
            kind={qtyKind}
            min={1}
            max={maxQtyFor(qtyKind)}
            label={qtyKind === "day" ? "Дней" : qtyKind === "person" ? "Гостей" : "Кол-во"}
          />
        )}
        <button
          type="button"
          onClick={handleOrder}
          disabled={needsSelection}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {needsSelection ? "Выберите позицию" : isByRequest ? (
            <><MessageSquare className="h-4 w-4" /> Запросить смету</>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Заказать — {formatBYNTotal(total || unitPrice)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
