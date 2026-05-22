import { useMemo, useState } from "react";
import { Calculator, Users, Clock, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Module = { id: string; label: string; min: number; max: number };

const MODULES: Module[] = [
  { id: "sound", label: "Звук и микрофоны", min: 600, max: 1800 },
  { id: "light", label: "Сценический свет", min: 800, max: 2400 },
  { id: "led", label: "LED-экран", min: 1500, max: 5000 },
  { id: "vr", label: "VR / интерактив", min: 900, max: 3200 },
  { id: "photo", label: "Фотозона / печать", min: 400, max: 1400 },
  { id: "decor", label: "Декорации / арт", min: 700, max: 4000 },
  { id: "staff", label: "Промо-персонал", min: 500, max: 2200 },
];

const SCALE_FACTOR = (guests: number) => 0.6 + Math.min(guests, 800) / 400; // 0.6 .. 2.6
const HOUR_FACTOR = (hours: number) => 0.8 + (hours - 2) * 0.15; // 2h≈0.8, 8h≈1.7

function money(n: number) {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);
}

export function GuestEstimator() {
  const [guests, setGuests] = useState(80);
  const [hours, setHours] = useState(4);
  const [picked, setPicked] = useState<Set<string>>(new Set(["sound", "light"]));

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { min, max } = useMemo(() => {
    const sFactor = SCALE_FACTOR(guests);
    const hFactor = HOUR_FACTOR(hours);
    let mn = 0;
    let mx = 0;
    for (const m of MODULES) {
      if (!picked.has(m.id)) continue;
      mn += m.min * sFactor * hFactor;
      mx += m.max * sFactor * hFactor;
    }
    return { min: Math.round(mn / 50) * 50, max: Math.round(mx / 50) * 50 };
  }, [guests, hours, picked]);

  return (
    <section className="container mx-auto px-4 py-16 border-t border-border/40">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
        <div>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-4">
            <Calculator className="h-3 w-3 text-accent" /> Калькулятор сметы
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
            Оцените стоимость <span className="gradient-text">за 30 секунд</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Ориентировочный диапазон без регистрации. Точную смету подготовим
            после короткого брифа.
          </p>

          <div className="space-y-6">
            <div>
              <Label className="flex items-center gap-2 text-sm mb-3">
                <Users className="h-4 w-4 text-primary" /> Гостей: <span className="font-semibold text-foreground">{guests}</span>
              </Label>
              <Slider value={[guests]} min={20} max={800} step={10} onValueChange={(v) => setGuests(v[0])} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>20</span><span>800+</span>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 text-sm mb-3">
                <Clock className="h-4 w-4 text-primary" /> Длительность: <span className="font-semibold text-foreground">{hours} ч</span>
              </Label>
              <Slider value={[hours]} min={2} max={10} step={1} onValueChange={(v) => setHours(v[0])} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>2 ч</span><span>10 ч</span>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 text-sm mb-3">
                <Sparkles className="h-4 w-4 text-primary" /> Модули
              </Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODULES.map((m) => {
                  const active = picked.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition ${
                        active
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <Checkbox checked={active} className="pointer-events-none" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-8 lg:sticky lg:top-24 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Ориентировочный диапазон
          </div>
          {picked.size === 0 ? (
            <div className="text-2xl font-display text-muted-foreground py-6">
              Выберите хотя бы один модуль
            </div>
          ) : (
            <>
              <div className="font-display text-3xl md:text-4xl font-bold leading-tight gradient-text">
                {money(min)} — {money(max)}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Расчёт учитывает количество гостей, длительность и состав модулей.
                Финальная стоимость зависит от логистики, монтажа и доп. опций.
              </p>
            </>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="glass rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Гостей</div>
              <div className="font-semibold mt-1">{guests}</div>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Часов</div>
              <div className="font-semibold mt-1">{hours}</div>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Модулей</div>
              <div className="font-semibold mt-1">{picked.size}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Link to="/contacts">
              <Button className="w-full bg-gradient-primary glow-primary">
                Получить точную смету <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/equipment">
              <Button variant="outline" className="w-full">Смотреть каталог</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
