import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, Music, Lightbulb, Package, ArrowRight } from "lucide-react";

const CATALOGS = [
  { id: "zones", title: "Интерактивные зоны", desc: "VR/AR, фотозоны, геймификация, иммерсивные зоны", to: "/zones" as const, icon: Cpu, color: "from-primary to-primary-glow" },
  { id: "equipment", title: "Оборудование", desc: "Звук, свет, LED-экраны любых размеров", to: "/equipment" as const, icon: Music, color: "from-accent to-accent-glow" },
  { id: "services", title: "Услуги", desc: "BTL, промо-персонал, event-услуги", to: "/services" as const, icon: Lightbulb, color: "from-primary to-accent" },
  { id: "production", title: "Производство", desc: "Декорации, баннеры, арт-объекты, реквизит", to: "/production" as const, icon: Package, color: "from-accent to-primary" },
];

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Каталог — event-hub.by" },
      { name: "description", content: "Каталог event-hub.by: интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси." },
      { property: "og:title", content: "Каталог — event-hub.by" },
      { property: "og:description", content: "Все разделы каталога event-hub.by." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Каталог</h1>
        <p className="mt-4 text-muted-foreground">Выберите раздел каталога — зоны, оборудование, услуги или производство.</p>
      </header>
      <div className="grid sm:grid-cols-2 gap-4 items-stretch">
        {CATALOGS.map((cat) => (
          <Link key={cat.id} to={cat.to} className="group relative glass rounded-xl px-4 py-5 sm:p-6 hover:border-primary/50 transition-all duration-200 block h-full">
            <div className="flex h-full flex-col items-center text-center gap-3 md:flex-row md:items-start md:text-left md:gap-4">
              <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color} group-hover:glow-primary transition`}>
                <cat.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex flex-1 flex-col items-center md:items-start">
                <h2 className="font-semibold text-lg leading-snug text-balance group-hover:text-primary transition">{cat.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground mt-1.5 text-pretty max-w-[34ch] md:max-w-none">{cat.desc}</p>
                <div className="mt-3 inline-flex items-center justify-center md:justify-start text-sm text-primary font-medium">
                  Перейти <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
