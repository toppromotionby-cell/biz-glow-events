// Universal catalog detail view: gallery, description, features, FAQ, JSON-LD.
import { Link } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import type { CatalogRow, CatalogType } from "@/lib/catalog.functions";
import { MediaShield } from "@/components/MediaShield";
import { PriceGate } from "@/components/PriceGate";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WishlistButton } from "@/components/WishlistButton";
import { RelatedItems } from "@/components/RelatedItems";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { trackView } from "@/lib/recent";

function priceFrom(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== "object") return null;
  const p = pricing as Record<string, unknown>;
  const v = p.from ?? p.priceFrom ?? p.min ?? p.base;
  return typeof v === "number" ? v : null;
}

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
  const [active, setActive] = useState(0);
  const cover = photos[active];
  const from = priceFrom(item.pricing);
  const features = asArray<string>(item.features);
  const faq = asArray<{ q?: string; a?: string }>(item.faq);

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <Link to={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {backLabel}</Link>

      <div className="mt-6 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3">
          {cover ? (
            <MediaShield className="rounded-2xl overflow-hidden aspect-[16/10] glass">
              <img src={cover} alt={item.title} className="h-full w-full object-cover" loading="eager" />
            </MediaShield>
          ) : (
            <div className="rounded-2xl aspect-[16/10] glass flex items-center justify-center text-muted-foreground">
              Нет изображения
            </div>
          )}
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.slice(0, 5).map((p, i) => (
                <button key={p} onClick={() => setActive(i)}
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

          <div className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">Стоимость</div>
            <PriceGate>
              <div className="text-2xl font-display font-bold">
                {from !== null ? `от ${new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(from)}` : "По запросу"}
              </div>
            </PriceGate>
            <Link to="/contacts" className="mt-4 inline-flex w-full justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
              Заказать
            </Link>
            <AddToCartButton
              entity_type={entityType}
              id={item.id}
              slug={item.slug}
              title={item.title}
              price={from ?? 0}
              image={item.photo_urls?.[0] ?? null}
            />
            <WishlistButton
              entity_type={entityType}
              id={item.id}
              slug={item.slug}
              title={item.title}
              price={from ?? 0}
              image={item.photo_urls?.[0] ?? null}
            />
            <Link to="/cart" className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground">Перейти в заявку →</Link>
          </div>

          {features.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h2 className="font-semibold mb-3">Что входит</h2>
              <ul className="space-y-2 text-sm">
                {features.map((f, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{String(f)}</span></li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {item.description && (
        <section className="mt-12 prose prose-invert max-w-3xl">
          <h2 className="text-2xl font-display font-semibold">Описание</h2>
          <p className="whitespace-pre-wrap text-foreground/90">{item.description}</p>
        </section>
      )}

      {item.requirements && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-display font-semibold">Технические требования</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.requirements}</p>
        </section>
      )}

      {faq.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-display font-semibold mb-4">Частые вопросы</h2>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <details key={i} className="glass rounded-lg p-4">
                <summary className="cursor-pointer font-medium">{f.q ?? "Вопрос"}</summary>
                <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{f.a ?? ""}</div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function productJsonLd(item: CatalogRow): string {
  const from = priceFrom(item.pricing);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.short_description ?? item.description ?? undefined,
    image: item.photo_urls ?? undefined,
    brand: { "@type": "Brand", name: "event-hub.by" },
    offers: from !== null ? {
      "@type": "Offer",
      priceCurrency: "BYN",
      price: from,
      availability: "https://schema.org/InStock",
      url: "https://event-hub.by/contacts",
    } : undefined,
  });
}
