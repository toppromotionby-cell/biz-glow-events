// Подбор готового пакета под тип мероприятия, число гостей и бюджет.
// Использует только реальные опубликованные позиции каталога и их цены.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PackageOpen, Users, Wallet, RefreshCw, ShoppingCart, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalculatorCatalog, type CalcItem } from "@/lib/calculator.functions";
import { CATALOG_SLUG_ROUTE } from "@/lib/catalog-routes";
import { addToCart, type CartEntityType } from "@/lib/cart";

type EventType = {
  id: string;
  label: string;
  /** Вес типа каталога при подборе: чем больше, тем раньше позиция попадёт в пакет. */
  weights: Partial<Record<CalcItem["type"], number>>;
};

const EVENT_TYPES: EventType[] = [
  { id: "corporate", label: "Корпоратив", weights: { zones: 3, tech_equipment: 3, services: 2, production_items: 1, attractions: 1 } },
  { id: "wedding", label: "Свадьба", weights: { zones: 3, services: 3, production_items: 2, tech_equipment: 2, attractions: 1 } },
  { id: "birthday", label: "День рождения", weights: { attractions: 3, zones: 3, services: 2, tech_equipment: 1, production_items: 1 } },
  { id: "city", label: "Городской праздник", weights: { attractions: 3, tech_equipment: 3, zones: 2, services: 2, production_items: 1 } },
  { id: "promo", label: "Промо и выставка", weights: { zones: 3, production_items: 3, tech_equipment: 2, services: 2, attractions: 1 } },
];

const money = (n: number) =>
  new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);

const TYPE_LABEL: Record<CalcItem["type"], string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

/** Жадный подбор: максимум пользы (спрос × вес типа) в рамках бюджета, без дублей по категории. */
function buildPackage(items: CalcItem[], ev: EventType, guests: number, budget: number, shuffle: number): CalcItem[] {
  const scale = 0.7 + Math.min(guests, 600) / 500; // масштаб сметы под число гостей
  const pool = items
    .filter((it) => it.price != null && it.price > 0)
    .map((it, idx) => ({
      it,
      score: (ev.weights[it.type] ?? 1) * (1 + it.popularity) + ((idx + shuffle * 7) % 5) * 0.15,
      cost: (it.price as number) * scale,
    }))
    .sort((a, b) => b.score - a.score);

  const picked: CalcItem[] = [];
  const usedGroups = new Set<string>();
  let spent = 0;
  for (const p of pool) {
    const group = `${p.it.type}:${(p.it.category ?? "").trim().toLowerCase()}`;
    if (usedGroups.has(group)) continue;
    if (spent + p.cost > budget) continue;
    usedGroups.add(group);
    picked.push(p.it);
    spent += p.cost;
    if (picked.length >= 6) break;
  }
  return picked;
}

export function PackageBuilder() {
  const [eventId, setEventId] = useState(EVENT_TYPES[0].id);
  const [guests, setGuests] = useState(100);
  const [budget, setBudget] = useState(5000);
  const [shuffle, setShuffle] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["calculator-catalog"],
    queryFn: () => getCalculatorCatalog(),
    staleTime: 5 * 60_000,
  });

  const ev = EVENT_TYPES.find((e) => e.id === eventId) ?? EVENT_TYPES[0];
  const picked = useMemo(
    () => buildPackage(data ?? [], ev, guests, budget, shuffle),
    [data, ev, guests, budget, shuffle],
  );
  const total = picked.reduce((s, it) => s + (it.price ?? 0), 0);

  const addAll = () => {
    let added = 0;
    for (const it of picked) {
      const res = addToCart({
        id: it.id,
        entity_type: it.type as CartEntityType,
        slug: it.slug,
        title: it.title,
        price: it.price ?? 0,
        qty: 1,
        unit: it.unit,
      });
      if (res.added) added += 1;
    }
    toast.success(
      added > 0 ? `Добавлено в корзину: ${added}` : "Все позиции пакета уже в корзине",
    );
  };

  return (
    <section className="container mx-auto px-4 py-16 border-t border-border/40">
      <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-4">
        <PackageOpen className="h-3 w-3 text-accent" /> Готовый пакет
      </div>
      <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
        Подберём набор <span className="gradient-text">под бюджет</span>
      </h2>
      <p className="text-muted-foreground mb-8 max-w-xl">
        Выберите формат события, число гостей и бюджет — соберём пакет из реальных позиций каталога.
        Состав можно менять: добавьте в корзину и уберите лишнее.
      </p>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-start">
        <div className="space-y-6">
          <div>
            <Label className="text-sm mb-3 block">Формат события</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEventId(t.id)}
                  aria-pressed={t.id === eventId}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    t.id === eventId
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2 text-sm mb-3">
              <Users className="h-4 w-4 text-primary" /> Гостей:{" "}
              <span className="font-semibold text-foreground">{guests}</span>
            </Label>
            <Slider value={[guests]} min={20} max={600} step={10} onValueChange={(v) => setGuests(v[0])} />
          </div>

          <div>
            <Label className="flex items-center gap-2 text-sm mb-3">
              <Wallet className="h-4 w-4 text-primary" /> Бюджет:{" "}
              <span className="font-semibold text-foreground">{money(budget)}</span>
            </Label>
            <Slider value={[budget]} min={1000} max={40000} step={500} onValueChange={(v) => setBudget(v[0])} />
          </div>

          <Button variant="outline" size="sm" onClick={() => setShuffle((s) => s + 1)} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Другой вариант
          </Button>
        </div>

        <div className="glass-strong rounded-3xl p-6 md:p-8 bg-gradient-to-br from-primary/10 to-transparent">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : picked.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Под такой бюджет пока нечего подобрать — увеличьте сумму или{" "}
              <Link to="/contacts" className="text-primary underline underline-offset-4">
                напишите нам
              </Link>
              , соберём вариант вручную.
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {picked.map((it) => (
                  <li key={`${it.type}:${it.id}`} className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={CATALOG_SLUG_ROUTE[it.type]}
                        params={{ slug: it.slug }}
                        className="text-sm font-medium hover:text-primary transition line-clamp-1"
                      >
                        {it.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {it.category?.trim() || TYPE_LABEL[it.type]}
                      </div>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap">
                      от {money(it.price ?? 0)}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Итого по каталогу</span>
                <span className="font-display text-2xl font-bold gradient-text">от {money(total)}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={addAll} className="gap-2">
                  <ShoppingCart className="h-4 w-4" /> Добавить пакет в корзину
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/cart">
                    Перейти в корзину <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Цены — минимальные по каталогу без логистики и монтажа. Точную смету подготовим после брифа.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
