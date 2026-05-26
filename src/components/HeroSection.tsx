import heroBg from "/hero-bg.jpg";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Search, Package, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense, lazy } from "react";

const CatalogChoiceModal = lazy(() => import("@/components/CatalogChoiceModal").then((m) => ({ default: m.CatalogChoiceModal })));

/* ── stagger fade-in via IntersectionObserver + CSS classes ── */
function useStaggerReveal<T extends HTMLElement>(staggerMs = 120) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const childClass = (idx: number) =>
    visible
      ? `opacity-100 translate-y-0 transition-all duration-700 ease-out`
      : `opacity-0 translate-y-6`;

  const style = (idx: number): React.CSSProperties =>
    visible ? { transitionDelay: `${idx * staggerMs}ms` } : {};

  return { ref, childClass, style, visible };
}

interface HeroSectionProps {
  onOpenCatalog: () => void;
  onOpenHelp: () => void;
}

export function HeroSection({ onOpenCatalog, onOpenHelp }: HeroSectionProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { ref, childClass, style } = useStaggerReveal<HTMLElement>(150);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden min-h-[92vh] flex items-center"
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroBg}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          width={1920}
          height={1080}
        />
        {/* Dark gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.06 0.01 260 / 0.92) 0%, oklch(0.08 0.02 260 / 0.82) 40%, oklch(0.1 0.02 260 / 0.55) 70%, oklch(0.12 0.02 260 / 0.35) 100%)",
          }}
        />
        {/* Bottom fade to blend with next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.9), transparent)",
          }}
        />
      </div>

      {/* Decorative light accents */}
      <div className="absolute top-1/4 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 -left-20 h-64 w-64 rounded-full bg-accent/8 blur-[80px] pointer-events-none" aria-hidden="true" />

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
        <div className="max-w-3xl">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-1.5 text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-6 md:mb-8 ${childClass(0)}`}
            style={style(0)}
          >
            <Sparkles className="h-3 w-3" />
            Онлайн-магазин event-решений
          </div>

          {/* H1 */}
          <h1
            className={`font-display font-black leading-[0.95] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 md:mb-8 ${childClass(1)}`}
            style={style(1)}
          >
            <span className="hero-accent-text block">
              Всё для вашего
            </span>
            <span className="block text-foreground">события —</span>
            <span className="block text-foreground">в одном месте</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed ${childClass(2)}`}
            style={style(2)}
          >
            Интерактивные зоны, техническое оснащение, услуги по организации,
            свет, декор и всё что нужно для любых ивентов и корпоративов.
            Быстрый подбор и доставка по всей Беларуси.
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-8 md:mb-10 ${childClass(3)}`}
            style={style(3)}
          >
            <Button
              size="lg"
              onClick={() => setCatalogOpen(true)}
              className="rounded-full px-8 h-12 bg-gradient-primary glow-primary-lg text-primary-foreground font-semibold w-full sm:w-auto text-base"
            >
              Перейти в каталог
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onOpenHelp}
              className="rounded-full px-8 h-12 border-primary/40 bg-background/40 backdrop-blur-sm text-foreground font-semibold hover:bg-primary/10 hover:border-primary/60 w-full sm:w-auto text-base"
            >
              Помощь в подборе
            </Button>
            {catalogOpen && (
              <Suspense fallback={null}>
                <CatalogChoiceModal open={catalogOpen} onOpenChange={(v) => { setCatalogOpen(v); if (!v) onOpenCatalog(); }} />
              </Suspense>
            )}
          </div>

          {/* Hint line */}
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground/80 ${childClass(4)}`}
            style={style(4)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-accent" />
              Более 500 товаров в наличии
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-accent" />
              Отправка в день заказа
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-accent" />
              Доставка по всей Беларуси
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
