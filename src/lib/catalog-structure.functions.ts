// Управление структурой каталога: свои (виртуальные) разделы и автоочистка
// направлений, в которых не осталось опубликованных позиций.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CatalogType } from "@/lib/catalog.functions";

export const NATIVE_KEYS = [
  "zones",
  "tech_equipment",
  "services",
  "production_items",
  "attractions",
] as const;

export const NATIVE_TABLE: Record<CatalogType, CatalogType> = {
  zones: "zones",
  tech_equipment: "tech_equipment",
  services: "services",
  production_items: "production_items",
  attractions: "attractions",
};

/** Защитный период: новое направление не удаляем сутки, пока в него не добавили позиции. */
const GRACE_MS = 24 * 60 * 60 * 1000;

export type CleanupReport = {
  removedCategories: string[];
  hiddenSections: string[];
  shownSections: string[];
};

type CountMap = Map<CatalogType, Map<string, number>>;

async function loadCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
): Promise<CountMap> {
  const result: CountMap = new Map();
  await Promise.all(
    NATIVE_KEYS.map(async (key) => {
      const { data, error } = await supabaseAdmin
        .from(NATIVE_TABLE[key])
        .select("category")
        .eq("published", true);
      const map = new Map<string, number>();
      if (!error) {
        for (const row of (data ?? []) as { category: string | null }[]) {
          const k = (row.category ?? "").trim().toLowerCase();
          if (!k) continue;
          map.set(k, (map.get(k) ?? 0) + 1);
        }
      }
      result.set(key, map);
    }),
  );
  return result;
}

/**
 * Синхронизация справочника с карточками:
 *  - удаляет направления без опубликованных позиций (старше 24 часов);
 *  - удаляет «сиротские» направления несуществующих разделов;
 *  - скрывает свои разделы, в которых не осталось живых направлений.
 */
export const cleanupCatalogStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CleanupReport> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: cats }, { data: sections }, counts] = await Promise.all([
      supabaseAdmin.from("catalog_categories").select("id,entity_type,name,created_at"),
      supabaseAdmin.from("catalog_sections").select("key,title,kind,category_ids,auto_hidden"),
      loadCounts(supabaseAdmin),
    ]);

    const now = Date.now();
    const removed: string[] = [];
    const survivors = new Set<string>();

    for (const c of (cats ?? []) as {
      id: string;
      entity_type: string;
      name: string;
      created_at: string;
    }[]) {
      const isNative = (NATIVE_KEYS as readonly string[]).includes(c.entity_type);
      const count = isNative
        ? counts.get(c.entity_type as CatalogType)?.get(c.name.trim().toLowerCase()) ?? 0
        : 0;
      const fresh = now - new Date(c.created_at).getTime() < GRACE_MS;
      if (!isNative || (count === 0 && !fresh)) {
        removed.push(`${c.name}`);
        await supabaseAdmin.from("catalog_categories").delete().eq("id", c.id);
      } else {
        survivors.add(c.id);
      }
    }

    const hidden: string[] = [];
    const shown: string[] = [];
    for (const s of (sections ?? []) as {
      key: string;
      title: string;
      kind: string;
      category_ids: string[] | null;
      auto_hidden: boolean;
    }[]) {
      if (s.kind !== "virtual") continue;
      const ids = (s.category_ids ?? []).filter((id) => survivors.has(id));
      const shouldHide = ids.length === 0;
      const idsChanged = (s.category_ids ?? []).length !== ids.length;
      const hideChanged = s.auto_hidden !== shouldHide;
      if (!idsChanged && !hideChanged) continue;
      await supabaseAdmin
        .from("catalog_sections")
        .update({ category_ids: ids, auto_hidden: shouldHide })
        .eq("key", s.key);
      if (s.auto_hidden !== shouldHide) (shouldHide ? hidden : shown).push(s.title);
    }

    return { removedCategories: removed, hiddenSections: hidden, shownSections: shown };
  });

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[аaа]/g, "a")
    .replace(/[^a-z0-9а-я\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

export function makeSlug(value: string): string {
  const translit = value
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("");
  return slugify(translit) || `section-${Date.now()}`;
}

export const createVirtualSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(2).max(80),
        description: z.string().max(240).default(""),
        icon: z.string().max(40).default("Sparkles"),
        slug: z.string().max(60).optional(),
        categoryIds: z.array(z.string().uuid()).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isEditor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "content_editor",
    });
    if (!isAdmin && !isEditor) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = makeSlug(data.slug?.trim() || data.title);
    const key = `virtual_${slug}`.slice(0, 60);

    const { data: last } = await supabaseAdmin
      .from("catalog_sections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("catalog_sections").insert({
      key,
      title: data.title.trim(),
      description: data.description.trim(),
      icon: data.icon || "Sparkles",
      kind: "virtual",
      slug,
      category_ids: data.categoryIds,
      visible: true,
      auto_hidden: data.categoryIds.length === 0,
      sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10,
    });
    if (error) throw new Error(error.message);
    return { key, slug };
  });

