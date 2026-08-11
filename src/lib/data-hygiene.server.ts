// Гигиена данных портала: поиск дублей и «пустых» карточек по каталогу и контенту.
// Только серверный код, доступ — из админки под проверкой прав.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HygieneTable =
  | "zones"
  | "services"
  | "tech_equipment"
  | "production_items"
  | "attractions"
  | "cases"
  | "blog_posts"
  | "catalog_sections";

export const HYGIENE_TABLES: Array<{ table: HygieneTable; label: string; hasPublished: boolean }> = [
  { table: "zones", label: "Зоны", hasPublished: true },
  { table: "services", label: "Услуги", hasPublished: true },
  { table: "tech_equipment", label: "Техника и оборудование", hasPublished: true },
  { table: "production_items", label: "Продакшн", hasPublished: true },
  { table: "attractions", label: "Аттракционы", hasPublished: true },
  { table: "cases", label: "Кейсы", hasPublished: true },
  { table: "blog_posts", label: "Блог", hasPublished: true },
  { table: "catalog_sections", label: "Разделы каталога", hasPublished: false },
];

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Нормализация названия: регистр, ё/е, пробелы, знаки препинания. */
export function normalizeTitle(v: unknown): string {
  return s(v)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type HygieneRecord = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  hasDescription: boolean;
  hasImage: boolean;
  updated_at: string;
};

export type DuplicateGroup = {
  table: HygieneTable;
  label: string;
  reason: "title" | "slug" | "image";
  key: string;
  records: HygieneRecord[];
};

export type HygieneReport = {
  scannedAt: string;
  groups: DuplicateGroup[];
  incomplete: Array<{ table: HygieneTable; label: string; records: HygieneRecord[] }>;
  totals: { records: number; duplicateGroups: number; duplicateRecords: number; incomplete: number };
};

const imageOf = (r: Record<string, unknown>): string => {
  const direct = s(r["cover_url"]) || s(r["image_url"]) || s(r["cover"]);
  if (direct) return direct;
  const gallery = r["gallery"] ?? r["images"];
  if (Array.isArray(gallery) && gallery.length) {
    const first = gallery[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return s((first as Record<string, unknown>)["url"]);
  }
  return "";
};

async function loadTable(table: HygieneTable): Promise<HygieneRecord[]> {
  const { data, error } = await supabaseAdmin.from(table).select("*").limit(2000);
  if (error) {
    console.error(`[hygiene] load ${table} failed`, error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"]),
    title: s(r["title"]) || s(r["name"]) || "Без названия",
    slug: s(r["slug"]),
    published: r["published"] == null ? true : Boolean(r["published"]),
    hasDescription: s(r["description"]).replace(/<[^>]*>/g, "").trim().length > 30,
    hasImage: Boolean(imageOf(r)),
    updated_at: s(r["updated_at"]) || s(r["created_at"]),
  }));
}

function groupBy(
  table: HygieneTable,
  label: string,
  reason: DuplicateGroup["reason"],
  rows: HygieneRecord[],
  keyOf: (r: HygieneRecord) => string,
): DuplicateGroup[] {
  const map = new Map<string, HygieneRecord[]>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return Array.from(map.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      table,
      label,
      reason,
      key,
      records: list.sort((a, b) => Number(b.published) - Number(a.published) || b.updated_at.localeCompare(a.updated_at)),
    }));
}

/** Полное сканирование портала на дубли и незаполненные карточки. */
export async function scanHygiene(): Promise<HygieneReport> {
  const groups: DuplicateGroup[] = [];
  const incomplete: HygieneReport["incomplete"] = [];
  let records = 0;

  for (const src of HYGIENE_TABLES) {
    const rows = await loadTable(src.table);
    records += rows.length;

    const byTitle = groupBy(src.table, src.label, "title", rows, (r) => normalizeTitle(r.title));
    const titleIds = new Set(byTitle.flatMap((g) => g.records.map((r) => r.id)));
    const bySlug = groupBy(src.table, src.label, "slug", rows, (r) => r.slug.toLowerCase()).filter(
      (g) => !g.records.every((r) => titleIds.has(r.id)),
    );
    groups.push(...byTitle, ...bySlug);

    const bad = rows.filter((r) => !r.hasDescription || !r.hasImage);
    if (bad.length) incomplete.push({ table: src.table, label: src.label, records: bad.slice(0, 100) });
  }

  const duplicateRecords = groups.reduce((acc, g) => acc + (g.records.length - 1), 0);
  return {
    scannedAt: new Date().toISOString(),
    groups,
    incomplete,
    totals: {
      records,
      duplicateGroups: groups.length,
      duplicateRecords,
      incomplete: incomplete.reduce((acc, g) => acc + g.records.length, 0),
    },
  };
}

/** Скрыть выбранные записи (снять публикацию) — безопасная альтернатива удалению. */
export async function hideRecords(table: HygieneTable, ids: string[]): Promise<number> {
  const list = ids.filter(Boolean);
  if (!list.length) return 0;
  const meta = HYGIENE_TABLES.find((t) => t.table === table);
  if (!meta?.hasPublished) throw new Error("Для этого раздела скрытие недоступно");
  const { error } = await supabaseAdmin.from(table).update({ published: false } as never).in("id", list);
  if (error) throw new Error(error.message);
  return list.length;
}

/** Удалить выбранные записи. */
export async function deleteRecords(table: HygieneTable, ids: string[]): Promise<number> {
  const list = ids.filter(Boolean);
  if (!list.length) return 0;
  const { error } = await supabaseAdmin.from(table).delete().in("id", list);
  if (error) throw new Error(error.message);
  return list.length;
}
