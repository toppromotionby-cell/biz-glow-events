// Блок калькулятора на главной: те же реальные позиции каталога, что и на /calculator.
import { Calculator, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CatalogEstimator } from "@/components/CatalogEstimator";

export function GuestEstimator() {
  return (
    <section className="container mx-auto px-4 py-16 border-t border-border/40">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-4">
            <Calculator className="h-3 w-3 text-accent" /> Калькулятор сметы
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
            Оцените стоимость <span className="gradient-text">за 30 секунд</span>
          </h2>
          <p className="text-muted-foreground max-w-xl">
            Считаем по актуальным ценам каталога. Сверху — позиции, которые заказывают чаще всего.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/calculator">
            Полный калькулятор <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CatalogEstimator compact />
    </section>
  );
}
