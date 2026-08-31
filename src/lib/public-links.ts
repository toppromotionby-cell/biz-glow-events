// Реестр публичных ссылок: по типу сущности из админки строит путь на сайте.
// Используется кнопками «Открыть на сайте», чтобы пути не расползались по компонентам.

export type PublicEntity =
  | "zones"
  | "tech_equipment"
  | "services"
  | "production_items"
  | "attractions"
  | "case"
  | "blog"
  | "landing"
  | "dj_track"
  | "dj_software";

/** Базовые публичные разделы. */
export const PUBLIC_SECTION: Record<PublicEntity, string> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  attractions: "/attractions",
  case: "/cases",
  blog: "/blog",
  landing: "/lp",
  dj_track: "/dj/pool",
  dj_software: "/dj/software",
};

/** Сущности без собственной страницы: ведём на раздел со списком. */
const SECTION_ONLY: PublicEntity[] = ["dj_track", "dj_software"];

export type PublicRow = {
  slug?: string | null;
  published?: boolean | null;
  id?: string | null;
};

/**
 * Публичный путь записи или null, если страницы ещё нет
 * (черновик, нет slug, сущность без отдельной страницы — тогда раздел).
 */
export function publicHrefFor(entity: PublicEntity, row: PublicRow): string | null {
  const section = PUBLIC_SECTION[entity];
  if (!section) return null;
  if (SECTION_ONLY.includes(entity)) return section;
  if (row.published === false) return null;
  const slug = (row.slug ?? "").trim();
  if (!slug) return null;
  return `${section}/${slug}`;
}

/** Причина, по которой кнопка «Открыть на сайте» недоступна. */
export function publicHrefReason(entity: PublicEntity, row: PublicRow): string | null {
  if (publicHrefFor(entity, row)) return null;
  if (row.published === false) return "Страница появится после публикации";
  if (!(row.slug ?? "").trim()) return "Сначала заполните адрес страницы (slug)";
  return "Публичная страница недоступна";
}

/** Абсолютная ссылка для писем и копирования. */
export function absolutePublicUrl(path: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
