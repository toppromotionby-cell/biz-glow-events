// Этап 5: сигнал спроса из документов — какие позиции каталога чаще всего
// попадают в сметы КП. Используется вместе с demand_events в калькуляторе
// и в блоке «Готовый пакет».
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { demandKey } from "@/lib/demand.server";

const CACHE_TTL_MS = 5 * 60_000;
/** Вес одной позиции в смете относительно веса события спроса. */
const ITEM_WEIGHT = 4;

let cache: { at: number; scores: Map<string, number> } | null = null;

/** Рейтинг позиций каталога по частоте включения в КП: ключ `${entity_type}:${entity_id}`. */
export async function getDocumentPopularity(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.scores;
  const scores = new Map<string, number>();
  try {
    const { data, error } = await supabaseAdmin
      .from("quote_items")
      .select("entity_type, entity_id, included")
      .not("entity_id", "is", null)
      .limit(5000);
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ entity_type: string | null; entity_id: string | null; included: boolean | null }>) {
      if (!r.entity_type || !r.entity_id) continue;
      const k = demandKey(r.entity_type, r.entity_id);
      scores.set(k, (scores.get(k) ?? 0) + (r.included === false ? ITEM_WEIGHT / 2 : ITEM_WEIGHT));
    }
  } catch (err) {
    console.error("[doc-popularity] failed:", err);
  }
  cache = { at: Date.now(), scores };
  return scores;
}

export function invalidateDocPopularityCache() {
  cache = null;
}
