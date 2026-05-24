// Лёгкие A/B-тесты на клиенте: устойчивое распределение в localStorage + событие в GA/YM.
import { useEffect, useState } from "react";

const KEY = "eh_ab_v1";

type Assignments = Record<string, string>;

function read(): Assignments {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(KEY) || "{}") || {}; }
  catch { return {}; }
}

function write(a: Assignments) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}

function track(experiment: string, variant: string) {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer?.push({ event: "experiment_view", experiment, variant });
    window.gtag?.("event", "experiment_view", { experiment_id: experiment, variant_id: variant });
    const ymId = import.meta.env.VITE_YM_ID as string | undefined;
    if (ymId && window.ym) (window.ym as (...a: unknown[]) => void)(Number(ymId), "params", { ab: { [experiment]: variant } });
  } catch {}
}

/**
 * Возвращает выбранный вариант. На SSR — variants[0], на клиенте — устойчивый случайный из списка.
 */
export function useExperiment<T extends string>(experiment: string, variants: readonly T[]): T {
  const [variant, setVariant] = useState<T>(variants[0]);
  useEffect(() => {
    const cur = read();
    let v = cur[experiment] as T | undefined;
    if (!v || !variants.includes(v)) {
      v = variants[Math.floor(Math.random() * variants.length)];
      cur[experiment] = v;
      write(cur);
    }
    setVariant(v);
    track(experiment, v);
  }, [experiment, variants]);
  return variant;
}
