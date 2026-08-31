// Модальное окно «Подробнее» для позиции каталога.
// Содержит ключевые данные: медиа (фото + видео), цены, занятость, требования,
// состав и доп. опции, а также инлайн-заявку без переходов на другие страницы.
import { useEffect, useMemo, useState } from "react";
import { SearchX, ShoppingCart, FileText, Play, Maximize2, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCatalogItem, type CatalogType, type CatalogRow } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { StorageImg, StorageVideo } from "@/components/StorageMedia";
import { PriceGate } from "@/components/PriceGate";

import { PriceTableView, getTiers } from "@/components/PriceTable";
import { CatalogProse } from "@/components/CatalogProse";
import { ExtrasBlock } from "@/components/ExtrasBlock";
import { QuantityStepper } from "@/components/QuantityStepper";
import { HourPriceSlider } from "@/components/HourPriceSlider";
import { QuickLeadRequest } from "@/components/catalog/QuickLeadRequest";

import { detectQuantityKind, maxQtyFor, unitFromPricing, parseHourTiers, priceForHours, pluralizeUnit, formatBYNTotal } from "@/lib/pricing";
import { addToCart } from "@/lib/cart";
import { toast } from "sonner";
import { priceFrom } from "@/lib/utils";
import { signalDemand } from "@/lib/demand";

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
        <DialogDescription className="sr-only">{"Детальная информация о позиции каталога"}</DialogDescription>
        {isLoading && (
          <div className="p-6 md:p-7 overflow-y-auto" aria-busy="true" aria-label="Загрузка позиции">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="aspect-[4/3] rounded-2xl bg-muted/40 animate-pulse" />
                <div className="grid-swatches">
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

type Slide = { kind: "photo" | "video"; src: string };

function Body({ item, type, basePath, onClose }: { item: CatalogRow; basePath: string; type: CatalogType; onClose: () => void }) {
  const navigate = useNavigate();
  const photos = item.photo_urls ?? [];
  const videos = item.video_urls ?? [];
  const features = asArray<string>(item.features);
  const from = priceFrom(item.pricing);
  useEffect(() => {
    signalDemand(type, item.id, "detail");
  }, [type, item.id]);

  const slides = useMemo<Slide[]>(
    () => [
      ...photos.map((src) => ({ kind: "photo" as const, src })),
      ...videos.map((src) => ({ kind: "video" as const, src })),
    ],
    [photos, videos],
  );
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = slides[active];
  useEffect(() => {
    // Автопрокрутка только по фото и только пока пользователь не открыл видео/лайтбокс.
    if (photos.length < 2 || lightbox || current?.kind === "video") return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [photos.length, lightbox, current?.kind]);

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

  const hasMedia = slides.length > 0;
  const hasDescription = Boolean(item.description);
  const hasRequirements = Boolean(item.requirements && item.requirements.trim());
  const extras = (item as unknown as { extras?: unknown }).extras;
  const hasExtras = Array.isArray(extras) && extras.length > 0;

  const unitLabel = unitFromPricing(item.pricing);
  const chips: string[] = [
    item.category ?? "",
    from !== null ? `от ${formatBYNTotal(from)}` : "Цена по запросу",
    unitLabel ? `Ед.: ${unitLabel}` : "",
    isHourMode && hourPricing?.minHours ? `Мин. ${hourPricing.minHours} ч` : "",
    photos.length > 0 ? `${photos.length} фото` : "",
    videos.length > 0 ? `${videos.length} видео` : "",
  ].filter(Boolean);

  // Данные позиции для формы заявки — чтобы клиент не вводил их повторно.
  const quoteDetails = [
    { label: "Позиция", value: item.title },
    item.category ? { label: "Категория", value: item.category } : null,
    !isHourMode && activeTier?.label ? { label: "Пакет", value: String(activeTier.label) } : null,
    isHourMode ? { label: "Часов", value: `${hours}` } : null,
    total > 0
      ? { label: "Расчёт", value: formatBYNTotal(total) }
      : from !== null
        ? { label: "Цена от", value: formatBYNTotal(from) }
        : { label: "Цена", value: "по запросу" },
    unitLabel ? { label: "Единица", value: unitLabel } : null,
    qtyKind ? { label: "Количество", value: `${effectiveQty}` } : null,
    slides.length ? { label: "Медиа", value: `${photos.length} фото / ${videos.length} видео` } : null,
    hasRequirements ? { label: "Требования", value: "указаны в карточке" } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(true);

  function openQuote() {
    setQuoteOpen(true);
    // Прокручиваем к форме после раскрытия.
    window.setTimeout(() => {
      document.getElementById("quickview-quote")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function handleOrder() {
    if (needsSelection) return;
    if (isByRequest) { openQuote(); return; }
    addToCart({
      entity_type: type,
      id: effectiveId,
      slug: item.slug,
      title: effectiveTitle,
      price: total,
      image: photos[0] ?? null,
      unit: unitFromPricing(item.pricing),
      qty: 1,
    });
    toast.success(`«${effectiveTitle}» добавлено в корзину`);
    onClose();
    navigate({ to: "/cart" });
  }

  const detailPath = `${basePath.replace(/\/$/, "")}/${item.slug}`;

  return (
    <div className="flex flex-col max-h-[92vh]">
      {/* Scrollable body */}
      <div className="overflow-y-auto overscroll-contain px-5 pt-5 pb-4 md:px-7 md:pt-7">
        <div className={`grid gap-6 ${hasMedia ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Медиа */}
          {hasMedia && (
            <div className="space-y-2.5">
              <div className="relative">
                {current?.kind === "video" ? (
                  <VideoFrame url={current.src} title={item.title} />
                ) : (
                  <>
                    <MediaShield className="rounded-2xl overflow-hidden aspect-[4/3] glass">
                      <StorageImg
                        path={current!.src}
                        alt={item.title}
                        className="h-full w-full object-cover transition-opacity duration-500"
                        fallbackClassName="h-full w-full"
                      />
                    </MediaShield>
                    <button
                      type="button"
                      onClick={() => setLightbox(true)}
                      aria-label="Открыть фото на весь экран"
                      className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-background/80 backdrop-blur border border-border/50 hover:bg-background transition"
                    >
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {slides.length > 1 && (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.min(slides.length, 5)}, minmax(0, 1fr))` }}
                >
                  {slides.slice(0, 10).map((s, i) => (
                    <button
                      key={s.src + i}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={s.kind === "video" ? `Видео ${i + 1}` : `Фото ${i + 1}`}
                      className={`relative aspect-square rounded-md overflow-hidden border transition ${i === active ? "border-primary" : "border-border/40 opacity-70 hover:opacity-100"}`}
                    >
                      {s.kind === "photo" ? (
                        <StorageImg path={s.src} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-muted/50">
                          <Play className="h-4 w-4 text-primary" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {hasDescription && (
                <CatalogProse description={item.description} variant="modal" />
              )}
            </div>
          )}

          {/* Информация */}
          <aside className="space-y-4 min-w-0">
            <header>
              {item.category && <div className="text-xs uppercase tracking-wide text-primary">{item.category}</div>}
              <h2 className="mt-1 text-2xl font-display font-bold gradient-text">{item.title}</h2>
              {chips.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <li key={c} className="rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </header>

            {/* Цены / требования */}
            <div className="glass rounded-xl p-4 space-y-3 hidden md:block">
              <Tabs defaultValue="price">
                <TabsList className="w-full">
                  <TabsTrigger value="price" className="flex-1">Цены</TabsTrigger>
                  {hasRequirements && <TabsTrigger value="requirements" className="flex-1">Требования</TabsTrigger>}
                </TabsList>


                <TabsContent value="price" className="space-y-3 pt-3">
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
                </TabsContent>



                {hasRequirements && (
                  <TabsContent value="requirements" className="pt-3">
                    <CatalogProse requirements={item.requirements} variant="modal" />
                  </TabsContent>
                )}
              </Tabs>

              <div className="space-y-2 border-t border-border/30 pt-3">
                {needsSelection ? (
                  <button type="button" disabled className="inline-flex w-full justify-center rounded-md bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed">
                    Выберите позицию, чтобы заказать
                  </button>
                ) : (
                  !isByRequest && (
                    <button
                      type="button"
                      onClick={handleOrder}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-95 transition"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      В корзину{(qtyKind || isHourMode) ? ` — ${formatBYNTotal(total)}` : ""}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={openQuote}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition ${
                    isByRequest
                      ? "bg-gradient-primary text-primary-foreground glow-primary hover:opacity-95"
                      : "border border-primary/40 text-foreground hover:bg-primary/10"
                  }`}
                >
                  <FileText className="h-4 w-4" /> Оставить заявку
                </button>
              </div>
            </div>

            {features.length > 0 && (
              <div className="glass rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setFeaturesOpen((v) => !v)}
                  aria-expanded={featuresOpen}
                  className="flex w-full items-center justify-between text-sm font-semibold"
                >
                  Что входит
                  <ChevronDown className={`h-4 w-4 transition-transform ${featuresOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {featuresOpen && (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {features.map((f, i) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{String(f)}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {hasExtras && <ExtrasBlock extras={extras} variant="modal" />}

            {/* Требования (мобильные) */}
            {hasRequirements && (
              <div className="md:hidden glass rounded-xl p-4 space-y-2">
                <div className="text-sm font-semibold">Требования</div>
                <CatalogProse requirements={item.requirements} variant="modal" />
              </div>
            )}

          </aside>
        </div>

        {quoteOpen && (
          <section id="quickview-quote" className="mt-6">
            <QuickLeadRequest
              subject={effectiveTitle}
              source={`quickview:${type}`}
              details={quoteDetails}
              itemUrl={typeof window !== "undefined" ? `${window.location.origin}${detailPath}` : detailPath}
              demand={{ entity_type: type, entity_id: item.id }}
              defaultNotes={item.requirements?.trim() ? `Требования по позиции учтены: ${item.requirements.trim().slice(0, 300)}` : ""}
            />
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
        <div className="flex items-stretch gap-2">
          {!isByRequest && (
            <button
              type="button"
              onClick={handleOrder}
              disabled={needsSelection}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              {needsSelection ? "Выберите позицию" : `В корзину — ${formatBYNTotal(total || unitPrice)}`}
            </button>
          )}
          <button
            type="button"
            onClick={openQuote}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              isByRequest
                ? "flex-1 bg-gradient-primary text-primary-foreground glow-primary"
                : "border border-primary/40 text-foreground hover:bg-primary/10"
            }`}
          >
            <FileText className="h-4 w-4" /> Заявка
          </button>
        </div>
      </div>

      {/* Лайтбокс для фото */}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-5xl w-[min(98vw,64rem)] bg-background/95" bodyClassName="p-2">
          <DialogTitle className="sr-only">{item.title} — просмотр фото</DialogTitle>
          <DialogDescription className="sr-only">Полноэкранный просмотр фотографии</DialogDescription>
          {current?.kind === "photo" && (
            <MediaShield className="rounded-xl overflow-hidden">
              <StorageImg
                path={current.src}
                alt={item.title}
                className="w-full max-h-[85vh] object-contain"
                fallbackClassName="w-full aspect-video"
              />
            </MediaShield>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoFrame({ url, title }: { url: string; title: string }) {
  const isYouTube = /youtube\.com|youtu\.be/i.test(url);
  if (isYouTube) {
    let embed = url;
    const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/);
    if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
    return (
      <iframe
        src={embed}
        title={`${title} — видео`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="w-full rounded-2xl bg-black aspect-video glass border-0"
      />
    );
  }
  return <StorageVideo path={url} className="w-full rounded-2xl bg-black aspect-video glass" />;
}
