/**
 * Анимированная заставка-логотип для hero-блока (фоновый режим).
 * Большой переливающийся wordmark «event-hub.by» с halo, sheen-блик
 * и парящими искрами. Размер задаётся контейнером .hero-logo-bg.
 */
export function HeroLogoIntro() {
  return (
    <div className="hero-logo font-display font-black tracking-tight leading-none whitespace-nowrap select-none text-[18vw] md:text-[14vw] lg:text-[13vw] xl:text-[12rem]">
      <span className="hero-logo__halo" aria-hidden="true" />
      <span className="hero-logo__word">event-hub.by</span>
      <span className="hero-logo__sheen" aria-hidden="true" />
      <span
        className="hero-logo__spark"
        aria-hidden="true"
        style={{ top: "-10%", left: "8%", ["--sx" as string]: "10px", ["--sy" as string]: "-6px", animationDelay: "0s" }}
      />
      <span
        className="hero-logo__spark"
        aria-hidden="true"
        style={{ bottom: "-15%", left: "42%", ["--sx" as string]: "-8px", ["--sy" as string]: "10px", animationDelay: "1.4s" }}
      />
      <span
        className="hero-logo__spark"
        aria-hidden="true"
        style={{ top: "10%", right: "4%", ["--sx" as string]: "12px", ["--sy" as string]: "8px", animationDelay: "2.6s" }}
      />
    </div>
  );
}
      <span
        aria-hidden="true"
        className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary glow-primary-lg animate-pulse-glow"
      >
        <Sparkles className="h-7 w-7 text-primary-foreground" />
      </span>

      <div className="hero-logo font-display font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight">
        <span className="hero-logo__halo" aria-hidden="true" />
        <span className="hero-logo__word">event-hub.by</span>
        <span className="hero-logo__sheen" aria-hidden="true" />
        <span
          className="hero-logo__spark"
          aria-hidden="true"
          style={{ top: "-10%", left: "8%", ["--sx" as string]: "10px", ["--sy" as string]: "-6px", animationDelay: "0s" }}
        />
        <span
          className="hero-logo__spark"
          aria-hidden="true"
          style={{ bottom: "-15%", left: "42%", ["--sx" as string]: "-8px", ["--sy" as string]: "10px", animationDelay: "1.4s" }}
        />
        <span
          className="hero-logo__spark"
          aria-hidden="true"
          style={{ top: "10%", right: "4%", ["--sx" as string]: "12px", ["--sy" as string]: "8px", animationDelay: "2.6s" }}
        />
      </div>
    </div>
  );
}
