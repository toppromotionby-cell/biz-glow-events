import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Heart, Music, GraduationCap, PartyPopper, Trophy, Briefcase, Tv, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Industry = {
  slug: string;
  icon: typeof Building2;
  title: string;
  lead: string;
  bullets: string[];
  scale: string;
};

const INDUSTRIES: Industry[] = [
  {
    slug: "corporate",
    icon: Briefcase,
    title: "Корпоративные мероприятия",
    lead: "Конференции, тимбилдинги, юбилеи компании — под ключ, с фокусом на бренд.",
    bullets: ["Брендированные фотозоны", "LED-сцены и presentation kit", "Кейтеринг-зоны и нетворкинг"],
    scale: "50–1500 гостей",
  },
  {
    slug: "weddings",
    icon: Heart,
    title: "Свадьбы и юбилеи",
    lead: "Романтичные локации, цветочные арки, кинематографичный свет.",
    bullets: ["Свадебные арки и фотозоны", "Декоративный свет и проекции", "Танцпол и DJ-оборудование"],
    scale: "30–300 гостей",
  },
  {
    slug: "festivals",
    icon: Music,
    title: "Фестивали и open-air",
    lead: "Уличные сцены, мощный звук, инсталляции и интерактивы.",
    bullets: ["Сценический комплекс до 30 м", "Звук line-array", "VJ-системы и LED-mapping"],
    scale: "1000–10 000+ гостей",
  },
  {
    slug: "education",
    icon: GraduationCap,
    title: "Образовательные ивенты",
    lead: "Школьные выпускные, университетские форумы, олимпиады.",
    bullets: ["Декор и брендирование", "Звук + презентационный экран", "Фотозоны и аниматоры"],
    scale: "100–800 гостей",
  },
  {
    slug: "exhibitions",
    icon: Building2,
    title: "Выставки и форумы",
    lead: "Стенды, презентационные зоны, инсталляции для B2B-аудитории.",
    bullets: ["Модульные стенды", "Интерактивные тач-панели", "VR-демо и AR-зеркала"],
    scale: "до 5000 посетителей",
  },
  {
    slug: "private",
    icon: PartyPopper,
    title: "Частные праздники",
    lead: "Дни рождения, бэби-шауэры, девичники — в любимой эстетике.",
    bullets: ["Тематические фотозоны", "Декор, шары, цветы", "Звук и интерактив"],
    scale: "10–150 гостей",
  },
  {
    slug: "sport",
    icon: Trophy,
    title: "Спортивные события",
    lead: "Награждения, турниры, презентации команд и спонсорские активации.",
    bullets: ["Сцена-подиум для награждений", "LED-табло и звук", "Брендированные зоны"],
    scale: "200–5000 гостей",
  },
  {
    slug: "media",
    icon: Tv,
    title: "Медиа-производство",
    lead: "Съёмки клипов, рекламы, шоу — аренда декораций и техники для съёмочной группы.",
    bullets: ["Студийный свет и грип", "Декорации под ключ", "Реквизит и мебель"],
    scale: "съёмочные дни",
  },
];

export const Route = createFileRoute("/industries")({
  head: () => ({
    meta: [
      { title: "Индустрии — event-hub.by" },
      { name: "description", content: "Обслуживаем 8 индустрий: корпоратив, свадьбы, фестивали, выставки, образование, спорт, медиа, частные праздники. Решения под формат." },
      { property: "og:title", content: "Индустрии и форматы event-hub.by" },
      { property: "og:description", content: "Корпоратив, свадьбы, фестивали, выставки, образование, спорт, медиа — готовые решения под каждый формат." },
    ],
    links: [{ rel: "canonical", href: "/industries" }],
  }),
  component: Page,
});

function Page() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const active = INDUSTRIES.find((i) => i.slug === openSlug) ?? null;

  return (
    <div className="page-shell section-y max-w-6xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Briefcase className="h-3.5 w-3.5" /> Индустрии
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Под каждый формат — своё решение
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          За 8 лет работы мы собрали 600+ мероприятий в восьми индустриях. Знаем, что важно
          корпоративному клиенту, чем удивить гостей на свадьбе и как выстроить open-air на
          десять тысяч человек.
        </p>
      </header>

      <section aria-labelledby="grid-heading" className="mt-14">
        <h2 id="grid-heading" className="sr-only">Список индустрий</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.slug}
              type="button"
              onClick={() => setOpenSlug(ind.slug)}
              aria-label={`Подробнее: ${ind.title}`}
              className="group glass rounded-2xl border border-border/50 p-6 hover:border-primary/50 transition relative overflow-hidden text-center md:text-left cursor-pointer h-full flex flex-col items-center md:items-start"
            >
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition" />
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary glow-primary text-primary-foreground">
                <ind.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg leading-snug text-balance group-hover:text-primary transition">{ind.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{ind.scale}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty max-w-[34ch] md:max-w-none">{ind.lead}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-left self-stretch md:self-auto">
                {ind.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition">
                Подробнее <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <Dialog open={!!active} onOpenChange={(v) => { if (!v) setOpenSlug(null); }}>
        <DialogContent className="max-w-lg">
          {active && (
            <>
              <DialogHeader className="items-center text-center md:items-start md:text-left">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary glow-primary text-primary-foreground mb-3">
                  <active.icon className="h-5 w-5" />
                </div>
                <DialogTitle className="font-display text-2xl leading-snug">{active.title}</DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-wider">{active.scale}</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{active.lead}</p>
              <ul className="mt-2 space-y-2 text-sm">
                {active.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button asChild variant="outline">
                  <Link to="/cases">Кейсы по теме</Link>
                </Button>
                <Button asChild>
                  <Link to="/contacts">Обсудить проект <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>


      <section className="mt-16 glass-strong rounded-3xl p-8 md:p-12 border border-border/50">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Не нашли свой формат?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Делали саммиты на 5000 человек и камерные ужины на 12. Опишите задачу — соберём
              индивидуальное решение и просчитаем смету.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contacts">
                Обсудить проект <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/cases">Посмотреть кейсы</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
