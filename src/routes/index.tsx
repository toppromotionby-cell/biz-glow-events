import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Zap, Shield, Award, ArrowRight, Cpu, Lightbulb, Music, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GuestEstimator } from "@/components/GuestEstimator";
import { CatalogChoiceModal } from "@/components/CatalogChoiceModal";
import { TestimonialsTeaser } from "@/components/TestimonialsTeaser";
import { Toggleable } from "@/lib/site-sections";

export const Route = createFileRoute("/")({
  component: HomePage,
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
  { icon: Cpu, title: "VR/AR & интерактив", desc: "Иммерсивные зоны, геймификация, фотостены", to: "/zones" as const },
  { icon: Music, title: "Звук и свет", desc: "Профессиональное оборудование под ключ", to: "/equipment" as const },
  { icon: Lightbulb, title: "LED-экраны", desc: "Любых размеров, монтаж в день мероприятия", to: "/equipment" as const },
  { icon: Package, title: "Производство", desc: "Декорации, баннеры, арт-объекты, реквизит", to: "/production" as const },
];

const VALUES = [
  { icon: Zap, title: "Скорость", desc: "От заявки до сметы — 24 часа" },
  { icon: Shield, title: "Надёжность", desc: "Резервное оборудование на каждом проекте" },
  { icon: Award, title: "Качество", desc: "200+ реализованных мероприятий" },
];

type Featured = { id: string; slug: string; title: string; short_description: string | null; photo_urls: string[] | null; basePath: string };
type BlogTeaser = { id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null; published_at: string | null };
type CaseTeaser = { id: string; slug: string; title: string; summary: string | null; cover_url: string | null; event_type: string | null; guests_count: number | null };

function HomePage() {
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [posts, setPosts] = useState<BlogTeaser[]>([]);
  const [cases, setCases] = useState<CaseTeaser[]>([]);

  useEffect(() => {
    (async () => {
      const tables = [
        { name: "zones" as const, base: "/zones" },
        { name: "tech_equipment" as const, base: "/equipment" },
        { name: "services" as const, base: "/services" },
        { name: "production_items" as const, base: "/production" },
      ];
      const results = await Promise.all(
        tables.map((t) =>
          supabase
            .from(t.name)
            .select("id, slug, title, short_description, photo_urls")
            .eq("published", true)
            .order("updated_at", { ascending: false })
            .limit(2)
            .then((r) => (r.data ?? []).map((row) => ({ ...row, basePath: t.base }) as Featured)),
        ),
      );
      setFeatured(results.flat().slice(0, 6));

      const { data: blog } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(3);
      setPosts((blog ?? []) as BlogTeaser[]);

      const { data: cs } = await supabase
        .from("cases")
        .select("id, slug, title, summary, cover_url, event_type, guests_count")
        .eq("published", true)
        .order("event_date", { ascending: false, nullsFirst: false })
        .limit(3);
      setCases((cs ?? []) as CaseTeaser[]);
    })();
  }, []);

  return (
    <div>
      {/* HERO */}
      <Toggleable sectionKey="home.hero" as="section" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.55_0.24_295/0.25),transparent_60%)] animate-gradient" />
        <div className="container mx-auto px-4 py-24 md:py-36 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-6">
              <Sparkles className="h-3 w-3 text-accent" /> Event-технологии нового поколения
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.05] mb-6">
              Превращаем идеи <br />в <span className="gradient-text">незабываемые события</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-8">
              Полный цикл event-производства в Беларуси: интерактивные зоны, техническое оснащение,
              маркетинговые активации и декорации под ключ.
            </p>
            <div className="flex flex-wrap gap-3">
              <CatalogChoiceModal>
                <Button size="lg" className="bg-gradient-primary glow-primary-lg">
                  Смотреть каталог <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CatalogChoiceModal>
              <Link to="/contacts"><Button size="lg" variant="outline">Получить смету</Button></Link>
            </div>
          </div>
        </div>
      </Toggleable>

      {/* DIRECTIONS */}
      <Toggleable sectionKey="home.directions" as="section" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-12 text-center">Направления</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <Link key={f.title} to={f.to} className="glass rounded-2xl p-6 hover:border-primary/50 transition group block">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary mb-4 group-hover:glow-primary transition">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </Link>
          ))}
        </div>
      </Toggleable>

      {/* FEATURED CATALOG */}
      {featured.length > 0 && (
        <Toggleable sectionKey="home.featured" as="section" className="container mx-auto px-4 py-16 border-t border-border/40">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Из нашего каталога</h2>
            <Link to="/equipment" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Весь каталог <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((f, idx) => (
              <a
                key={f.id}
                href={`${f.basePath}/${f.slug}`}
                className="group glass rounded-xl overflow-hidden hover:border-primary/50 transition block"
              >
                <div className="aspect-[16/10] overflow-hidden bg-gradient-primary/10">
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
                <div className="p-4">
                  <h3 className="font-semibold leading-tight group-hover:text-primary transition">{f.title}</h3>
                  {f.short_description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{f.short_description}</p>}
                </div>
              </a>
            ))}
          </div>

        </Toggleable>
      )}

      {/* VALUES */}
      <Toggleable sectionKey="home.values" as="section" className="container mx-auto px-4 py-20 border-t border-border/40">
        <div className="grid md:grid-cols-3 gap-8">
          {VALUES.map((v) => (
            <div key={v.title} className="text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full glass mb-4 animate-pulse-glow">
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
        <Toggleable sectionKey="home.cases" as="section" className="container mx-auto px-4 py-16 border-t border-border/40">
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
              <Link key={c.id} to="/cases/$slug" params={{ slug: c.slug }} className="group glass rounded-xl overflow-hidden hover:border-primary/50 transition">
                <div className="aspect-[16/10] bg-gradient-primary/10 overflow-hidden">
                  {c.cover_url && <img src={c.cover_url} alt={c.title} width={640} height={400} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                </div>
                <div className="p-4">
                  {c.event_type && <div className="text-xs uppercase tracking-wide text-primary">{c.event_type}</div>}
                  <h3 className="mt-1 font-semibold leading-tight group-hover:text-primary transition">{c.title}</h3>
                  {c.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.summary}</p>}
                  {c.guests_count && <div className="mt-2 text-xs text-muted-foreground">{c.guests_count.toLocaleString("ru-BY")} гостей</div>}
                </div>
              </Link>
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
        <Toggleable sectionKey="home.blog" as="section" className="container mx-auto px-4 py-16 border-t border-border/40">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Из блога</h2>
            <Link to="/blog" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Все материалы <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="group glass rounded-xl overflow-hidden hover:border-primary/50 transition"
              >
                <div className="aspect-[16/10] bg-gradient-primary/10 overflow-hidden">
                  {p.cover_url && <img src={p.cover_url} alt={p.title} width={640} height={400} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                </div>
                <div className="p-4">
                  {p.published_at && (
                    <div className="text-xs text-muted-foreground mb-1">
                      {new Date(p.published_at).toLocaleDateString("ru-BY", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                  <h3 className="font-semibold leading-tight group-hover:text-primary transition">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        </Toggleable>
      )}

      {/* CTA */}
      <Toggleable sectionKey="home.cta" as="section" className="container mx-auto px-4 py-20">
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
    </div>
  );
}
