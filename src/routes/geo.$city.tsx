// Локальное SEO: посадочные под гео-запросы (Минск, Гомель, Брест, Гродно, Витебск, Могилёв).
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { QuickQuoteForm } from "@/components/QuickQuoteForm";
import { safeJsonLd } from "@/lib/seo-jsonld";

type City = {
  slug: string;
  name: string;     // именительный
  inLocative: string; // «в Минске»
  region: string;
  delivery: string;
  phone: string;
  intro: string;
};

const CITIES: Record<string, City> = {
  minsk: {
    slug: "minsk", name: "Минск", inLocative: "в Минске",
    region: "Минская область",
    delivery: "В пределах МКАД доставка и монтаж — бесплатно. За МКАД — по тарифу.",
    phone: "+375 (29) 000-00-00",
    intro: "Event-агентство в Минске: интерактивные зоны, оборудование, фотозоны, аниматоры, кейтеринг. Работаем по всей Беларуси, базовая команда — в столице.",
  },
  gomel: {
    slug: "gomel", name: "Гомель", inLocative: "в Гомеле",
    region: "Гомельская область",
    delivery: "Командировочный сбор + транспорт. Заказы от 1500 BYN — без сбора.",
    phone: "+375 (29) 000-00-00",
    intro: "Event-продакшн в Гомеле: оборудование под ключ, ивент-зоны, BTL и корпоративные мероприятия. Выезжаем со всем оборудованием из Минска.",
  },
  brest: {
    slug: "brest", name: "Брест", inLocative: "в Бресте",
    region: "Брестская область",
    delivery: "Командировочный сбор + транспорт. Заказы от 1500 BYN — без сбора.",
    phone: "+375 (29) 000-00-00",
    intro: "Event-агентство в Бресте: проведём свадьбу, корпоратив, конференцию. LED-экраны, фотозоны, интерактивы.",
  },
  grodno: {
    slug: "grodno", name: "Гродно", inLocative: "в Гродно",
    region: "Гродненская область",
    delivery: "Командировочный сбор + транспорт. Заказы от 1500 BYN — без сбора.",
    phone: "+375 (29) 000-00-00",
    intro: "Организация мероприятий в Гродно: интерактивные зоны, аренда LED-экранов и звука, фотозоны и аниматоры.",
  },
  vitebsk: {
    slug: "vitebsk", name: "Витебск", inLocative: "в Витебске",
    region: "Витебская область",
    delivery: "Командировочный сбор + транспорт. Заказы от 1500 BYN — без сбора.",
    phone: "+375 (29) 000-00-00",
    intro: "Event-услуги в Витебске: «Славянский базар», корпоративы, фестивали — оборудование, инсталляции, продакшн.",
  },
  mogilev: {
    slug: "mogilev", name: "Могилёв", inLocative: "в Могилёве",
    region: "Могилёвская область",
    delivery: "Командировочный сбор + транспорт. Заказы от 1500 BYN — без сбора.",
    phone: "+375 (29) 000-00-00",
    intro: "Event-продакшн в Могилёве: интерактивы, шоу-программы, аренда оборудования. Доставка из Минска.",
  },
};

const BASE = "https://event-hub.by";

export const Route = createFileRoute("/geo/$city")({
  loader: ({ params }) => {
    const city = CITIES[params.city];
    if (!city) throw notFound();
    return { city };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.city;
    if (!c) return {};
    const url = `${BASE}/geo/${c.slug}`;
    const title = `Event-агентство ${c.inLocative} — оборудование, зоны, услуги | event-hub.by`;
    const desc = `Организация мероприятий ${c.inLocative}: интерактивные зоны, аренда оборудования, фотозоны, аниматоры. Доставка по ${c.region}. Бесплатный расчёт за 1 час.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { name: "geo.region", content: "BY" },
        { name: "geo.placename", content: c.name },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: `event-hub.by — ${c.name}`,
            url,
            areaServed: { "@type": "City", name: c.name },
            address: { "@type": "PostalAddress", addressLocality: c.name, addressRegion: c.region, addressCountry: "BY" },
            telephone: c.phone,
          }),
        },
      ],
    };
  },
  component: GeoCityPage,
  notFoundComponent: () => (
    <div className="page-shell section-y text-center">
      <h1 className="text-3xl font-display font-bold gradient-text">Город не найден</h1>
      <p className="mt-3 text-muted-foreground">Мы работаем в крупнейших городах Беларуси.</p>
      <Link to="/" className="mt-6 inline-block underline">На главную</Link>
    </div>
  ),
  errorComponent: () => <div className="page-shell section-y text-center text-muted-foreground">Ошибка загрузки</div>,
});

function GeoCityPage() {
  const { city } = Route.useLoaderData();
  return (
    <main className="page-shell py-12 max-w-5xl">
      <nav className="text-xs text-muted-foreground"><Link to="/">Главная</Link> / География / <span>{city.name}</span></nav>
      <h1 className="mt-3 font-display font-bold gradient-text">Event-услуги {city.inLocative}</h1>
      <p className="mt-4 text-lg text-foreground/90 max-w-3xl">{city.intro}</p>

      <section className="mt-10 grid sm:grid-cols-3 gap-4">
        {[
          { t: "Интерактивные зоны", h: "/zones", d: "VR/AR, фотозоны, селфи-стенды, нейро-интерактивы" },
          { t: "Аренда оборудования", h: "/equipment", d: "LED-экраны, звук, свет, проекция, сцены" },
          { t: "Услуги под ключ", h: "/services", d: "Аниматоры, ведущие, артисты, кейтеринг, декор" },
        ].map((card) => (
          <Link key={card.t} to={card.h} className="glass rounded-xl p-5 hover:border-primary/40 transition">
            <div className="font-display font-semibold">{card.t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{card.d}</div>
          </Link>
        ))}
      </section>

      <section className="mt-10 glass rounded-xl p-6 max-w-3xl">
        <h2 className="font-display font-semibold text-xl">Доставка и работа в {city.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{city.delivery}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-display font-semibold text-xl mb-4">Получить расчёт {city.inLocative}</h2>
        <Suspense fallback={null}>
          <QuickQuoteForm itemTitle={`Заявка из ${city.name}`} source={`geo:${city.slug}`} />
        </Suspense>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display font-semibold text-xl mb-4">Частые вопросы</h2>
        <div className="space-y-2">
          {[
            { q: `Сколько стоит организация мероприятия ${city.inLocative}?`, a: "Базовый пакет — от 1500 BYN. Точная цена зависит от формата, длительности и количества гостей. Бесплатный расчёт за 1 час." },
            { q: `Доставите оборудование в ${city.name}?`, a: city.delivery },
            { q: "Сколько занимает монтаж?", a: "Стандартный монтаж — 2-4 часа в зависимости от сложности зоны и объёма оборудования." },
          ].map((f) => (
            <details key={f.q} className="glass rounded-lg p-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <div className="mt-2 text-sm text-muted-foreground">{f.a}</div>
            </details>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: `Сколько стоит организация мероприятия ${city.inLocative}?`, acceptedAnswer: { "@type": "Answer", text: "Базовый пакет — от 1500 BYN. Точная цена зависит от формата, длительности и количества гостей." } },
              { "@type": "Question", name: `Доставите оборудование в ${city.name}?`, acceptedAnswer: { "@type": "Answer", text: city.delivery } },
            ],
          }) }}
        />
      </section>
    </main>
  );
}
