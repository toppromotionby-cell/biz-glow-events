// Лендинги под рекламные кампании: /lp/svadba, /lp/korporativ, /lp/konferencii.
// Узкий фокус на одну индустрию + быстрый расчёт. UTM ловится глобально в __root.
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Heart, Briefcase, Mic, Check, ArrowRight, Star } from "lucide-react";
import { QuickQuoteForm } from "@/components/QuickQuoteForm";
import { safeJsonLd } from "@/lib/seo-jsonld";

type LP = {
  slug: string;
  icon: typeof Heart;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  proof: string;
  ctaHint: string;
  scale: string;
  faq: { q: string; a: string }[];
  metaTitle: string;
  metaDescription: string;
};

const LPS: Record<string, LP> = {
  svadba: {
    slug: "svadba",
    icon: Heart,
    eyebrow: "Свадьбы под ключ",
    title: "Свадьба, которую запомнят гости",
    subtitle: "Декор, свет, фотозоны и оборудование. Берём на себя всю техническую часть — вы наслаждаетесь днём.",
    bullets: [
      "Свадебные арки и цветочные инсталляции",
      "Кинематографичный свет и проекции",
      "Танцпол, DJ-оборудование, line-array звук",
      "Координация на площадке + резервная техника",
    ],
    proof: "Более 200 свадеб за 2023–2025 годы",
    ctaHint: "Получите смету за 15 минут",
    scale: "30–300 гостей",
    faq: [
      { q: "За сколько нужно бронировать?", a: "Для пиковых дат (май–сентябрь, суббота) — за 3–6 месяцев. В будни и межсезонье — за 2–4 недели." },
      { q: "Можно ли арендовать только декор?", a: "Да. Минимальный заказ — от 1500 BYN. Доставка по Минску — бесплатно от 2500 BYN." },
      { q: "Что если погода испортится?", a: "Подбираем резервные варианты — крытые шатры, перенос декора в зал, влагозащита для техники." },
    ],
    metaTitle: "Свадьба под ключ — декор, свет, оборудование | Event Hub",
    metaDescription: "Организация свадеб в Минске и по Беларуси: арки, фотозоны, свет, звук. Расчёт за 15 минут.",
  },
  korporativ: {
    slug: "korporativ",
    icon: Briefcase,
    eyebrow: "Корпоративные мероприятия",
    title: "Корпоратив с фокусом на ваш бренд",
    subtitle: "Тимбилдинги, юбилеи, новогодние праздники. LED-сцены, брендированные фотозоны и подача под ключ.",
    bullets: [
      "Брендированные фотозоны и press-wall",
      "LED-сцены, presentation kit, тач-панели",
      "Звук, видео, синхронный перевод",
      "Кейтеринг-зоны и интерактивные активности",
    ],
    proof: "Работаем с топ-50 компаний Беларуси",
    ctaHint: "Просчитаем бюджет за 15 минут",
    scale: "50–1500 гостей",
    faq: [
      { q: "Можно безналичный расчёт и закрывающие?", a: "Да. Работаем по договору, ЭСЧФ, акты — стандартный документооборот." },
      { q: "Согласуете концепцию с маркетингом?", a: "Да, делаем 2–3 варианта концепции и работаем по правкам бренд-бука." },
      { q: "Есть ли гарантия по технике?", a: "Резервный комплект на каждой площадке, инженер на связи 24/7 в день мероприятия." },
    ],
    metaTitle: "Корпоративные мероприятия в Минске — Event Hub",
    metaDescription: "Корпоративы, тимбилдинги, юбилеи. Брендирование, LED, звук, кейтеринг. Расчёт за 15 минут.",
  },
  konferencii: {
    slug: "konferencii",
    icon: Mic,
    eyebrow: "Конференции и форумы",
    title: "Конференция без технических сюрпризов",
    subtitle: "Сцены, экраны, синхронный перевод, регистрация. Подключаемся за неделю, тестируем за день.",
    bullets: [
      "LED-экраны и presentation system",
      "Синхронный перевод, кабины, гарнитуры",
      "Регистрация, бейджи, навигация",
      "Запись и трансляция на YouTube/VK",
    ],
    proof: "Проводили IT-форумы на 2000+ участников",
    ctaHint: "Подберём комплект за 15 минут",
    scale: "100–3000 участников",
    faq: [
      { q: "Делаете онлайн-трансляцию?", a: "Да. Многокамерная съёмка, режиссёрский пульт, стрим на YouTube, VK, Telegram." },
      { q: "Есть ли резервное оборудование?", a: "Дублирование критичных систем (звук, видео, перевод) входит в стандартную смету для 300+ участников." },
      { q: "Сколько монтажа нужно?", a: "Стандартно — 1 день монтаж, день мероприятия, ½ дня демонтаж. Точнее после техосмотра площадки." },
    ],
    metaTitle: "Конференции и форумы — техническое оснащение | Event Hub",
    metaDescription: "Организация конференций: LED-экраны, синхронный перевод, трансляция, регистрация. Расчёт за 15 минут.",
  },
};

export const Route = createFileRoute("/lp/$slug")({
  loader: ({ params }) => {
    const lp = LPS[params.slug];
    if (!lp) throw notFound();
    return { lp };
  },
  head: ({ loaderData }) => {
    const lp = loaderData?.lp;
    if (!lp) return { meta: [{ title: "Лендинг | Event Hub" }] };
    return {
      meta: [
        { title: lp.metaTitle },
        { name: "description", content: lp.metaDescription },
        { property: "og:title", content: lp.metaTitle },
        { property: "og:description", content: lp.metaDescription },
        { name: "robots", content: "index, follow" },
      ],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  const { lp } = Route.useLoaderData() as { lp: LP };
  const Icon = lp.icon;

  return (
    <div className="bg-radial-glow">
      {/* Hero */}
      <section className="page-shell py-12 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {lp.eyebrow} · {lp.scale}
            </div>
            <h1 className="mt-4 text-4xl font-display font-bold leading-tight md:text-5xl">{lp.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{lp.subtitle}</p>
            <ul className="mt-6 space-y-2.5">
              {lp.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#quote" className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground glow-primary">
                {lp.ctaHint} <ArrowRight className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span>4.9 · {lp.proof}</span>
              </div>
            </div>
          </div>

          {/* Quote form */}
          <div id="quote" className="rounded-2xl border border-border/60 bg-card/60 p-1 backdrop-blur">
            <QuickQuoteForm itemTitle={lp.title} source={`lp:${lp.slug}`} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="page-shell pb-16 md:pb-24">
        <h2 className="text-2xl font-display font-bold md:text-3xl">Частые вопросы</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {lp.faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <p className="font-semibold">{f.q}</p>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link to="/cases" className="text-sm text-primary underline-offset-4 hover:underline">Посмотреть кейсы</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/contacts" className="text-sm text-primary underline-offset-4 hover:underline">Связаться напрямую</Link>
        </div>
      </section>

      {/* JSON-LD FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: lp.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </div>
  );
}
