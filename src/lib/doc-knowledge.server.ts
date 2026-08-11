// База знаний документов: накопление и поиск ранее введённых клиентов,
// позиций и текстов. Наполняется автоматически при сохранении КП/КП Промо/заказов.
// Сбои никогда не должны ломать сохранение документа — всё внутри try/catch.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TextKind = "note" | "footer" | "section" | "venue" | "event_format" | "term";

export type ContactInput = {
  name?: string | null;
  company?: string | null;
  unp?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contact_role?: string | null;
};

export type ItemInput = {
  section?: string | null;
  title?: string | null;
  description?: string | null;
  unit?: string | null;
  price?: number | null;
  cost?: number | null;
  includes?: unknown;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const low = (v: unknown): string => s(v).toLowerCase().replace(/\s+/g, " ");

export function contactKey(c: ContactInput): string {
  return low(c.unp) || low(c.email) || low(c.phone) || low(`${s(c.company)}|${s(c.name)}`).replace(/^\|$/, "");
}

export function itemKey(i: ItemInput): string {
  return `${low(i.section)}|${low(i.title)}`;
}

/** Сохранить/обновить контрагента. */
async function upsertContact(c: ContactInput) {
  const key = contactKey(c);
  if (!key || key === "|") return;

  const { data: existing } = await supabaseAdmin
    .from("doc_contacts")
    .select("id,usage_count,name,company,unp,phone,email,address,contact_role")
    .eq("match_key", key)
    .maybeSingle();

  const next = {
    name: s(c.name) || existing?.name || "",
    company: s(c.company) || existing?.company || "",
    unp: s(c.unp) || existing?.unp || "",
    phone: s(c.phone) || existing?.phone || "",
    email: s(c.email) || existing?.email || "",
    address: s(c.address) || existing?.address || "",
    contact_role: s(c.contact_role) || existing?.contact_role || "",
    last_used_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseAdmin
      .from("doc_contacts")
      .update({ ...next, usage_count: (existing.usage_count ?? 1) + 1 })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("doc_contacts").insert({ match_key: key, ...next });
  }
}

/** Сохранить/обновить позицию каталога документов. */
async function upsertItem(i: ItemInput) {
  const title = s(i.title);
  if (!title) return;
  const key = itemKey(i);

  const { data: existing } = await supabaseAdmin
    .from("doc_item_catalog")
    .select("id,usage_count")
    .eq("match_key", key)
    .maybeSingle();

  const includes = Array.isArray(i.includes) ? i.includes : [];
  const next = {
    section: s(i.section),
    title,
    description: s(i.description),
    unit: s(i.unit) || "шт",
    price: Number(i.price ?? 0) || 0,
    cost: Number(i.cost ?? 0) || 0,
    includes,
    last_used_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseAdmin
      .from("doc_item_catalog")
      .update({ ...next, usage_count: (existing.usage_count ?? 1) + 1 })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("doc_item_catalog").insert({ match_key: key, ...next });
  }
}

/** Сохранить/обновить текстовую заготовку. */
async function upsertText(kind: TextKind, value: unknown) {
  const text = s(value);
  if (text.length < 2 || text.length > 4000) return;
  const key = low(text);

  const { data: existing } = await supabaseAdmin
    .from("doc_text_snippets")
    .select("id,usage_count")
    .eq("kind", kind)
    .eq("match_key", key)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("doc_text_snippets")
      .update({ value: text, usage_count: (existing.usage_count ?? 1) + 1, last_used_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("doc_text_snippets").insert({ kind, match_key: key, value: text });
  }
}

export type KnowledgeHarvest = {
  contacts?: ContactInput[];
  items?: ItemInput[];
  texts?: Array<{ kind: TextKind; value: unknown }>;
};

/** Единая точка накопления. Никогда не бросает исключение наружу. */
export async function harvestKnowledge(input: KnowledgeHarvest): Promise<void> {
  try {
    const jobs: Promise<unknown>[] = [];
    for (const c of input.contacts ?? []) jobs.push(upsertContact(c));

    // Дедупликация позиций внутри одного документа, чтобы не гонять лишние запросы.
    const seen = new Set<string>();
    for (const it of input.items ?? []) {
      const k = itemKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      jobs.push(upsertItem(it));
    }

    const seenText = new Set<string>();
    for (const t of input.texts ?? []) {
      const k = `${t.kind}|${low(t.value)}`;
      if (seenText.has(k)) continue;
      seenText.add(k);
      jobs.push(upsertText(t.kind, t.value));
    }

    await Promise.allSettled(jobs);
  } catch (error) {
    console.error("[doc-knowledge] harvest failed", error);
  }
}

/** Накопление из заказа (вызывается при генерации документов заказа). */
export async function harvestFromOrder(
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
): Promise<void> {
  await harvestKnowledge({
    contacts: [{
      name: order.client_name as string,
      company: order.client_company as string,
      phone: order.client_phone as string,
      email: order.client_email as string,
    }],
    items: (items ?? []).map((it) => ({
      section: (it.entity_type as string) ?? "",
      title: it.title as string,
      unit: "шт",
      price: Number(it.price ?? 0),
    })),
    texts: [{ kind: "note", value: order.notes }],
  });
}

export type ContactHit = {
  id: string;
  name: string;
  company: string;
  unp: string;
  phone: string;
  email: string;
  address: string;
  contact_role: string;
};

export type ItemHit = {
  id: string;
  section: string;
  title: string;
  description: string;
  unit: string;
  price: number;
  cost: number;
  includes: Array<{ text: string; note: string }>;
};

export type TextHit = { id: string; value: string };

const LIMIT = 8;

export async function searchContacts(term: string): Promise<ContactHit[]> {
  const t = s(term);
  let q = supabaseAdmin
    .from("doc_contacts")
    .select("id,name,company,unp,phone,email,address,contact_role")
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(LIMIT);
  if (t) q = q.or(`name.ilike.%${t}%,company.ilike.%${t}%,email.ilike.%${t}%,unp.ilike.%${t}%`);
  const { data } = await q;
  return ((data ?? []) as ContactHit[]).map((r) => ({ ...r }));
}

export async function searchItems(term: string, section?: string): Promise<ItemHit[]> {
  const t = s(term);
  let q = supabaseAdmin
    .from("doc_item_catalog")
    .select("id,section,title,description,unit,price,cost,includes")
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(LIMIT);
  if (t) q = q.ilike("title", `%${t}%`);
  else if (s(section)) q = q.eq("section", s(section));
  const { data } = await q;
  return ((data ?? []) as ItemHit[]).map((r) => ({
    ...r,
    price: Number(r.price),
    cost: Number(r.cost),
    includes: Array.isArray(r.includes)
      ? r.includes.map((x) => ({ text: String((x as { text?: unknown })?.text ?? ""), note: String((x as { note?: unknown })?.note ?? "") }))
      : [],
  }));
}

export async function searchTexts(kind: TextKind, term: string): Promise<TextHit[]> {
  const t = s(term);
  let q = supabaseAdmin
    .from("doc_text_snippets")
    .select("id,value")
    .eq("kind", kind)
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(LIMIT);
  if (t) q = q.ilike("value", `%${t}%`);
  const { data } = await q;
  return (data ?? []) as TextHit[];
}

/* ------------------------------------------------------------------ */
/* Управление базой знаний (админский раздел)                          */
/* ------------------------------------------------------------------ */

export type KbTable = "contacts" | "items" | "texts";
export type KbSort = "usage" | "recent" | "alpha";

const TABLE: Record<KbTable, "doc_contacts" | "doc_item_catalog" | "doc_text_snippets"> = {
  contacts: "doc_contacts",
  items: "doc_item_catalog",
  texts: "doc_text_snippets",
};

const COLUMNS: Record<KbTable, string> = {
  contacts: "id,name,company,unp,phone,email,address,contact_role,usage_count,last_used_at,created_at",
  items: "id,section,title,description,unit,price,cost,usage_count,last_used_at,created_at",
  texts: "id,kind,value,usage_count,last_used_at,created_at",
};

const ALPHA_COL: Record<KbTable, string> = { contacts: "name", items: "title", texts: "value" };

function searchFilter(table: KbTable, t: string): string {
  const esc = t.replace(/[%,()]/g, " ").trim();
  if (table === "contacts") {
    return ["name", "company", "unp", "phone", "email", "address", "contact_role"]
      .map((c) => `${c}.ilike.%${esc}%`).join(",");
  }
  if (table === "items") {
    return ["section", "title", "description", "unit"].map((c) => `${c}.ilike.%${esc}%`).join(",");
  }
  return ["kind", "value"].map((c) => `${c}.ilike.%${esc}%`).join(",");
}

export type KbRow = {
  id: string;
  usage_count: number;
  last_used_at: string;
  created_at: string;
  // contacts
  name?: string;
  company?: string;
  unp?: string;
  phone?: string;
  email?: string;
  address?: string;
  contact_role?: string;
  // items
  section?: string;
  title?: string;
  description?: string;
  unit?: string;
  price?: number;
  cost?: number;
  // texts
  kind?: string;
  value?: string;
};

type LooseQuery = {
  or: (f: string) => LooseQuery;
  eq: (c: string, v: string) => LooseQuery;
  order: (c: string, o: { ascending: boolean }) => LooseQuery;
  then: Promise<{ data: unknown; count: number | null; error: { message: string } | null }>["then"];
};

export async function listKnowledge(opts: {
  table: KbTable;
  term?: string;
  sort?: KbSort;
  kind?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: KbRow[]; total: number }> {
  const page = Math.max(0, opts.page ?? 0);
  const size = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const t = s(opts.term);

  let q = supabaseAdmin
    .from(TABLE[opts.table])
    .select(COLUMNS[opts.table], { count: "exact" })
    .range(page * size, page * size + size - 1) as unknown as LooseQuery;

  if (t) q = q.or(searchFilter(opts.table, t));
  if (opts.table === "texts" && s(opts.kind)) q = q.eq("kind", s(opts.kind));

  const sort = opts.sort ?? "usage";
  if (sort === "usage") {
    q = q.order("usage_count", { ascending: false }).order("last_used_at", { ascending: false });
  } else if (sort === "recent") {
    q = q.order("last_used_at", { ascending: false });
  } else {
    q = q.order(ALPHA_COL[opts.table], { ascending: true });
  }

  const { data, count, error } = await (q as unknown as Promise<{
    data: unknown; count: number | null; error: { message: string } | null;
  }>);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    ...r,
    price: r["price"] == null ? undefined : Number(r["price"]),
    cost: r["cost"] == null ? undefined : Number(r["cost"]),
  })) as unknown as KbRow[];
  return { rows, total: count ?? 0 };
}


