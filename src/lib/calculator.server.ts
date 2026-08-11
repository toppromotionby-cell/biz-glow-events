// Данные для калькулятора: только реальные опубликованные позиции сайта и их цены,
// отсортированные по рейтингу спроса.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDemandScores, demandKey, type DemandEntity } from "@/lib/demand.server";
import { getDocumentPopularity } from "@/lib/doc-popularity.server";
import { minPriceFromPricing, unitFromPricing } from "@/lib/pricing";

export type CalcItem = {
  id: string;
  slug: string;
  title: string;
  type: DemandEntity;
  category: string | null;
  unit: string | null;
  price: number | null;
  popularity: number;
};

const TABLES: DemandEntity[] = ["zones", "tech_equipment", "services", "production_items", "attractions"];

export async function loadCalculatorCatalog(): Promise<CalcItem[]> {
  const [scores, docScores] = await Promise.all([getDemandScores(), getDocumentPopularity()]);
  const results = await Promise.all(
    TABLES.map(async (t) => {
      try {
        const { data, error } = await supabaseAdmin
          .from(t)
          .select("id, slug, title, category, pricing")
          .eq("published", true)
          .order("sort_order", { ascending: true })
          .limit(300);
        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; slug: string; title: string; category: string | null; pricing: unknown }>).map(
          (r): CalcItem => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            type: t,
            category: r.category,
            unit: unitFromPricing(r.pricing),
            price: minPriceFromPricing(r.pricing),
            popularity:
              (scores.get(demandKey(t, r.id)) ?? 0) + (docScores.get(demandKey(t, r.id)) ?? 0),
          }),
        );
      } catch (err) {
        console.error(`[calculator.load.${t}] failed:`, err);
        return [] as CalcItem[];
      }
    }),
  );
  return results.flat().sort((a, b) => {
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return a.title.localeCompare(b.title, "ru");
  });
}
