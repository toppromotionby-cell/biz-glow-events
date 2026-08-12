import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mediaPublicUrl } from "@/lib/media-url";
import { getDemandScores } from "@/lib/demand.server";

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

export type HomeFeatured = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  photo_urls: string[] | null;
  basePath: string;
  pricing: JsonValue;
};
export type HomeBlogTeaser = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
};
export type HomeCaseTeaser = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  event_type: string | null;
  guests_count: number | null;
};

export type HomeData = {
  featured: HomeFeatured[];
  posts: HomeBlogTeaser[];
  cases: HomeCaseTeaser[];
};

const EMPTY_HOME: HomeData = { featured: [], posts: [], cases: [] };

type EntityType = "zones" | "tech_equipment" | "services" | "production_items" | "attractions";
const TABLES: { name: EntityType; base: string }[] = [
  { name: "zones", base: "/zones" },
  { name: "tech_equipment", base: "/equipment" },
  { name: "services", base: "/services" },
  { name: "production_items", base: "/production" },
  { name: "attractions", base: "/attractions" },
];

// Веса сигналов популярности от зарегистрированных пользователей.
const WEIGHT_ORDER = 3;
const WEIGHT_CART = 1;

// fail-soft: любая ошибка одного запроса не должна валить SSR главной.
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[home.${label}] failed:`, err);
    return fallback;
  }
}

async function buildPopularityScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const bump = (entity_type: string, entity_id: string, w: number) => {
    if (!entity_type || !entity_id) return;
    const k = `${entity_type}:${entity_id}`;
    scores.set(k, (scores.get(k) ?? 0) + w);
  };

  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const orderRows = await safe(
    "popularity.orders",
    async () => {
      const { data } = await supabaseAdmin
        .from("order_items")
        .select("entity_type, entity_id, qty, orders!inner(created_at)")
        .gte("orders.created_at", since)
        .limit(2000);
      return (data ?? []) as Array<{ entity_type: string; entity_id: string | null; qty: number | null }>;
    },
    [],
  );
  for (const r of orderRows) {
    if (!r.entity_id) continue;
    bump(r.entity_type, r.entity_id, WEIGHT_ORDER * Math.max(1, r.qty ?? 1));
  }

  const drafts = await safe(
    "popularity.carts",
    async () => {
      const { data } = await supabaseAdmin
        .from("cart_drafts")
        .select("items, user_id")
        .limit(2000);
      return (data ?? []) as Array<{ items: unknown }>;
    },
    [],
  );
  for (const d of drafts) {
    const arr = Array.isArray(d.items) ? (d.items as Array<Record<string, unknown>>) : [];
    for (const it of arr) {
      const et = String(it?.entity_type ?? "");
      const id = String(it?.id ?? "");
      const qty = Number(it?.qty ?? 1) || 1;
      bump(et, id, WEIGHT_CART * Math.max(1, qty));
    }
  }

  // Сигналы спроса: просмотры, «Подробнее», запросы КП, корзина, заказы (в т.ч. гостевые).
  const demand = await safe("popularity.demand", () => getDemandScores(), new Map<string, number>());
  for (const [k, v] of demand) scores.set(k, (scores.get(k) ?? 0) + v);

  return scores;
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  try {
    const scores = await safe("popularity", () => buildPopularityScores(), new Map<string, number>());

    const featuredResults = await Promise.all(
      TABLES.map((t) =>
        safe(
          `featured.${t.name}`,
          async () => {
            const { data } = await supabaseAdmin
              .from(t.name)
              .select("id, slug, title, description, photo_urls, pricing, updated_at")
              .eq("published", true)
              .order("updated_at", { ascending: false })
              .limit(40);
            const rows = (data ?? []) as Array<{
              id: string;
              slug: string;
              title: string;
              description: string | null;
              photo_urls: string[] | null;
              pricing: JsonValue;
              updated_at: string;
            }>;
            return rows
              .map((row) => ({
                row,
                score: scores.get(`${t.name}:${row.id}`) ?? 0,
                basePath: t.base,
              }))
              .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (b.row.updated_at ?? "").localeCompare(a.row.updated_at ?? "");
              })
              .slice(0, 2)
              .map(({ row, basePath }) => {
                const { updated_at: _u, ...rest } = row;
                return { ...rest, basePath } as HomeFeatured;
              });
          },
          [] as HomeFeatured[],
        ),
      ),
    );

    const merged = featuredResults
      .flat()
      .map((item) => ({ item, score: scores.get(`${detectType(item.basePath)}:${item.id}`) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
    const featured = merged.slice(0, 6);

    // Каталог публичный: пути хранилища → постоянные публичные ссылки.
    for (const f of featured) {
      f.photo_urls = (f.photo_urls ?? []).map((u) => (u ? mediaPublicUrl(u) : u));
    }

    const posts = await safe<HomeBlogTeaser[]>(
      "posts",
      async () => {
        const { data } = await supabaseAdmin
          .from("blog_posts")
          .select("id, slug, title, excerpt, cover_url, published_at")
          .eq("published", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(3);
        return (data ?? []) as HomeBlogTeaser[];
      },
      [],
    );

    const cases = await safe<HomeCaseTeaser[]>(
      "cases",
      async () => {
        const { data } = await supabaseAdmin
          .from("cases")
          .select("id, slug, title, summary, cover_url, event_type, guests_count")
          .eq("published", true)
          .order("event_date", { ascending: false, nullsFirst: false })
          .limit(3);
        return (data ?? []) as HomeCaseTeaser[];
      },
      [],
    );

    return { featured, posts, cases };
  } catch (err) {
    // Никогда не валим SSR главной — лучше отрендерить без рекомендаций,
    // чем показать "Страница не загрузилась".
    console.error("[home.getHomeData] catastrophic failure:", err);
    return EMPTY_HOME;
  }
});

function detectType(base: string): EntityType {
  switch (base) {
    case "/zones":
      return "zones";
    case "/equipment":
      return "tech_equipment";
    case "/services":
      return "services";
    case "/production":
      return "production_items";
    default:
      return "zones";
  }
}
