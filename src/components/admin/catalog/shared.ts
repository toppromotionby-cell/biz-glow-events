import type { Json } from "@/integrations/supabase/types";
import type { CatalogRow, CatalogTable } from "@/lib/admin/catalog-types";
import { getTiers } from "@/components/PriceTable";

export type Row = CatalogRow<CatalogTable>;

export type ExtraItem = { label?: string; value?: string };
export type FaqItem = { q?: string; question?: string; a?: string; answer?: string };
export type FeatureItem = string | { label?: string; value?: string };

export function asArray<T>(value: Json | null | undefined): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

// Признак «черновика»: нет фото / нет цены / нет описания.
export function draftIssues(it: Row): string[] {
  const issues: string[] = [];
  if (!it.photo_urls?.length) issues.push("нет фото");
  if (!getTiers(it.pricing).length) issues.push("нет цены");
  if (!it.description) issues.push("нет описания");
  return issues;
}
