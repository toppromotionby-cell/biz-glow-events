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
      const patch: Record<string, unknown> = {};
      if ((s.category_ids ?? []).length !== ids.length) patch['category_ids'] = ids;
      if (s.auto_hidden !== shouldHide) patch['auto_hidden'] = shouldHide;
      if (Object.keys(patch).length === 0) continue;
      await supabaseAdmin.from("catalog_sections").update(patch).eq("key", s.key);
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
