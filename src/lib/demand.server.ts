// Единый счётчик спроса по позициям каталога.
// Пишем обезличенные события (просмотр / подробнее / запрос КП / корзина / заказ)
// и считаем взвешенный рейтинг с затуханием по времени.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DemandEntity = "zones" | "tech_equipment" | "services" | "production_items" | "attractions";
export type DemandEvent = "view" | "detail" | "cart" | "quote" | "order";

export const DEMAND_WEIGHTS: Record<DemandEvent, number> = {
  order: 8,
  quote: 5,
  cart: 3,
  detail: 1,
  view: 0.5,
};

const WINDOW_DAYS = 180;
const HALF_LIFE_DAYS = 60;
const CACHE_TTL_MS = 5 * 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DemandInput = { entity_type: DemandEntity; entity_id: string; event: DemandEvent; qty?: number };

/** Записываем события спроса. Никогда не бросаем — это фоновый сигнал. */
export async function recordDemand(events: DemandInput[]): Promise<void> {
  try {
    const rows = events
      .filter((e) => e.entity_id && UUID_RE.test(e.entity_id))
      .slice(0, 100)
      .map((e) => ({
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        event: e.event,
        weight: DEMAND_WEIGHTS[e.event] * Math.min(10, Math.max(1, Number(e.qty ?? 1) || 1)),
      }));
    if (rows.length === 0) return;
    const { error } = await supabaseAdmin.from("demand_events").insert(rows);
    if (error) console.error("[demand.record] failed:", error.message);
  } catch (err) {
    console.error("[demand.record] failed:", err);
  }
}

let cache: { at: number; scores: Map<string, number> } | null = null;

export const demandKey = (type: string, id: string) => `${type}:${id}`;

/** Взвешенные рейтинги позиций: ключ `${entity_type}:${entity_id}`. */
export async function getDemandScores(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.scores;
  const scores = new Map<string, number>();
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("demand_events")
      .select("entity_type, entity_id, weight, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20_000);
    if (error) throw error;
    const now = Date.now();
    for (const r of (data ?? []) as Array<{ entity_type: string; entity_id: string; weight: number; created_at: string }>) {
      const ageDays = (now - new Date(r.created_at).getTime()) / 86_400_000;
      const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
      const k = demandKey(r.entity_type, r.entity_id);
      scores.set(k, (scores.get(k) ?? 0) + (Number(r.weight) || 0) * decay);
    }
  } catch (err) {
    console.error("[demand.scores] failed:", err);
  }
  cache = { at: Date.now(), scores };
  return scores;
}

export function invalidateDemandCache() {
  cache = null;
}
