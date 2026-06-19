// Типы каталога: zones | tech_equipment | services | production_items.
// Все 4 таблицы имеют одинаковый набор колонок (см. supabase types.ts),
// поэтому общий «shared»-тип эквивалентен Row любой из них.
import type { Database } from "@/integrations/supabase/types";

export const CATALOG_TABLES = [
  "zones",
  "tech_equipment",
  "services",
  "production_items",
] as const;

export type CatalogTable = (typeof CATALOG_TABLES)[number];

export type CatalogRow<T extends CatalogTable = CatalogTable> =
  Database["public"]["Tables"][T]["Row"];
export type CatalogInsert<T extends CatalogTable = CatalogTable> =
  Database["public"]["Tables"][T]["Insert"];
export type CatalogUpdate<T extends CatalogTable = CatalogTable> =
  Database["public"]["Tables"][T]["Update"];

// Дискриминированный union с тегом `__table` — пригождается, когда нужно
// одновременно носить и строку, и её таблицу через границу компонента.
export type CatalogRowTagged =
  | (CatalogRow<"zones"> & { readonly __table: "zones" })
  | (CatalogRow<"tech_equipment"> & { readonly __table: "tech_equipment" })
  | (CatalogRow<"services"> & { readonly __table: "services" })
  | (CatalogRow<"production_items"> & { readonly __table: "production_items" });

export type AnyCatalogRow =
  | CatalogRow<"zones">
  | CatalogRow<"tech_equipment">
  | CatalogRow<"services">
  | CatalogRow<"production_items">;

export const CATALOG_LABELS: Record<CatalogTable, string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Производство",
};

export function isCatalogTable(value: string): value is CatalogTable {
  return (CATALOG_TABLES as readonly string[]).includes(value);
}

export function tagRow<T extends CatalogTable>(table: T, row: CatalogRow<T>): CatalogRowTagged {
  return { ...row, __table: table } as CatalogRowTagged;
}
