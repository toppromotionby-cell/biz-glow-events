import { useEffect } from "react";

/**
 * Глобальный слой эффектов (облегчённая версия для производительности):
 *  - Свечение, следящее за курсором (только CSS-переменные --cursor-x/y)
 *  - Ripple-вспышка при клике
 *  - Reveal-on-scroll для элементов с data-reveal (без MutationObserver)
 */
export function EffectsLayer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

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

    // Reveal-on-scroll: периодически сканируем (без MutationObserver на subtree),
    // чтобы не платить за каждый mutate во время переходов и открытия диалогов.
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
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)")
        .forEach((el) => io.observe(el));
    };
    observe();
    let scanTimer: number | null = null;
    const scheduleScan = () => {
      if (scanTimer != null) return;
      scanTimer = window.setTimeout(() => {
        scanTimer = null;
        observe();
      }, 400);
    };
    // Скан после смены маршрута / навигации
    window.addEventListener("popstate", scheduleScan);
    // Скан раз в 1.5с — дешевле, чем MutationObserver на всём body
    const interval = window.setInterval(observe, 1500);

    if (!reduce && !isCoarse) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }
    window.addEventListener("pointerdown", onClick, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener("popstate", scheduleScan);
      if (scanTimer != null) clearTimeout(scanTimer);
      clearInterval(interval);
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
