// Загрузка данных КП для сборки презентации (сервер).
import { computeTotals, normalizeQuote, type QuoteItem } from "@/lib/quotes-model";
import { toCardExcerpt } from "@/lib/rich-text";
import type { StoryItem, StoryMeta, StoryTotals } from "@/lib/presentations/from-quote";

const CATALOG_TABLES = ["zones", "tech_equipment", "services", "production_items", "attractions"] as const;

type Row = Record<string, unknown>;

export type QuoteStory = { meta: StoryMeta; items: StoryItem[]; totals: StoryTotals };

const str = (v: unknown) => String(v ?? "").trim();

/** Карточки каталога с фото — источник изображений для слайдов позиций. */
async function loadCards(items: StoryItem[]) {
  const map = new Map<string, { description: string; images: string[]; features: string[] }>();
  const byTable = new Map<string, string[]>();
  for (const it of items) {
    if (!it.entity_type || !it.entity_id) continue;
    if (!(CATALOG_TABLES as readonly string[]).includes(it.entity_type)) continue;
    const arr = byTable.get(it.entity_type) ?? [];
    arr.push(it.entity_id);
    byTable.set(it.entity_type, arr);
  }
  if (!byTable.size) return map;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await Promise.all(
    [...byTable.entries()].map(async ([table, ids]) => {
      const { data } = await supabaseAdmin
        .from(table as "zones")
        .select("id,title,description,photo_urls,features")
        .in("id", ids);
      for (const r of ((data ?? []) as unknown as Row[])) {
        const photos = Array.isArray(r.photo_urls) ? (r.photo_urls as unknown[]).map(String).filter(Boolean) : [];
        const features = Array.isArray(r.features)
          ? (r.features as unknown[])
              .map((f) => (typeof f === "string" ? f : str((f as Row)?.title)))
              .filter(Boolean)
          : [];
        map.set(`${table}:${String(r.id)}`, {
          description: toCardExcerpt(r.description as string | null, 260),
          images: photos,
          features: features.slice(0, 6),
        });
      }
    }),
  );
  return map;
}

type Client = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: Row | null }>;
        order: (c: string) => Promise<{ data: Row[] | null }>;
      };
    };
  };
};

/** Полные данные КП: мета, позиции с фото каталога и итоги. */
export async function loadQuoteStory(supabase: unknown, quoteId: string): Promise<QuoteStory> {
  const client = supabase as Client;
  const [{ data: qrow }, { data: irows }] = await Promise.all([
    client.from("quotes").select("*").eq("id", quoteId).maybeSingle(),
    client.from("quote_items").select("*").eq("quote_id", quoteId).order("sort_order"),
  ]);
  if (!qrow) throw new Error("КП не найдено");

  const quote = normalizeQuote(qrow);
  const rows = (irows ?? []) as Row[];

  const items: StoryItem[] = rows.map((r) => ({
    id: String(r.id),
    title: str(r.title),
    description: str(r.description),
    qty: Number(r.qty ?? 1) || 1,
    unit: str(r.unit) || "шт.",
    price: Number(r.price ?? 0) || 0,
    includes: Array.isArray(r.includes) ? (r.includes as unknown[]).map(String).filter(Boolean) : [],
    entity_type: r.entity_type ? String(r.entity_type) : null,
    entity_id: r.entity_id ? String(r.entity_id) : null,
    section: str(r.section),
  }));

  const cards = await loadCards(items);
  for (const it of items) {
    const card = cards.get(`${it.entity_type}:${it.entity_id}`);
    if (!card) continue;
    it.images = card.images;
    it.image = card.images[0] ?? null;
    it.cardDescription = card.description;
    it.cardFeatures = card.features;
  }

  const t = computeTotals(
    quote,
    rows.map((r) => ({ qty: Number(r.qty ?? 1) || 1, price: Number(r.price ?? 0) || 0, cost: Number(r.cost ?? 0) || 0 })) as Array<
      Pick<QuoteItem, "qty" | "price"> & { cost?: number }
    >,
  );

  const meta: StoryMeta = {
    title: quote.title || "Коммерческое предложение",
    number: String(quote.quote_number ?? "").replaceAll("/", "."),
    clientName: quote.client_name ?? "",
    clientCompany: quote.client_company ?? "",
    eventDate: quote.event_date ?? "",
    venue: quote.venue ?? "",
    about: quote.texts?.intro ?? "",
    terms: quote.texts?.terms ?? "",
    currency: "BYN",
  };

  const totals: StoryTotals = {
    subtotal: t.subtotal,
    discount: t.discount,
    delivery: t.delivery,
    management: t.management,
    agencyFee: t.agencyFee,
    vat: t.vat,
    total: t.total,
    prepayment: t.prepayment,
  };

  return { meta, items, totals };
}
