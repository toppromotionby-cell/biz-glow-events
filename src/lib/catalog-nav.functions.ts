// Единый источник навигации по каталогу: разделы (catalog_sections) +
// направления (catalog_categories) + количество опубликованных позиций.
// Используется мега-меню в шапке, страницей /catalog и футером.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CatalogType } from "@/lib/catalog.functions";

export type CatalogNavCategory = {
  id: string;
  name: string;
  description: string;
  count: number;
};

export type CatalogNavSection = {
  key: string;
  /** native — реальный раздел каталога, virtual — своя витрина из направлений. */
  kind: "native" | "virtual";
  /** Только для virtual: адрес витрины /catalog/<slug>. */
  slug: string | null;
  title: string;
  description: string;
  icon: string;
  basePath: string;
  count: number;
  categories: CatalogNavCategory[];
};

const BASE_PATH: Record<CatalogType, string> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  attractions: "/attractions",
};

const TABLE = {
  zones: "zones",
  tech_equipment: "tech_equipment",
  services: "services",
  production_items: "production_items",
  attractions: "attractions",
} as const;

type SectionRow = {
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  visible: boolean | null;
  kind: string | null;
  slug: string | null;
  category_ids: string[] | null;
  auto_hidden: boolean | null;
};

export const getCatalogNavigation = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [sectionsRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from("catalog_sections")
      .select("key,title,description,icon,sort_order,visible,kind,slug,category_ids,auto_hidden")
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
  const allSections = (sectionsRes.data ?? []) as SectionRow[];
  const nativeSections = allSections.filter((s) => (s.kind ?? "native") === "native" && s.key in BASE_PATH);
  const virtualSections = allSections.filter((s) => s.kind === "virtual" && !s.auto_hidden && s.slug);

  const categories = (categoriesRes.data ?? []) as {
    id: string;
    entity_type: string;
    name: string;
    description: string | null;
    visible: boolean | null;
  }[];

  // Считаем опубликованные позиции по категориям (одним запросом на тип).
  const counts = await Promise.all(
    (Object.keys(TABLE) as CatalogType[]).map(async (key) => {
      const { data, error } = await supabaseAdmin
        .from(TABLE[key])
        .select("category")
        .eq("published", true);
      if (error) {
        console.error(`[getCatalogNavigation] count error (${key}):`, error);
        return { key, total: 0, byCategory: new Map<string, number>() };
      }
      const byCategory = new Map<string, number>();
      for (const row of (data ?? []) as { category: string | null }[]) {
        const k = (row.category ?? "").trim().toLowerCase();
        if (!k) continue;
        byCategory.set(k, (byCategory.get(k) ?? 0) + 1);
      }
      return { key, total: (data ?? []).length, byCategory };
    }),
  );
  const countMap = new Map(counts.map((c) => [c.key, c]));

  const catCount = (entityType: string, name: string) =>
    countMap.get(entityType as CatalogType)?.byCategory.get(name.trim().toLowerCase()) ?? 0;

  const native: CatalogNavSection[] = nativeSections.map((s) => {
    const key = s.key as CatalogType;
    const c = countMap.get(key);
    return {
      key,
      kind: "native",
      slug: null,
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
          count: catCount(cat.entity_type, cat.name),
        }))
        .filter((cat) => cat.count > 0),
    };
  });

  const byId = new Map(categories.map((c) => [c.id, c]));
  const virtual: CatalogNavSection[] = virtualSections.map((s) => {
    const cats = (s.category_ids ?? [])
      .map((id) => byId.get(id))
      .filter((c): c is (typeof categories)[number] => Boolean(c))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        count: catCount(c.entity_type, c.name),
      }))
      .filter((c) => c.count > 0);
    return {
      key: s.key,
      kind: "virtual",
      slug: s.slug,
      title: s.title,
      description: s.description ?? "",
      icon: s.icon ?? "Sparkles",
      basePath: `/catalog/${s.slug}`,
      count: cats.reduce((sum, c) => sum + c.count, 0),
      categories: cats,
    };
  }).filter((s) => s.categories.length > 0);

  return [...native, ...virtual];
});

/** Данные витрины своего раздела: /catalog/<slug>. */
export const getVirtualSection = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: section } = await supabaseAdmin
      .from("catalog_sections")
      .select("key,title,description,icon,slug,category_ids,visible,kind")
      .eq("slug", data.slug)
      .eq("kind", "virtual")
      .maybeSingle();
    if (!section || section.visible === false) return null;

    const ids = (section.category_ids ?? []) as string[];
    if (ids.length === 0) {
      return { title: section.title, description: section.description ?? "", groups: [] };
    }
    const { data: cats } = await supabaseAdmin
      .from("catalog_categories")
      .select("id,entity_type,name")
      .in("id", ids);

    const byType = new Map<CatalogType, string[]>();
    for (const c of (cats ?? []) as { entity_type: string; name: string }[]) {
      if (!(c.entity_type in TABLE)) continue;
      const t = c.entity_type as CatalogType;
      byType.set(t, [...(byType.get(t) ?? []), c.name]);
    }

    const { listCatalog } = await import("@/lib/catalog.functions");
    const groups = await Promise.all(
      Array.from(byType.entries()).map(async ([type, names]) => {
        const rows = await listCatalog({ data: { type } });
        const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
        return {
          type,
          basePath: BASE_PATH[type],
          categories: names,
          rows: rows.filter((r) => wanted.has((r.category ?? "").trim().toLowerCase())),
        };
      }),
    );

    return {
      title: section.title,
      description: section.description ?? "",
      groups: groups.filter((g) => g.rows.length > 0),
    };
  });
