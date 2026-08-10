// Единый источник навигации по каталогу: разделы (catalog_sections) +
// направления (catalog_categories) + количество опубликованных позиций.
// Используется мега-меню в шапке, страницей /catalog и футером.
import { createServerFn } from "@tanstack/react-start";
import type { CatalogType } from "@/lib/catalog.functions";

export type CatalogNavCategory = {
  id: string;
  name: string;
  description: string;
  count: number;
};

export type CatalogNavSection = {
  key: CatalogType;
  title: string;
  description: string;
  icon: string;
  basePath: "/zones" | "/equipment" | "/services" | "/production" | "/attractions";
  count: number;
  categories: CatalogNavCategory[];
};

const BASE_PATH: Record<CatalogType, CatalogNavSection["basePath"]> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  attractions: "/attractions",
};

const TABLE: Record<CatalogType, string> = {
  zones: "zones",
  tech_equipment: "tech_equipment",
  services: "services",
  production_items: "production_items",
  attractions: "attractions",
};

export const getCatalogNavigation = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [sectionsRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from("catalog_sections")
      .select("key,title,description,icon,sort_order,visible")
      .eq("visible", true)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("catalog_categories")
      .select("id,entity_type,name,description,sort_order,visible")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (sectionsRes.error) {
    console.error("[getCatalogNavigation] sections error:", sectionsRes.error);
    return [] as CatalogNavSection[];
  }
  const sections = (sectionsRes.data ?? []).filter((s) => s.key in BASE_PATH);
  const categories = (categoriesRes.data ?? []) as {
    id: string;
    entity_type: string;
    name: string;
    description: string | null;
    visible: boolean | null;
  }[];

  // Считаем опубликованные позиции по категориям (одним запросом на раздел).
  const counts = await Promise.all(
    sections.map(async (s) => {
      const table = TABLE[s.key as CatalogType];
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("category")
        .eq("published", true);
      if (error) {
        console.error(`[getCatalogNavigation] count error (${table}):`, error);
        return { key: s.key as CatalogType, total: 0, byCategory: new Map<string, number>() };
      }
      const byCategory = new Map<string, number>();
      for (const row of (data ?? []) as { category: string | null }[]) {
        const key = (row.category ?? "").trim().toLowerCase();
        if (!key) continue;
        byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
      }
      return { key: s.key as CatalogType, total: (data ?? []).length, byCategory };
    }),
  );
  const countMap = new Map(counts.map((c) => [c.key, c]));

  return sections.map((s) => {
    const key = s.key as CatalogType;
    const c = countMap.get(key);
    return {
      key,
      title: s.title,
      description: s.description ?? "",
      icon: s.icon ?? "",
      basePath: BASE_PATH[key],
      count: c?.total ?? 0,
      categories: categories
        .filter((cat) => cat.entity_type === key && cat.visible !== false)
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description ?? "",
          count: c?.byCategory.get(cat.name.trim().toLowerCase()) ?? 0,
        }))
        .filter((cat) => cat.count > 0),
    } satisfies CatalogNavSection;
  });
});
