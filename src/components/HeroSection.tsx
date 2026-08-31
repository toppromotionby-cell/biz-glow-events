import heroBg from "/hero-bg.jpg";
import heroAvif828 from "/hero-bg-828.avif";
import heroAvif1920 from "/hero-bg-1920.avif";
import heroWebp828 from "/hero-bg-828.webp";
import heroWebp1920 from "/hero-bg-1920.webp";
import React, { useRef } from "react";
import { ArrowRight, Search, Package, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── stagger fade-in: видим сразу, плавно «оседает» один раз после первого пейнта ── */
function useStaggerReveal<T extends HTMLElement>(staggerMs = 120) {
  const ref = useRef<T>(null);
  // Стартуем как visible=true, чтобы SSR/первый пейнт сразу показывал H1 — это LCP-кандидат.
  // Анимация лишь украшает, но не блокирует первый кадр.
  const [visible] = React.useState(true);

  const childClass = () =>
    visible
      ? `opacity-100 translate-y-0 transition-all duration-700 ease-out`
      : `opacity-0 translate-y-6`;

  const style = (idx: number): React.CSSProperties =>
    visible ? { transitionDelay: `${idx * staggerMs}ms` } : {};

  return { ref, childClass, style };
}

interface HeroSectionProps {
  onOpenCatalog: () => void;
  onOpenHelp: () => void;
}

export function HeroSection({ onOpenCatalog, onOpenHelp }: HeroSectionProps) {
  const { ref, childClass, style } = useStaggerReveal<HTMLElement>(150);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden min-h-[78svh] md:min-h-[88vh] flex items-center"
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source
            type="image/avif"
            srcSet={`${heroAvif828} 828w, ${heroAvif1920} 1920w`}
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet={`${heroWebp828} 828w, ${heroWebp1920} 1920w`}
            sizes="100vw"
          />
          <img
            src={heroBg}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1920}
            height={1080}
          />
        </picture>
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

      {/* Decorative light accents — скрыты на мобильных (дорогой blur compositing) */}
      <div className="hidden md:block absolute top-1/4 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" aria-hidden="true" />
      <div className="hidden md:block absolute bottom-1/4 -left-20 h-64 w-64 rounded-full bg-accent/8 blur-[80px] pointer-events-none" aria-hidden="true" />

      {/* Content */}
      <div className="page-shell py-12 md:py-24 relative z-10">
        <div className="max-w-3xl text-center md:text-left">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-1.5 text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-6 md:mb-8 ${childClass()}`}
            style={style(0)}
          >
            <Sparkles className="h-3 w-3" />
            ОНЛАЙН-КАТАЛОГ EVENT-РЕШЕНИЙ
          </div>

          {/* H1 */}
          <h1
            className={`font-display font-black leading-[0.95] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 md:mb-8 drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] ${childClass()}`}
            style={style(1)}
          >
            <span className="hero-accent-text block">
              Всё для вашего
            </span>
            <span className="block text-white">мероприятия —</span>
            <span className="block text-white">в одном месте</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-base sm:text-lg md:text-xl text-white/85 max-w-2xl mb-8 md:mb-10 leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${childClass()}`}
            style={style(2)}
          >
            От бизнес-презентаций до свадеб и масштабных корпоративов.
            Интерактивные зоны, техническое оснащение, авторский декор, ведущие и диджеи — подберём всё необходимое за 15 минут
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row flex-wrap items-center sm:items-start gap-3 sm:gap-4 mb-8 md:mb-10 ${childClass()}`}
            style={style(3)}
          >
            <Button
              size="lg"
              onClick={onOpenCatalog}
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
          </div>

          {/* Hint line */}
          <div
            className={`flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-xs sm:text-sm text-white/80 ${childClass()}`}
            style={style(4)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-accent" />
              Более 500 услуг в наличии
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-accent" />
              Смета в день заказа
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-accent" />
              Работаем по всей Беларуси
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
