import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

export type HomeFeatured = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
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

type EntityType = "zones" | "tech_equipment" | "services" | "production_items";
const TABLES: { name: EntityType; base: string }[] = [
  { name: "zones", base: "/zones" },
  { name: "tech_equipment", base: "/equipment" },
  { name: "services", base: "/services" },
  { name: "production_items", base: "/production" },
];

// Веса сигналов популярности от зарегистрированных пользователей.
const WEIGHT_ORDER = 3;
const WEIGHT_CART = 1;

async function buildPopularityScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const bump = (entity_type: string, entity_id: string, w: number) => {
    if (!entity_type || !entity_id) return;
    const k = `${entity_type}:${entity_id}`;
    scores.set(k, (scores.get(k) ?? 0) + w);
  };

  // 1) Заказы зарегистрированных пользователей за последние 180 дней.
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const { data: orderRows } = await supabaseAdmin
    .from("order_items")
    .select("entity_type, entity_id, qty, orders!inner(user_id, created_at)")
    .gte("orders.created_at", since)
    .not("orders.user_id", "is", null)
    .limit(2000);
  for (const r of (orderRows ?? []) as Array<{
    entity_type: string;
    entity_id: string | null;
    qty: number | null;
  }>) {
    if (!r.entity_id) continue;
    bump(r.entity_type, r.entity_id, WEIGHT_ORDER * Math.max(1, r.qty ?? 1));
  }

  // 2) Активные корзины зарегистрированных пользователей.
  const { data: drafts } = await supabaseAdmin
    .from("cart_drafts")
    .select("items, user_id")
    .not("user_id", "is", null)
    .limit(2000);
  for (const d of (drafts ?? []) as Array<{ items: unknown }>) {
    const arr = Array.isArray(d.items) ? (d.items as Array<Record<string, unknown>>) : [];
    for (const it of arr) {
      const et = String(it?.entity_type ?? "");
      const id = String(it?.id ?? "");
      const qty = Number(it?.qty ?? 1) || 1;
      bump(et, id, WEIGHT_CART * Math.max(1, qty));
    }
  }

  return scores;
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const scores = await buildPopularityScores();

  // Тянем опубликованные карточки каждого типа, сортируем по score, fallback — updated_at.
  const featuredResults = await Promise.all(
    TABLES.map(async (t) => {
      const { data } = await supabaseAdmin
        .from(t.name)
        .select("id, slug, title, short_description, photo_urls, pricing, updated_at")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(40);
      const rows = (data ?? []) as Array<{
        id: string;
        slug: string;
        title: string;
        short_description: string | null;
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
    }),
  );

  // Сводим вместе и финально пересортируем по score, чтобы топовые шли первыми.
  const merged = featuredResults
    .flat()
    .map((item) => ({ item, score: scores.get(`${detectType(item.basePath)}:${item.id}`) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
  const featured = merged.slice(0, 6);

  // Подписываем ВСЕ фото каждой featured-карточки одним батчем
  // (bucket приватный — anon не может подписывать на клиенте, иначе
  //  слайды 2..N в автоскролинге останутся пульсирующим скелетом).
  {
    const paths = new Set<string>();
    for (const f of featured) {
      for (const u of f.photo_urls ?? []) {
        if (u && !/^(https?:|blob:|data:)/i.test(u)) paths.add(u);
      }
    }
    if (paths.size > 0) {
      const list = Array.from(paths);
      const TTL = 60 * 60 * 24 * 7; // 7 дней
      const { data, error } = await supabaseAdmin.storage
        .from("media")
        .createSignedUrls(list, TTL);
      if (error) {
        console.error("[home.featured] createSignedUrls failed:", error);
      } else if (data) {
        const map = new Map<string, string>();
        data.forEach((d, i) => { if (d.signedUrl) map.set(list[i], d.signedUrl); });
        for (const f of featured) {
          f.photo_urls = (f.photo_urls ?? []).map((u) =>
            u && !/^(https?:|blob:|data:)/i.test(u) ? map.get(u) ?? u : u,
          );
        }
      }
    }
  }

  const { data: blog } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_url, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(3);

  const { data: cs } = await supabaseAdmin
    .from("cases")
    .select("id, slug, title, summary, cover_url, event_type, guests_count")
    .eq("published", true)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(3);

  return {
    featured,
    posts: (blog ?? []) as HomeBlogTeaser[],
    cases: (cs ?? []) as HomeCaseTeaser[],
  };
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
