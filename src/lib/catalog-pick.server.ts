// Поиск позиций по всему каталогу сайта для конструкторов КП и презентаций.
// Читает опубликованные записи всех пяти разделов, приводит их к единой
// модели CatalogPick (текст, «что входит», варианты цены, фотографии).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mediaPublicUrl } from "@/lib/media-url";
import {
  CATALOG_PICK_LABELS, CATALOG_PICK_TYPES,
  type CatalogPick, type CatalogPickType, type CatalogPriceOption,
} from "@/lib/catalog-pick";

const SELECT = "id,title,description,pricing,features,extras,photo_urls,category";

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Все варианты цены из произвольного pricing-объекта каталога. */
export function priceOptionsFromPricing(pricing: unknown): CatalogPriceOption[] {
  const out: CatalogPriceOption[] = [];
  const push = (label: string, price: unknown, unit: unknown) => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    const u = s(unit);
    if (out.some((x) => x.price === p && x.unit === u && x.label === label)) return;
    out.push({ label, price: p, unit: u || "услуга" });
  };

  if (Array.isArray(pricing)) {
    for (const raw of pricing as Array<Record<string, unknown>>) {
      const r = raw ?? {};
      const label = s(r["label"]) || s(r["title"]) || s(r["name"]) || (r["hours"] ? `${r["hours"]} ч` : "");
      push(label, r["price"] ?? r["from"] ?? r["value"], r["unit"]);
    }
  } else if (pricing && typeof pricing === "object") {
    const p = pricing as Record<string, unknown>;
    const unit = p["unit"];
    push("от", p["from"] ?? p["price_from"] ?? p["priceFrom"] ?? p["min"], unit);
    push("базовая", p["base"] ?? p["price"], unit);
    const tiers = p["tiers"] ?? p["options"] ?? p["packages"];
    if (Array.isArray(tiers)) {
      for (const raw of tiers as Array<Record<string, unknown>>) {
        const r = raw ?? {};
        push(s(r["label"]) || s(r["title"]) || s(r["name"]) || "вариант", r["price"] ?? r["from"], r["unit"] ?? unit);
      }
    }
  }

  out.sort((a, b) => a.price - b.price);
  return out;
}

function toPick(type: CatalogPickType, row: Record<string, unknown>): CatalogPick {
  const features = Array.isArray(row["features"]) ? (row["features"] as unknown[]) : [];
  const extras = Array.isArray(row["extras"]) ? (row["extras"] as Array<Record<string, unknown>>) : [];
  const photos = Array.isArray(row["photo_urls"]) ? (row["photo_urls"] as unknown[]) : [];
  return {
    id: String(row["id"]),
    type,
    sectionLabel: s(row["category"]) || CATALOG_PICK_LABELS[type],
    title: s(row["title"]),
    description: s(row["description"]).slice(0, 4000),
    includes: features
      .map((f) => (typeof f === "string" ? f.trim() : s((f as Record<string, unknown>)?.["text"])))
      .filter(Boolean)
      .slice(0, 30),
    specs: extras
      .map((e) => ({ label: s(e?.["label"]), value: s(e?.["value"]) }))
      .filter((e) => e.label || e.value)
      .slice(0, 20),
    priceOptions: priceOptionsFromPricing(row["pricing"]),
    images: photos.map((u) => (typeof u === "string" && u ? mediaPublicUrl(u) : "")).filter(Boolean).slice(0, 10),
  };
}

export async function searchCatalog(opts: {
  term?: string;
  type?: CatalogPickType;
  limit?: number;
}): Promise<CatalogPick[]> {
  const term = s(opts.term);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40));
  const types = opts.type ? [opts.type] : CATALOG_PICK_TYPES;
  const perType = Math.max(5, Math.ceil(limit / types.length) + 5);

  const chunks = await Promise.all(
    types.map(async (type) => {
      let q = supabaseAdmin
        .from(type)
        .select(SELECT)
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .limit(perType);
      if (term) {
        const safe = term.replace(/[%,()]/g, " ").trim();
        if (safe) q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) {
        console.error(`[catalog-pick] ${type} failed`, error.message);
        return [] as CatalogPick[];
      }
      return ((data ?? []) as Array<Record<string, unknown>>)
        .map((r) => toPick(type, r))
        .filter((p) => p.title);
    }),
  );

  return chunks.flat().slice(0, limit);
}
