import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Zap, Shield, Award, ArrowRight, Gamepad2, Settings2, CalendarCheck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { GuestEstimator } from "@/components/GuestEstimator";
import { CatalogChoiceModal } from "@/components/CatalogChoiceModal";
import { TestimonialsTeaser } from "@/components/TestimonialsTeaser";
import { CONTACT } from "@/lib/contacts";
import type { CatalogType } from "@/lib/catalog.functions";
import { SparkBurst } from "@/components/SparkBurst";
import { DirectionCard } from "@/components/ui/DirectionCard";
import { MediaCard } from "@/components/ui/MediaCard";

import { Toggleable } from "@/lib/site-sections";
import { getHomeData } from "@/lib/home.functions";

// Тяжёлые модалки и формы — лениво (открываются по действию пользователя).
const CatalogQuickView = lazy(() => import("@/components/CatalogQuickView").then(m => ({ default: m.CatalogQuickView })));
const LeadForm = lazy(() => import("@/components/LeadForm").then(m => ({ default: m.LeadForm })));


const BASE_TO_TYPE: Record<string, CatalogType> = {
  "/zones": "zones",
  "/equipment": "tech_equipment",
  "/services": "services",
  "/production": "production_items",
};

const homeQueryOptions = queryOptions({
  queryKey: ["home-data"],
  queryFn: () => getHomeData(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions),
  head: () => ({
    meta: [
      { title: "event-hub.by — Event-технологии и продакшн в Минске" },
      { name: "description", content: "Интерактивные зоны, техническое оснащение, услуги и производство для мероприятий любого масштаба в Беларуси." },
      { property: "og:title", content: "event-hub.by — Event-технологии в Минске" },
      { property: "og:description", content: "VR/AR, LED, фотозоны, BTL, промо-персонал, производство декораций." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

const FEATURES = [
  { icon: Gamepad2, title: "Интерактивные зоны", desc: "VR/AR, геймификация, фотозоны и иммерсивные активности", to: "/zones" as const },
  { icon: Settings2, title: "Техническое оснащение мероприятий", desc: "Звук, свет, LED-экраны и сцена под ключ", to: "/equipment" as const },
  { icon: CalendarCheck, title: "Организация мероприятий под ключ", desc: "Концепция, площадка, подрядчики, монтаж, координация — мы берём всё", to: "/services" as const },
  { icon: Package, title: "Производство", desc: "Декорации, баннеры, арт-объекты, реквизит", to: "/production" as const },
];

const VALUES = [
  { icon: Zap, title: "Скорость", desc: "От заявки до сметы — 24 часа" },
  { icon: Shield, title: "Надёжность", desc: "Резервное оборудование на каждом проекте" },
  { icon: Award, title: "Качество", desc: "200+ реализованных мероприятий" },
];

function HomePage() {
  const { data } = useSuspenseQuery(homeQueryOptions);
  const { featured, posts, cases } = data;
  const [quick, setQuick] = useState<{ type: CatalogType; slug: string; basePath: string } | null>(null);
  const [orderTopic, setOrderTopic] = useState<string | null>(null);

  return (
    <div>
      {/* HERO — spark burst */}
      <Toggleable sectionKey="home.hero" as="section" className="relative overflow-hidden min-h-[92vh] flex items-center">
        <SparkBurst />
        <div className="container mx-auto px-4 py-10 md:py-12 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-accent mb-8">
              <Sparkles className="h-3 w-3" /> КОРПОРАТИВНЫЕ МЕРОПРИЯТИЯ И ВСЕ ДЛЯ НИХ / ВСЯ БЕЛАРУСЬ
            </div>
            <h1 className="font-display font-black leading-[0.95] tracking-tight text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-8">
              <span className="hero-accent-text block">
                Создаём
              </span>
              <span className="block text-foreground">Незабываемые</span>
              <span className="block text-foreground">События</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Полный цикл event-производства: от идеи до финального аккорда.
              Интерактивные зоны, техническое оснащение, шоу-программы и декорации.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center mb-16">
              <CatalogChoiceModal>
                <Button size="lg" className="rounded-full px-8 h-12 bg-gradient-primary glow-primary-lg text-primary-foreground font-semibold w-full sm:w-auto">
                  Каталог услуг <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CatalogChoiceModal>
            </div>
          </div>
        </div>
      </Toggleable>


      {/* DIRECTIONS */}
      <Toggleable sectionKey="home.directions" as="section" className="container mx-auto px-4 pb-16 md:pb-20">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-12 text-center">Направления</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <DirectionCard key={f.title} icon={f.icon} title={f.title} description={f.desc} to={f.to} />
          ))}
        </div>
      </Toggleable>

      {/* FEATURED CATALOG */}
      {featured.length > 0 && (
        <Toggleable sectionKey="home.featured" as="section" className="container mx-auto px-4 pb-16 md:pb-20 border-t border-border/40">
          <div className="mb-8 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Наши рекомендации</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {featured.map((f, idx) => {
              const type = BASE_TO_TYPE[f.basePath] ?? "tech_equipment";
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQuick({ type, slug: f.slug, basePath: f.basePath })}
                  className="group glass rounded-xl sm:rounded-2xl overflow-hidden hover:border-primary/50 transition block text-left w-full flex flex-col h-full"
                  aria-label={`Открыть ${f.title}`}
                >
                  <div className="aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-gradient-primary/10">
                    {f.photo_urls?.[0] ? (
                      <img
                        src={f.photo_urls[0]} alt={f.title}
                        width={640} height={400}
                        loading={idx === 0 ? "eager" : "lazy"}
                        fetchPriority={idx === 0 ? "high" : "auto"}
                        decoding="async"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-3.5 sm:p-4 lg:p-5 flex-1 flex flex-col">
                    <h3 className="font-display font-semibold text-base sm:text-lg leading-tight group-hover:text-primary transition">{f.title}</h3>
                    {f.short_description && (
                      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground flex-1 line-clamp-3 sm:line-clamp-4">
                        {f.short_description.length > 300 ? f.short_description.slice(0, 300) + '…' : f.short_description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {quick && (
            <Suspense fallback={null}>
              <CatalogQuickView
                open={!!quick}
                onOpenChange={(v) => { if (!v) setQuick(null); }}
                type={quick.type}
                slug={quick.slug}
                basePath={quick.basePath}
              />
            </Suspense>
          )}

        </Toggleable>
      )}

      {/* VALUES */}
      <Toggleable sectionKey="home.values" as="section" className="container mx-auto px-4 pb-16 md:pb-20 border-t border-border/40">
        <div className="grid md:grid-cols-3 gap-8">
          {VALUES.map((v) => (
            <div key={v.title} className="flex flex-col items-center text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full glass mb-4 animate-pulse-glow pointer-events-none select-none" aria-hidden="true">
                <v.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-display font-semibold text-xl mb-2">{v.title}</h3>
              <p className="text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </Toggleable>

      {/* CASES */}
      {cases.length > 0 && (
        <Toggleable sectionKey="home.cases" as="section" className="container mx-auto px-4 border-t border-border/40">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Наши кейсы</h2>
              <p className="mt-2 text-muted-foreground">Реализованные мероприятия — от корпоративов до фестивалей.</p>
            </div>
            <Link to="/cases" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Все кейсы <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {cases.map((c) => (
              <MediaCard
                key={c.id}
                cover={c.cover_url}
                alt={c.title}
                to="/cases/$slug"
                params={{ slug: c.slug }}
              >
                {c.event_type && <div className="text-xs uppercase tracking-wide text-primary">{c.event_type}</div>}
                <h3 className="mt-1 font-semibold leading-tight group-hover:text-primary transition">{c.title}</h3>
                {c.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.summary}</p>}
                {c.guests_count && <div className="mt-2 text-xs text-muted-foreground">{c.guests_count.toLocaleString("ru-BY")} гостей</div>}
              </MediaCard>
            ))}
          </div>
        </Toggleable>
      )}

      {/* GUEST ESTIMATOR */}
      <Toggleable sectionKey="home.estimator"><GuestEstimator /></Toggleable>

      {/* TESTIMONIALS */}
      <Toggleable sectionKey="home.testimonials"><TestimonialsTeaser /></Toggleable>

      {/* BLOG TEASER */}
      {posts.length > 0 && (
        <Toggleable sectionKey="home.blog" as="section" className="container mx-auto px-4 border-t border-border/40">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Из блога</h2>
            <Link to="/blog" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Все материалы <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {posts.map((p) => (
              <MediaCard
                key={p.id}
                cover={p.cover_url}
                alt={p.title}
                to="/blog/$slug"
                params={{ slug: p.slug }}
              >
                {p.published_at && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {new Date(p.published_at).toLocaleDateString("ru-BY", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
                <h3 className="font-semibold leading-tight group-hover:text-primary transition">{p.title}</h3>
                {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
              </MediaCard>
            ))}
          </div>
        </Toggleable>
      )}

      {/* CTA */}
      <Toggleable sectionKey="home.cta" as="section" className="container mx-auto px-4">
        <div className="glass-strong rounded-3xl p-10 md:p-16 text-center bg-gradient-to-br from-primary/10 to-transparent">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">Готовы обсудить ваше мероприятие?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Зарегистрируйтесь, чтобы получить доступ к ценам, сохранённым сметам и истории заказов.
          </p>
          <Link to="/register"><Button size="lg" className="bg-gradient-primary glow-primary-lg">
            Начать сотрудничество <ArrowRight className="ml-2 h-4 w-4" />
          </Button></Link>
        </div>
      </Toggleable>

      {/* ORDER SERVICES — перед подвалом */}
      <Toggleable sectionKey="home.order" as="section" className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Заказ услуг</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Выберите направление и оформите заявку — мы соберём смету и свяжемся в течение 24 часов.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <DirectionCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              description={f.desc}
              footer={
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full bg-gradient-primary"
                    onClick={() => setOrderTopic(f.title)}
                  >
                    Заказать <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                  <Link to={f.to} className="text-xs text-muted-foreground hover:text-primary transition text-center">
                    Посмотреть каталог
                  </Link>
                </div>
              }
            />
          ))}
        </div>
        <div className="mt-12 glass-strong rounded-3xl p-8 md:p-12 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-8">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
                <Sparkles className="h-3 w-3" /> Индивидуальное решение
              </div>
              <h3 className="font-display font-bold text-2xl md:text-3xl mb-2">Не нашли подходящее?</h3>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl">
                Опишите задачу — подберём решение под ваш бюджет, формат и сроки. Бесплатный расчёт за 24 часа.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <Button
                size="lg"
                onClick={() => setOrderTopic("Индивидуальный запрос")}
                className="btn-orange-shine rounded-full px-8 h-12 font-semibold"
              >
                Оставить заявку <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Toggleable>

      {/* Диалог быстрого заказа */}
      <OrderDialog topic={orderTopic} onClose={() => setOrderTopic(null)} />
    </div>
  );
}

// === Диалог «Заказать»: форма + контакты ===
function OrderDialog({ topic, onClose }: { topic: string | null; onClose: () => void }) {
  const open = !!topic;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-primary px-6 py-5 text-primary-foreground">
          <DialogTitle className="font-display text-2xl font-bold leading-tight">
            Заявка на услугу
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/85 mt-1 text-sm">
            {topic ? <>Направление: <span className="font-medium">{topic}</span>. </> : null}
            Заполните форму — менеджер свяжется в течение 24 часов.
          </DialogDescription>
        </div>
        <div className="px-6 pt-5 pb-6 max-h-[70vh] overflow-y-auto">
          <LeadForm source={topic ? `home_order:${topic}` : "home_order"} />
          <div className="mt-6 pt-5 border-t border-border/60">
            <h4 className="font-display font-semibold text-base mb-3">Контакты</h4>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: "E-mail", value: CONTACT.email, href: `mailto:${CONTACT.email}`, breakAll: true },
                { label: "Адрес", value: CONTACT.address },
                { label: "Часы работы", value: CONTACT.hours, span: true },
              ].map((c) => {
                const cls = `glass rounded-lg p-3 ${c.span ? "sm:col-span-2" : ""} ${c.href ? "hover:border-primary/50 transition" : ""}`;
                const body = (
                  <>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className={`font-medium ${c.breakAll ? "break-all" : ""}`}>{c.value}</div>
                  </>
                );
                return c.href
                  ? <a key={c.label} href={c.href} className={cls}>{body}</a>
                  : <div key={c.label} className={cls}>{body}</div>;
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
