// Реакция на ширину экрана по произвольной точке останова.
// Нужна редакторам: на узких экранах панели уезжают вниз/в шторку,
// на широких — работают как раздвижные колонки.
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return match;
}

/** true, когда экран уже точки, на которой панели редактора складываются. */
export function useIsNarrowEditor(): boolean {
  return !useMediaQuery("(min-width: 1024px)");
}
