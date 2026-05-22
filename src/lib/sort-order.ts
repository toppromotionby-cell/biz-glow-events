// Утилиты для пакетной записи порядка сортировки в Supabase.
import { supabase } from "@/integrations/supabase/client";

// Таблицы, которые поддерживают sort_order и используют id как PK.
type SortableTable =
  | "testimonials" | "blog_posts" | "cases"
  | "zones" | "tech_equipment" | "services" | "production_items";

export async function persistSortOrder(table: SortableTable, orderedIds: string[]) {
  // Обновляем по одной записи — пакетный upsert с пустым телом не пройдёт
  // RLS-проверок на колонки, не входящие в политики. Несколько небольших
  // UPDATE-ов гораздо проще, и для admin-списков их хватает.
  const updates = orderedIds.map((id, sort_order) =>
    supabase.from(table).update({ sort_order }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
}

export async function persistSiteSectionsOrder(orderedKeys: string[]) {
  const updates = orderedKeys.map((key, sort_order) =>
    supabase.from("site_sections").update({ sort_order }).eq("key", key),
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
}
