import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { CatalogEstimator } from "@/components/CatalogEstimator";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Калькулятор стоимости — event-hub.by" },
      { name: "description", content: "Соберите предварительную смету из реальных позиций каталога: зоны, оборудование, услуги, продакшн, аттракционы. Цены — как на сайте." },
      { property: "og:title", content: "Калькулятор стоимости event-проекта" },
      { property: "og:description", content: "Смета по актуальным ценам каталога event-hub.by за одну минуту." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/calculator" }],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Calculator className="h-3.5 w-3.5" /> Смета за минуту
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Калькулятор стоимости
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Расчёт строится только на реальных позициях и ценах нашего каталога. Наверху — то, что
          заказывают чаще всего. Финальную смету менеджер уточнит с учётом дат, локации и монтажа.
        </p>
      </header>

      <div className="mt-12">
        <CatalogEstimator />
      </div>
    </div>
  );
}
