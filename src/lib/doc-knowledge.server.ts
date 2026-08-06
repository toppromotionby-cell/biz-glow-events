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
