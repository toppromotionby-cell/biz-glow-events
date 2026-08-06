// Маппинг типа каталога на типизированный маршрут TanStack Router.
// Используется в <Link to={...} params={{ slug }}> чтобы навигация была корректной.
import type { CatalogType } from "@/lib/catalog.functions";

export type CatalogSlugRoute =
  | "/zones/$slug"
  | "/equipment/$slug"
  | "/services/$slug"
  | "/production/$slug"
  | "/attractions/$slug";

export const CATALOG_SLUG_ROUTE: Record<CatalogType, CatalogSlugRoute> = {
  zones: "/zones/$slug",
  tech_equipment: "/equipment/$slug",
  services: "/services/$slug",
  production_items: "/production/$slug",
  attractions: "/attractions/$slug",
};

export const CATALOG_BASE_ROUTE: Record<CatalogType, "/zones" | "/equipment" | "/services" | "/production" | "/attractions"> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  attractions: "/attractions",
};
