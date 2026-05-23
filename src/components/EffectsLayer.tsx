import { useEffect } from "react";

/**
 * Глобальный слой эффектов:
 *  - Свечение, следящее за курсором (фоновый радиальный glow)
 *  - Подсветка интерактивных элементов под курсором (через CSS-переменные --mx/--my)
 *  - Ripple-вспышка при клике на кнопки/ссылки
 *  - Reveal-on-scroll для элементов с data-reveal
 *
 * Эффекты — чисто визуальные, не перехватывают события и не ломают логику.
 */
export function EffectsLayer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const root = document.documentElement;
    let raf = 0;
    let lastX = 0, lastY = 0;

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty("--cursor-x", `${lastX}px`);
        root.style.setProperty("--cursor-y", `${lastY}px`);
        // Локальные координаты для интерактивных элементов
        const target = document.elementFromPoint(lastX, lastY);
        const host = target?.closest<HTMLElement>("[data-glow], button, a, .glass, .interactive-glow");
        if (host) {
          const r = host.getBoundingClientRect();
          host.style.setProperty("--mx", `${lastX - r.left}px`);
          host.style.setProperty("--my", `${lastY - r.top}px`);
        }
      });
    };

    const onClick = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "button, a, [role='button'], .ripple"
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const ripple = document.createElement("span");
      ripple.className = "fx-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      const prev = getComputedStyle(el).position;
      if (prev === "static") el.style.position = "relative";
      const prevOverflow = el.style.overflow;
      el.style.overflow = "hidden";
      el.appendChild(ripple);
      window.setTimeout(() => {
        ripple.remove();
        if (!el.querySelector(".fx-ripple")) el.style.overflow = prevOverflow;
      }, 650);
    };

    // Reveal-on-scroll
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("is-revealed");
            io.unobserve(en.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    const observe = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)").forEach((el) => io.observe(el));
    };
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onClick, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      mo.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div aria-hidden className="fx-cursor-glow" />
      <div aria-hidden className="fx-aurora">
        <span className="fx-blob fx-blob-1" />
        <span className="fx-blob fx-blob-2" />
        <span className="fx-blob fx-blob-3" />
      </div>
    </>
  );
}
