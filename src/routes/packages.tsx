import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Users, Wallet, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalculatorCatalog, type CalcItem } from "@/lib/calculator.functions";
import { addToCart, type CartEntityType } from "@/lib/cart";
import { CATALOG_SLUG_ROUTE } from "@/lib/catalog-routes";

export const Route = createFileRoute("/packages")({
  head: () => ({
    meta: [
      { title: "Подбор пакета под бюджет — event-hub.by" },
      { name: "description", content: "Автоподбор набора зон, оборудования и услуг под число гостей и бюджет мероприятия. Реальные позиции и цены каталога event-hub.by." },
      { property: "og:title", content: "Готовый пакет под ваш бюджет" },
      { property: "og:description", content: "Укажите гостей и бюджет — соберём набор позиций из каталога и добавим в заявку одной кнопкой." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PackagesPage,
});

const TYPE_LABEL: Record<string, string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

// Приоритет разделов при сборке пакета: сначала «каркас» события.
const TYPE_ORDER: CartEntityType[] = ["zones", "tech_equipment", "services", "attractions", "production_items"];

function money(n: number) {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);
}

/** Жадный подбор: по одному лучшему по спросу элементу из каждого раздела, пока хватает бюджета. */
function buildPackage(items: CalcItem[], budget: number, guests: number): CalcItem[] {
  const priced = items.filter((i) => i.price != null && i.price > 0);
  // Крупным событиям — более «весомые» позиции, малым — экономные.
  const cap = budget * (guests > 250 ? 0.45 : guests > 100 ? 0.4 : 0.35);
  const picked: CalcItem[] = [];
  let spent = 0;

  const pass = (allowRepeatType: boolean) => {
    for (const type of TYPE_ORDER) {
      if (!allowRepeatType && picked.some((p) => p.type === type)) continue;
      const pool = priced
        .filter((i) => i.type === type && !picked.some((p) => p.id === i.id))
        .filter((i) => (i.price ?? 0) <= Math.max(cap, budget - spent))
        .sort((a, b) => (b.popularity - a.popularity) || (a.price ?? 0) - (b.price ?? 0));
      const next = pool.find((i) => spent + (i.price ?? 0) <= budget);
      if (next) {
        picked.push(next);
        spent += next.price ?? 0;
      }
    }
  };

  pass(false);
  // Добираем бюджет вторым проходом, но не раздуваем список.
  if (picked.length < 8) pass(true);
  return picked;
}

function PackagesPage() {
  const [guests, setGuests] = useState(100);
  const [budget, setBudget] = useState(6000);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["calculator-catalog"],
    queryFn: () => getCalculatorCatalog(),
    staleTime: 5 * 60_000,
  });

  const suggestion = useMemo(() => buildPackage(data ?? [], budget, guests), [data, budget, guests]);
  const selected = useMemo(() => suggestion.filter((i) => !excluded.has(i.id)), [suggestion, excluded]);
  const total = selected.reduce((s, i) => s + (i.price ?? 0), 0);

  const addAll = () => {
    let added = 0;
    for (const i of selected) {
      const res = addToCart({
        id: i.id,
        entity_type: i.type as CartEntityType,
        slug: i.slug,
        title: i.title,
        price: i.price ?? 0,
        qty: 1,
        unit: i.unit,
      });
      if (res.added) added += 1;
    }
    toast.success(added > 0 ? `Добавлено в заявку: ${added}` : "Все позиции уже в заявке");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Пакет под бюджет</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Укажите число гостей и бюджет — соберём набор из реальных позиций каталога, отсортированных по спросу. Любую позицию можно исключить.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
        <aside className="glass rounded-2xl p-5 h-max space-y-6">
          <div>
            <Label className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Гостей: {guests}
            </Label>
            <Slider className="mt-3" min={20} max={800} step={10} value={[guests]} onValueChange={(v) => setGuests(v[0])} />
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" aria-hidden="true" /> Бюджет: {money(budget)}
            </Label>
            <Slider className="mt-3" min={1000} max={60000} step={500} value={[budget]} onValueChange={(v) => setBudget(v[0])} />
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setExcluded(new Set())}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" /> Сбросить исключения
          </Button>
        </aside>

        <section className="glass rounded-2xl p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : suggestion.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <Package className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3">Под указанный бюджет позиции не подобрались — увеличьте бюджет.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/40">
                {suggestion.map((i) => {
                  const off = excluded.has(i.id);
                  return (
                    <li key={i.id} className={`py-3 flex items-center gap-3 ${off ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!off}
                        aria-label={`Включить в пакет: ${i.title}`}
                        onChange={() =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (next.has(i.id)) next.delete(i.id); else next.add(i.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={CATALOG_SLUG_ROUTE[i.type]}
                          params={{ slug: i.slug }}
                          className="font-medium hover:text-primary transition block truncate"
                        >
                          {i.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {TYPE_LABEL[i.type] ?? i.type}{i.category ? ` · ${i.category}` : ""}
                        </span>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">{money(i.price ?? 0)}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                <div>
                  <span className="text-xs text-muted-foreground block">Предварительно, {selected.length} позиций</span>
                  <span className="text-2xl font-display font-bold gradient-text">{money(total)}</span>
                </div>
                <Button className="bg-gradient-primary" onClick={addAll} disabled={selected.length === 0}>
                  <ShoppingCart className="h-4 w-4 mr-1" aria-hidden="true" /> Добавить пакет в заявку
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Расчёт предварительный: итоговая стоимость зависит от дат, длительности и логистики.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
