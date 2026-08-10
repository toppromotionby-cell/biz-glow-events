// Клиентский хелпер сигналов спроса. Не блокирует UI и не ломает поток при ошибке.
import { trackDemand } from "@/lib/demand.functions";

export type DemandEntity = "zones" | "tech_equipment" | "services" | "production_items" | "attractions";
export type DemandEvent = "view" | "detail" | "cart" | "quote" | "order";

const SEEN_KEY = "eh_demand_seen_v1";

function alreadySeen(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.sessionStorage.getItem(SEEN_KEY);
    const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    if (set.has(key)) return true;
    set.add(key);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set).slice(-200)));
    return false;
  } catch {
    return false;
  }
}

/** Отправить сигнал спроса. `once` — не чаще одного раза за сессию на позицию/событие. */
export function signalDemand(
  entity_type: DemandEntity,
  entity_id: string,
  event: DemandEvent,
  opts?: { qty?: number; once?: boolean },
) {
  if (typeof window === "undefined" || !entity_id) return;
  if (opts?.once !== false && alreadySeen(`${entity_type}:${entity_id}:${event}`)) return;
  void trackDemand({ data: { events: [{ entity_type, entity_id, event, qty: opts?.qty }] } }).catch(() => {});
}
