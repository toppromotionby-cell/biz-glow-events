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
