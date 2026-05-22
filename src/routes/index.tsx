import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Zap, Shield, Award, ArrowRight, Cpu, Lightbulb, Music, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  { icon: Cpu, title: "VR/AR & интерактив", desc: "Иммерсивные зоны, геймификация, фотостены" },
  { icon: Music, title: "Звук и свет", desc: "Профессиональное оборудование под ключ" },
  { icon: Lightbulb, title: "LED-экраны", desc: "Любых размеров, монтаж в день мероприятия" },
  { icon: Package, title: "Производство", desc: "Декорации, баннеры, арт-объекты, реквизит" },
];

const VALUES = [
  { icon: Zap, title: "Скорость", desc: "От заявки до сметы — 24 часа" },
  { icon: Shield, title: "Надёжность", desc: "Резервное оборудование на каждом проекте" },
  { icon: Award, title: "Качество", desc: "200+ реализованных мероприятий" },
];

function HomePage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
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
              <Link to="/zones"><Button size="lg" className="bg-gradient-primary glow-primary-lg">
                Смотреть каталог <ArrowRight className="ml-2 h-4 w-4" />
              </Button></Link>
              <Link to="/contacts"><Button size="lg" variant="outline">Получить смету</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* DIRECTIONS */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-12 text-center">Направления</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:border-primary/50 transition group">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary mb-4 group-hover:glow-primary transition">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section className="container mx-auto px-4 py-20 border-t border-border/40">
        <div className="grid md:grid-cols-3 gap-8">
          {VALUES.map(v => (
            <div key={v.title} className="text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full glass mb-4 animate-pulse-glow">
                <v.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-display font-semibold text-xl mb-2">{v.title}</h3>
              <p className="text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="glass-strong rounded-3xl p-10 md:p-16 text-center bg-gradient-to-br from-primary/10 to-transparent">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">Готовы обсудить ваше мероприятие?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Зарегистрируйтесь, чтобы получить доступ к ценам, сохранённым сметам и истории заказов.
          </p>
          <Link to="/register"><Button size="lg" className="bg-gradient-primary glow-primary-lg">
            Начать сотрудничество <ArrowRight className="ml-2 h-4 w-4" />
          </Button></Link>
        </div>
      </section>
    </div>
  );
}
