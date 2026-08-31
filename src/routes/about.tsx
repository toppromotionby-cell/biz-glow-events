import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Target, Sparkles, Award, Rocket, HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "О компании — event-hub.by" },
      { name: "description", content: "event-hub.by — команда event-инженеров и продюсеров в Минске. Зоны, техника, продакшн под ключ с 2016 года." },
      { property: "og:title", content: "О компании event-hub.by" },
      { property: "og:description", content: "10 лет на рынке event-технологий. Более 600 проектов в Беларуси и СНГ." },
      { property: "og:url", content: "https://event-hub.by/about" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/about" }],
  }),
  component: AboutPage,
});

const STATS = [
  { value: "10+", label: "лет на рынке" },
  { value: "600+", label: "проведённых событий" },
  { value: "120K+", label: "гостей под нашей техникой" },
  { value: "48 ч", label: "средний срок сборки" },
];

const VALUES = [
  { icon: Target, title: "Точность", desc: "Тайминги, спецификации и логистика рассчитаны до минут и метров." },
  { icon: Sparkles, title: "Иммерсивность", desc: "Каждая зона — отдельный сценарий взаимодействия гостя с брендом." },
  { icon: HeartHandshake, title: "Партнёрство", desc: "Прозрачные сметы, фиксированные обязательства, поддержка 24/7 в день события." },
  { icon: Rocket, title: "Технологичность", desc: "VR/AR, нейросети, генеративный контент, LED-инсталляции и роботика." },
];

const TEAM = [
  { name: "Алексей К.", role: "CEO, продюсер", bio: "15 лет в event-индустрии, ex-руководитель технических площадок Minsk Arena." },
  { name: "Мария В.", role: "Креативный директор", bio: "Автор иммерсивных сценариев для брендов EPAM, Wargaming, A1." },
  { name: "Дмитрий Р.", role: "Главный инженер", bio: "Сертифицированный специалист по AV, отвечает за все технические риги." },
  { name: "Ольга П.", role: "Руководитель продакшна", bio: "Координирует производство декораций, реквизита и брендинга." },
];

const TIMELINE = [
  { year: "2016", text: "Запуск студии — первые фотозоны и небольшой свет." },
  { year: "2019", text: "Открытие склада 800 м², LED-парк, штатная инженерная команда." },
  { year: "2022", text: "Запуск направления VR/AR и иммерсивных интерактивов." },
  { year: "2024", text: "Цех производства: декорации, арт-объекты, печать." },
  { year: "2026", text: "Платформа event-hub.by — каталог, расчёты и заявки онлайн." },
];

function AboutPage() {
  return (
    <div className="page-shell section-y max-w-6xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Users className="h-3.5 w-3.5" /> О компании
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Мы превращаем мероприятия в опыт, который запоминают
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          event-hub.by — это инженерная и креативная команда из Минска. Мы делаем технику, контент и продакшн для брендов,
          агентств и государственных событий по всей Беларуси и СНГ.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/contacts">
            <Button className="bg-gradient-primary glow-primary">
              Обсудить проект <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/cases">
            <Button variant="outline">Смотреть кейсы</Button>
          </Link>
        </div>
      </header>

      <section aria-label="Цифры" className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-6 text-center">
            <div className="text-3xl md:text-4xl font-display font-bold gradient-text">{s.value}</div>
            <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </section>

      <section aria-labelledby="values-heading" className="mt-20">
        <h2 id="values-heading" className="text-2xl md:text-3xl font-display font-bold">Что для нас важно</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-4 items-stretch">
          {VALUES.map((v) => (
            <div key={v.title} className="glass rounded-2xl p-6 flex h-full flex-col items-center text-center gap-3 md:flex-row md:items-start md:text-left md:gap-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <v.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex flex-1 flex-col items-center md:items-start">
                <h3 className="font-medium leading-snug text-balance">{v.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty max-w-[34ch] md:max-w-none">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="team-heading" className="mt-20">
        <h2 id="team-heading" className="text-2xl md:text-3xl font-display font-bold">Команда</h2>
        <p className="mt-2 text-muted-foreground">Костяк — 18 штатных специалистов и расширяемая команда подрядчиков под каждый проект.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEAM.map((m) => (
            <article key={m.name} className="glass rounded-2xl p-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display font-bold">
                {m.name.split(" ").map((p) => p[0]).join("")}
              </span>
              <h3 className="mt-4 font-medium">{m.name}</h3>
              <div className="text-sm text-primary">{m.role}</div>
              <p className="mt-2 text-sm text-muted-foreground">{m.bio}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="timeline-heading" className="mt-20">
        <h2 id="timeline-heading" className="text-2xl md:text-3xl font-display font-bold">Хронология</h2>
        <ol className="mt-8 space-y-4">
          {TIMELINE.map((t) => (
            <li key={t.year} className="glass rounded-2xl p-5 flex gap-5">
              <div className="font-display font-bold text-2xl text-primary w-20 shrink-0">{t.year}</div>
              <div className="text-muted-foreground">{t.text}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 glass-strong rounded-3xl p-10 text-center">
        <Award className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-2xl md:text-3xl font-display font-bold">Готовы добавить wow-эффект вашему событию?</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Расскажите о задаче — пришлём подборку решений и смету в течение одного рабочего дня.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/contacts"><Button className="bg-gradient-primary glow-primary">Связаться</Button></Link>
          <Link to="/zones"><Button variant="outline">Каталог зон</Button></Link>
        </div>
      </section>
    </div>
  );
}