export const deleteVirtualSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ key: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isEditor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "content_editor",
    });
    if (!isAdmin && !isEditor) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("catalog_sections")
      .delete()
      .eq("key", data.key)
      .eq("kind", "virtual");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type StructureSection = {
  key: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  visible: boolean;
  kind: "native" | "virtual";
  slug: string | null;
  category_ids: string[];
  auto_hidden: boolean;
  count: number;
};

export type StructureCategory = {
  id: string;
  entity_type: string;
  name: string;
  description: string;
  sort_order: number;
  visible: boolean;
  count: number;
};

/** Полный срез структуры для админки: разделы, направления и счётчики позиций. */
export const getStructureOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: sections }, { data: cats }, counts] = await Promise.all([
      supabaseAdmin
        .from("catalog_sections")
        .select("key,title,description,icon,sort_order,visible,kind,slug,category_ids,auto_hidden")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("catalog_categories")
        .select("id,entity_type,name,description,sort_order,visible")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      loadCounts(supabaseAdmin),
    ]);

    const catRows: StructureCategory[] = ((cats ?? []) as Record<string, unknown>[]).map((c) => ({
      id: String(c['id']),
      entity_type: String(c['entity_type']),
      name: String(c['name'] ?? ""),
      description: String(c['description'] ?? ""),
      sort_order: Number(c['sort_order'] ?? 0),
      visible: c['visible'] !== false,
      count: counts.get(String(c['entity_type']) as CatalogType)?.get(String(c['name'] ?? "").trim().toLowerCase()) ?? 0,
    }));

    const byId = new Map(catRows.map((c) => [c.id, c]));

    const sectionRows: StructureSection[] = ((sections ?? []) as Record<string, unknown>[]).map((s) => {
      const kind = (s['kind'] === "virtual" ? "virtual" : "native") as "native" | "virtual";
      const ids = (s['category_ids'] as string[] | null) ?? [];
      const total =
        kind === "native"
          ? Array.from(counts.get(String(s['key']) as CatalogType)?.values() ?? []).reduce((a, b) => a + b, 0)
          : ids.reduce((sum, id) => sum + (byId.get(id)?.count ?? 0), 0);
      return {
        key: String(s['key']),
        title: String(s['title'] ?? ""),
        description: String(s['description'] ?? ""),
        icon: String(s['icon'] ?? ""),
        sort_order: Number(s['sort_order'] ?? 0),
        visible: s['visible'] !== false,
        kind,
        slug: (s['slug'] as string | null) ?? null,
        category_ids: ids,
        auto_hidden: s['auto_hidden'] === true,
        count: total,
      };
    });

    return { sections: sectionRows, categories: catRows };
  });

/** Обновление раздела (название/описание/иконка/видимость/состав направлений). */
export const updateSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        key: z.string().min(1),
        title: z.string().min(1).max(80).optional(),
        description: z.string().max(240).optional(),
        icon: z.string().max(40).optional(),
        visible: z.boolean().optional(),
        sort_order: z.number().int().optional(),
        categoryIds: z.array(z.string().uuid()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      title?: string; description?: string; icon?: string;
      visible?: boolean; sort_order?: number; category_ids?: string[]; auto_hidden?: boolean;
    } = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description.trim();
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.visible !== undefined) patch.visible = data.visible;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
    if (data.categoryIds !== undefined) {
      patch.category_ids = data.categoryIds;
      patch.auto_hidden = data.categoryIds.length === 0;
    }
    const { error } = await supabaseAdmin.from("catalog_sections").update(patch).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