export async function deleteKnowledge(table: KbTable, ids: string[]): Promise<number> {
  const list = ids.filter((v) => typeof v === "string" && v.length > 0);
  if (!list.length) return 0;
  const { error } = await supabaseAdmin.from(TABLE[table]).delete().in("id", list);
  if (error) throw new Error(error.message);
  return list.length;
}

/** Порог «неиспользуемых»: usage_count <= 1 и last_used_at старше N месяцев. */
function pruneCutoff(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

export async function countStale(table: KbTable, months = 6): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(TABLE[table])
    .select("id", { count: "exact", head: true })
    .lte("usage_count", 1)
    .lt("last_used_at", pruneCutoff(months));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function pruneStale(table: KbTable, months = 6): Promise<number> {
  const n = await countStale(table, months);
  if (!n) return 0;
  const { error } = await supabaseAdmin
    .from(TABLE[table])
    .delete()
    .lte("usage_count", 1)
    .lt("last_used_at", pruneCutoff(months));
  if (error) throw new Error(error.message);
  return n;
}

/* ---------------- Синхронизация с каталогом сайта ---------------- */

const CATALOG_SOURCES = [
  { table: "zones", section: "Площадки" },
  { table: "services", section: "Услуги" },
  { table: "tech_equipment", section: "Техника и оборудование" },
  { table: "production_items", section: "Продакшн" },
  { table: "attractions", section: "Аттракционы" },
] as const;

/**
 * Обновляет цены/описания уже накопленных позиций по данным каталога сайта,
 * чтобы позиции КП/смет подставлялись из тех же данных, что видит клиент.
 */
export async function syncCatalogKnowledge(): Promise<{ synced: number }> {
  const { minPriceFromPricing, unitFromPricing } = await import("@/lib/pricing");
  let synced = 0;

  for (const src of CATALOG_SOURCES) {
    const { data, error } = await supabaseAdmin
      .from(src.table)
      .select("title,description,pricing")
      .eq("published", true)
      .limit(1000);
    if (error) {
      console.error(`[doc-knowledge] sync ${src.table} failed`, error.message);
      continue;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const title = s(r["title"]);
      if (!title) continue;
      // Обновляем только те позиции, которые уже реально использовались в документах:
      // база знаний не должна дублировать весь каталог сайта.
      const key = itemKey({ section: src.section, title });
      const { data: existing } = await supabaseAdmin
        .from("doc_item_catalog")
        .select("id")
        .eq("match_key", key)
        .maybeSingle();
      if (!existing) continue;
      await supabaseAdmin
        .from("doc_item_catalog")
        .update({
          description: s(r["description"]).slice(0, 2000),
          unit: unitFromPricing(r["pricing"]) ?? "шт",
          price: minPriceFromPricing(r["pricing"]) ?? 0,
        })
        .eq("id", existing.id);
      synced += 1;
    }
  }

  return { synced };
}

/** Накопление текстов из презентаций (заголовки и подзаголовки слайдов). */
export async function harvestFromPresentation(
  slides: Array<{ title?: string | null; subtitle?: string | null }>,
): Promise<void> {
  await harvestKnowledge({
    texts: slides.flatMap((sl) => [
      { kind: "section" as const, value: sl.title },
      { kind: "note" as const, value: sl.subtitle },
    ]),
  });
}

/* ---------------- Просмотр каталога позиций для конструкторов ---------------- */

export type ItemBrowseHit = ItemHit & { usage_count: number };

/** Поиск позиций базы знаний для массового добавления в документ. */
export async function browseItems(opts: {
  term?: string;
  section?: string;
  limit?: number;
}): Promise<{ rows: ItemBrowseHit[]; sections: string[] }> {
  const t = s(opts.term);
  const sec = s(opts.section);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 60));

  let q = supabaseAdmin
    .from("doc_item_catalog")
    .select("id,section,title,description,unit,price,cost,includes,usage_count")
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(limit);
  if (t) q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
  if (sec) q = q.eq("section", sec);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"]),
    section: s(r["section"]),
    title: s(r["title"]),
    description: s(r["description"]),
    unit: s(r["unit"]) || "шт",
    price: Number(r["price"] ?? 0),
    cost: Number(r["cost"] ?? 0),
    usage_count: Number(r["usage_count"] ?? 0),
    includes: Array.isArray(r["includes"])
      ? (r["includes"] as Array<Record<string, unknown>>).map((x) => ({
          text: s(x?.["text"]),
          note: s(x?.["note"]),
        }))
      : [],
  })) as ItemBrowseHit[];

  // Этап 5: в один список подмешиваем живой каталог сайта (по названию, без дублей).
  const seen = new Set(rows.map((r) => r.title.trim().toLowerCase()));
  const CATALOG: Array<{ table: "zones" | "services" | "tech_equipment" | "production_items" | "attractions"; label: string }> = [
    { table: "zones", label: "Зоны" },
    { table: "services", label: "Услуги" },
    { table: "tech_equipment", label: "Оборудование" },
    { table: "production_items", label: "Продакшн" },
    { table: "attractions", label: "Аттракционы" },
  ];
  if (rows.length < limit) {
    const { minPriceFromPricing, unitFromPricing } = await import("@/lib/pricing");
    const catalogRows = await Promise.all(
      CATALOG.map(async (c) => {
        if (sec && sec !== c.label) return [];
        try {
          let cq = supabaseAdmin
            .from(c.table)
            .select("id,title,description,pricing")
            .eq("published", true)
            .limit(40);
          if (t) cq = cq.ilike("title", `%${t}%`);
          const { data: cdata } = await cq;
          return ((cdata ?? []) as Array<Record<string, unknown>>).map((r) => ({
            id: `catalog:${c.table}:${String(r["id"])}`,
            section: c.label,
            title: s(r["title"]),
            description: s(r["description"]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
            unit: unitFromPricing(r["pricing"]) || "шт",
            price: minPriceFromPricing(r["pricing"]) ?? 0,
            cost: 0,
            usage_count: 0,
            includes: [],
          })) as ItemBrowseHit[];
        } catch {
          return [] as ItemBrowseHit[];
        }
      }),
    );
    for (const hit of catalogRows.flat()) {
      const key = hit.title.trim().toLowerCase();
      if (!hit.title || seen.has(key) || rows.length >= limit) continue;
      seen.add(key);
      rows.push(hit);
    }
  }

  const { data: secData } = await supabaseAdmin
    .from("doc_item_catalog")
    .select("section")
    .limit(1000);
  const sections = Array.from(
    new Set(((secData ?? []) as Array<{ section: string | null }>).map((r) => s(r.section)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "ru"));
  for (const c of CATALOG) if (!sections.includes(c.label)) sections.push(c.label);

  return { rows, sections };
}

/* ---------------- Гигиена базы знаний ---------------- */

export type RetentionPolicy = { minUsage: number; months: number };

export const DEFAULT_RETENTION: RetentionPolicy = { minUsage: 2, months: 6 };

const KB_TABLES: KbTable[] = ["contacts", "items", "texts"];

/**
 * Сливает дубли по match_key: остаётся самая используемая запись,
 * счётчики суммируются, остальные удаляются.
 */
export async function mergeKnowledgeDuplicates(table: KbTable): Promise<number> {
  const t = TABLE[table];
  const { data, error } = await supabaseAdmin
    .from(t)
    .select("*")
    .limit(5000);
  if (error) throw new Error(error.message);

  const groups = new Map<string, Array<{ id: string; usage: number; last: string }>>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const key = `${table === "texts" ? s(r["kind"]) : ""}|${s(r["match_key"])}`;
    if (!s(r["match_key"])) continue;
    const list = groups.get(key) ?? [];
    list.push({ id: String(r["id"]), usage: Number(r["usage_count"] ?? 1), last: s(r["last_used_at"]) });
    groups.set(key, list);
  }

  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => b.usage - a.usage || b.last.localeCompare(a.last));
    const [keep, ...rest] = list;
    if (!keep) continue;
    const total = list.reduce((acc, x) => acc + x.usage, 0);
    const last: string = list.map((x) => x.last).sort().at(-1) ?? keep.last;
    await supabaseAdmin.from(t).update({ usage_count: total, last_used_at: last || undefined }).eq("id", keep.id);
    const { error: delErr } = await supabaseAdmin.from(t).delete().in("id", rest.map((x) => x.id));
    if (!delErr) removed += rest.length;
  }
  return removed;
}

