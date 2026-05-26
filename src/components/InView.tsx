import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Откладывает рендер children до тех пор, пока контейнер не приблизится к вьюпорту.
 * Используем для тяжёлых below-fold секций главной — снижает initial JS/layout cost и улучшает LCP/INP на мобильных.
 */
export function InView({
  children,
  fallback = null,
  rootMargin = "400px",
  minHeight,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  minHeight?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} style={!shown && minHeight ? { minHeight } : undefined}>
      {shown ? children : fallback}
    </div>
  );
}
