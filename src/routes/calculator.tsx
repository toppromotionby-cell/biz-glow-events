import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, Sparkles, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

type Block = { id: string; label: string; price: number; hint: string };

const BLOCKS: Block[] = [
  { id: "zone", label: "Тематическая зона / фотозона", price: 450, hint: "Декор, реквизит, подсветка" },
  { id: "led", label: "LED-экран / видеостена", price: 800, hint: "Контент-плеер и оператор включены" },
  { id: "sound", label: "Звуковой комплект", price: 350, hint: "Активная акустика + микрофоны" },
  { id: "light", label: "Световое оборудование", price: 400, hint: "Архитектурный свет + динамика" },
  { id: "vr", label: "VR / интерактив", price: 550, hint: "VR-станция, AR-зеркало, аркады" },
  { id: "furniture", label: "Мебель и текстиль", price: 280, hint: "Лаунж-зоны, барные группы" },
  { id: "stage", label: "Сцена и подиум", price: 600, hint: "Модульная конструкция от 12 м²" },
  { id: "production", label: "Брендированный продакшн", price: 900, hint: "Изготовление под ваш проект" },
];

const GUESTS_MULT = (g: number) => (g <= 50 ? 1 : g <= 150 ? 1.15 : g <= 400 ? 1.35 : 1.6);
const DAYS_MULT = (d: number) => (d <= 1 ? 1 : 1 + (d - 1) * 0.7);

function formatBYN(n: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Калькулятор стоимости — event-hub.by" },
      { name: "description", content: "Интерактивный калькулятор event-проекта: зоны, LED, звук, свет, VR, продакшн. Ориентировочная стоимость аренды за 1 минуту." },
      { property: "og:title", content: "Калькулятор стоимости event-проекта" },
      { property: "og:description", content: "Соберите смету за минуту: зоны, оборудование, длительность, количество гостей." },
    ],
    links: [{ rel: "canonical", href: "/calculator" }],
  }),
  component: Page,
});

function Page() {
  const [selected, setSelected] = useState<Record<string, boolean>>({ zone: true, sound: true, light: true });
  const [guests, setGuests] = useState(100);
  const [days, setDays] = useState(1);
  const [area, setArea] = useState(150);

  const breakdown = useMemo(() => {
    const items = BLOCKS.filter((b) => selected[b.id]);
    const base = items.reduce((s, b) => s + b.price, 0);
    const gM = GUESTS_MULT(guests);
    const dM = DAYS_MULT(days);
    const areaM = 1 + Math.max(0, area - 100) / 400;
    const subtotal = base * gM * dM * areaM;
    const logistics = 60 + Math.max(0, area - 100) * 0.5;
    const total = subtotal + logistics;
    return { items, base, gM, dM, areaM, subtotal, logistics, total };
  }, [selected, guests, days, area]);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

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
          Ориентировочный расчёт на основе типовых проектов 2024–2026. Финальная цена зависит от
          дат, локации и сложности монтажа — пришлём точную смету в течение 2 часов.
        </p>
      </header>

      <div className="mt-12 grid lg:grid-cols-[1fr_380px] gap-8">
        <section aria-labelledby="config-heading" className="space-y-8">
          <div>
            <h2 id="config-heading" className="text-xl font-display font-semibold">Что входит в проект</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {BLOCKS.map((b) => {
                const active = !!selected[b.id];
                return (
                  <label
                    key={b.id}
                    className={`glass rounded-xl border p-4 cursor-pointer transition flex items-start gap-3 ${
                      active ? "border-primary/60 bg-primary/5" : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <Checkbox checked={active} onCheckedChange={() => toggle(b.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{b.label}</span>
                        <span className="text-sm text-primary whitespace-nowrap">от {b.price} BYN</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{b.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 glass rounded-2xl border border-border/50 p-6">
            <div>
              <Label className="text-sm">Гостей: <span className="text-primary">{guests}</span></Label>
              <Slider value={[guests]} onValueChange={(v) => setGuests(v[0])} min={20} max={1000} step={10} className="mt-3" />
            </div>
            <div>
              <Label className="text-sm">Дней: <span className="text-primary">{days}</span></Label>
              <Slider value={[days]} onValueChange={(v) => setDays(v[0])} min={1} max={7} step={1} className="mt-3" />
            </div>
            <div>
              <Label htmlFor="area" className="text-sm">Площадь, м²</Label>
              <Input
                id="area"
                type="number"
                min={20}
                max={2000}
                value={area}
                onChange={(e) => setArea(Math.max(20, Math.min(2000, Number(e.target.value) || 0)))}
                className="mt-3"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground flex gap-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <p>
              Цены ориентировочные, без НДС. Учитывают базовую доставку по Минску. Для итоговой
              сметы менеджер уточнит локацию, тайминг и согласует индивидуальные позиции.
            </p>
          </div>
        </section>

        <aside aria-labelledby="total-heading" className="lg:sticky lg:top-24 self-start">
          <div className="glass-strong rounded-3xl border border-border/50 p-6">
            <h2 id="total-heading" className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Предварительный расчёт
            </h2>
            <div className="mt-3">
              <div className="text-4xl font-display font-bold gradient-text">{formatBYN(breakdown.total)} BYN</div>
              <p className="text-xs text-muted-foreground mt-1">за {days} {days === 1 ? "день" : "дн."} · {guests} гостей · {area} м²</p>
            </div>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">База ({breakdown.items.length} позиций)</dt>
                <dd>{formatBYN(breakdown.base)} BYN</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Коэф. гостей</dt>
                <dd>×{breakdown.gM.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Коэф. дней</dt>
                <dd>×{breakdown.dM.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Коэф. площади</dt>
                <dd>×{breakdown.areaM.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2">
                <dt className="text-muted-foreground">Логистика</dt>
                <dd>{formatBYN(breakdown.logistics)} BYN</dd>
              </div>
            </dl>

            <div className="mt-6 space-y-2">
              <Button asChild size="lg" className="w-full">
                <Link to="/contacts">
                  Получить точную смету <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/zones">Смотреть зоны</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