/**
 * Оставляет только востребованные записи: usage_count >= minUsage
 * ИЛИ использованные за последние N месяцев. Остальное удаляется.
 */
export async function enforceRetention(
  table: KbTable,
  policy: RetentionPolicy = DEFAULT_RETENTION,
): Promise<number> {
  const cutoff = pruneCutoff(policy.months);
  const { data, error } = await supabaseAdmin
    .from(TABLE[table])
    .select("id,usage_count,last_used_at")
    .lt("usage_count", policy.minUsage)
    .limit(5000);
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => {
      const last = s(r["last_used_at"]);
      return !last || last < cutoff;
    })
    .map((r) => String(r["id"]));
  if (!ids.length) return 0;
  const { error: delErr } = await supabaseAdmin.from(TABLE[table]).delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);
  return ids.length;
}

export type KnowledgeHealth = {
  table: KbTable;
  total: number;
  duplicates: number;
  junk: number;
};

/** Сводка по состоянию базы знаний для админки. */
export async function knowledgeHealth(policy: RetentionPolicy = DEFAULT_RETENTION): Promise<KnowledgeHealth[]> {
  const out: KnowledgeHealth[] = [];
  const cutoff = pruneCutoff(policy.months);
  for (const table of KB_TABLES) {
    const t = TABLE[table];
    const { data } = await supabaseAdmin
      .from(t)
      .select("*")
      .limit(5000);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const seen = new Map<string, number>();
    let junk = 0;
    for (const r of rows) {
      const key = `${table === "texts" ? s(r["kind"]) : ""}|${s(r["match_key"])}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      const last = s(r["last_used_at"]);
      if (Number(r["usage_count"] ?? 0) < policy.minUsage && (!last || last < cutoff)) junk += 1;
    }
    let duplicates = 0;
    for (const n of seen.values()) if (n > 1) duplicates += n - 1;
    out.push({ table, total: rows.length, duplicates, junk });
  }
  return out;
}

/** Полная автоматическая уборка: сначала слияние дублей, затем удаление мусора. */
export async function runKnowledgeHygiene(
  policy: RetentionPolicy = DEFAULT_RETENTION,
): Promise<{ merged: number; pruned: number }> {
  let merged = 0;
  let pruned = 0;
  for (const table of KB_TABLES) {
    try {
      merged += await mergeKnowledgeDuplicates(table);
      pruned += await enforceRetention(table, policy);
    } catch (err) {
      console.error(`[doc-knowledge] hygiene ${table} failed`, err);
    }
  }
  return { merged, pruned };
}
