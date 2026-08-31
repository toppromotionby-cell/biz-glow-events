import { assertDocumentsStaff } from "@/lib/authz";
// Серверные функции раздела «Документы → КП».
// Доступ только для staff (admin/manager) — проверяется через has_role,
// данные пишутся под пользователем (RLS), каталог читается admin-клиентом.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toCardExcerpt } from "@/lib/rich-text";
import {
  quotePatchSchema,
  quoteItemSchema,
  normalizeQuote,
  normalizeItem,
  computeTotals,
  DEFAULT_QUOTE_TEXTS,
  DEFAULT_QUOTE_DESIGN,
  type Quote,
  type QuoteItem,
} from "@/lib/quotes-model";
import { resolveUnitCost } from "@/lib/documents/economics";


export type QuoteListRow = {
  id: string;
  quote_number: string | null;
  status: string;
  title: string;
  client_name: string;
  client_company: string;
  event_date: string | null;
  total: number;
  updated_at: string;
  created_at: string;
  is_template: boolean;
  template_name: string;
  sent_at: string | null;
};

const LIST_COLS =
  "id,quote_number,status,title,client_name,client_company,event_date,total,updated_at,created_at,is_template,template_name,sent_at";

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; templates?: boolean } | undefined) =>
    z
      .object({
        search: z.string().max(200).optional(),
        status: z.string().max(30).optional(),
        templates: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<QuoteListRow[]> => {
    await assertDocumentsStaff(context as never);
    let q = context.supabase
      .from("quotes")
      .select(LIST_COLS)
      .eq("is_template", data.templates === true)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const s = (data.search ?? "").trim();
    if (s) q = q.or(`title.ilike.%${s}%,client_name.ilike.%${s}%,client_company.ilike.%${s}%,quote_number.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as QuoteListRow[];
  });


export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ quote: Quote; items: QuoteItem[] }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: quote, error }, { data: items }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("КП не найдено");
    return {
      quote: normalizeQuote(quote as Record<string, unknown>),
      items: ((items ?? []) as Record<string, unknown>[]).map(normalizeItem),
    };
  });

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId?: string | null } | undefined) =>
    z.object({ orderId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    const base: Record<string, unknown> = {
      created_by: context.userId,
      title: "Предложение по организации мероприятия",
      texts: DEFAULT_QUOTE_TEXTS,
      design: DEFAULT_QUOTE_DESIGN,
    };

    let sourceItems: Array<Record<string, unknown>> = [];
    if (data.orderId) {
      const [{ data: order }, { data: oItems }] = await Promise.all([
        context.supabase.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
        context.supabase.from("order_items").select("*").eq("order_id", data.orderId).order("created_at"),
      ]);
      if (order) {
        const o = order as Record<string, unknown>;
        Object.assign(base, {
          order_id: o.id,
          client_name: o.client_name ?? "",
          client_company: o.client_company ?? "",
          client_phone: o.client_phone ?? "",
          client_email: o.client_email ?? "",
          event_date: o.event_date ?? null,
          event_notes: o.notes ?? "",
        });
        sourceItems = (oItems ?? []) as Record<string, unknown>[];
      }
    }

    const { data: defaultCompany } = await context.supabase
      .from("company_profiles").select("id").eq("is_default", true).maybeSingle();
    if ((defaultCompany as { id?: string } | null)?.id) base.company_id = (defaultCompany as { id: string }).id;

    const { data: created, error } = await context.supabase.from("quotes").insert(base).select("id").single();
    if (error) throw new Error(error.message);
    const quoteId = (created as { id: string }).id;

    if (sourceItems.length) {
      const rows = sourceItems.map((it, i) => ({
        quote_id: quoteId,
        title: String(it.title ?? ""),
        qty: Number(it.qty ?? 1),
        price: Number(it.price ?? 0),
        unit: "шт.",
        sort_order: i,
        entity_type: (it.entity_type as string) ?? null,
        entity_id: (it.entity_id as string) ?? null,
      }));
      await context.supabase.from("quote_items").insert(rows);
      const total = rows.reduce((s, r) => s + r.qty * r.price, 0);
      await context.supabase.from("quotes").update({ total }).eq("id", quoteId);
    }

    return { id: quoteId };
  });

export const saveQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown>; items?: unknown[] }) =>
    z
      .object({
        id: z.string().uuid(),
        patch: quotePatchSchema,
        items: z.array(quoteItemSchema).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; total: number }> => {
    await assertDocumentsStaff(context as never);

    const items = data.items;
    let total = 0;

    if (items) {
      await context.supabase.from("quote_items").delete().eq("quote_id", data.id);
      if (items.length) {
        const rows = items.map((it, i) => ({
          quote_id: data.id,
          section: it.section ?? "",
          title: it.title,
          description: it.description ?? "",
          includes: it.includes ?? [],
          qty: it.qty,
          unit: it.unit ?? "шт.",
          price: it.price,
          cost: resolveUnitCost(it.price, it.cost_mode, it.cost_input, it.cost),
          cost_mode: it.cost_mode ?? "amount",
          cost_input: it.cost_input ?? it.cost ?? 0,
          sort_order: i,
          entity_type: it.entity_type ?? null,
          entity_id: it.entity_id ?? null,
        }));
        const { error } = await context.supabase.from("quote_items").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    const { data: current } = await context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle();
    if (!current) throw new Error("КП не найдено");
    const merged = { ...(current as Record<string, unknown>), ...data.patch } as Record<string, unknown>;
    const { data: itemRows } = await context.supabase.from("quote_items").select("qty,price,cost").eq("quote_id", data.id);
    total = computeTotals(
      merged as never,
      ((itemRows ?? []) as Array<{ qty: number; price: number; cost: number }>).map((r) => ({
        qty: Number(r.qty), price: Number(r.price), cost: Number(r.cost ?? 0),
      })),
    ).total;


    const { error } = await context.supabase
      .from("quotes")
      .update({ ...(data.patch as unknown as Record<string, never>), total })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Наполнение базы знаний — не должно влиять на результат сохранения.
    try {
      const { harvestKnowledge } = await import("@/lib/doc-knowledge.server");
      const m = merged as Record<string, unknown>;
      await harvestKnowledge({
        contacts: [{
          name: m.client_name as string, company: m.client_company as string, unp: m.client_unp as string,
          phone: m.client_phone as string, email: m.client_email as string, address: m.client_address as string,
        }],
        items: (items ?? []).map((it) => ({
          section: it.section ?? "", title: it.title, description: it.description ?? "",
          unit: it.unit ?? "шт.", price: it.price, cost: it.cost ?? 0,
          cost_mode: it.cost_mode ?? "amount", cost_input: it.cost_input ?? it.cost ?? 0, includes: it.includes ?? [],
        })),
        texts: [
          { kind: "venue" as const, value: m.venue },
          { kind: "event_format" as const, value: m.event_format },
          { kind: "note" as const, value: m.event_notes },
          { kind: "note" as const, value: m.setup_note },
          ...(items ?? []).map((it) => ({ kind: "section" as const, value: it.section ?? "" })),
        ],
      });
    } catch (e) {
      console.error("[quotes] knowledge harvest failed", e);
    }

    return { ok: true, total };
  });

export const duplicateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: src }, { data: items }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!src) throw new Error("КП не найдено");
    const row = { ...(src as Record<string, unknown>) };
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    row.quote_number = null;
    row.status = "draft";
    row.created_by = context.userId;
    row.sent_at = null;
    row.is_template = false;
    row.template_name = "";
    delete row.public_token;
    row.title = `${String(row.title ?? "КП")} (копия)`;


    const { data: created, error } = await context.supabase.from("quotes").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;
    const copyItems = ((items ?? []) as Record<string, unknown>[]).map((it, i) => {
      const c: Record<string, unknown> = { ...it, quote_id: newId, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (copyItems.length) await context.supabase.from("quote_items").insert(copyItems as never);
    return { id: newId };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CatalogHit = {
  entity_type: string;
  entity_id: string;
  title: string;
  price: number;
  unit: string;
  description: string;
};

const CATALOG_TABLES = ["zones", "tech_equipment", "services", "production_items"] as const;

export const searchCatalogForQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; type?: string } | undefined) =>
    z.object({ q: z.string().max(120).optional(), type: z.string().max(30).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<CatalogHit[]> => {
    await assertDocumentsStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = data.type && (CATALOG_TABLES as readonly string[]).includes(data.type) ? [data.type] : [...CATALOG_TABLES];
    const term = (data.q ?? "").trim();

    const results = await Promise.all(
      tables.map(async (table) => {
        let q = supabaseAdmin.from(table as "zones").select("id,title,pricing,description").order("sort_order").limit(term ? 20 : 12);
        if (term) q = q.ilike("title", `%${term}%`);
        const { data: rows } = await q;
        return ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
          const pricing = (r.pricing ?? {}) as { from?: number; unit?: string };
          return {
            entity_type: table,
            entity_id: String(r.id),
            title: String(r.title ?? ""),
            price: Number(pricing.from ?? 0),
            unit: String(pricing.unit ?? "шт."),
            description: toCardExcerpt(r.description as string | null, 220),
          } satisfies CatalogHit;
        });
      }),
    );
    return results.flat();
  });

export type OrderHit = { id: string; order_number: string | null; client_name: string; client_company: string | null; event_date: string | null };

export const listOrdersForQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string } | undefined) => z.object({ q: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<OrderHit[]> => {
    await assertDocumentsStaff(context as never);
    let q = context.supabase
      .from("orders")
      .select("id,order_number,client_name,client_company,event_date")
      .order("created_at", { ascending: false })
      .limit(30);
    const term = (data.q ?? "").trim();
    if (term) q = q.or(`client_name.ilike.%${term}%,client_company.ilike.%${term}%,order_number.ilike.%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as OrderHit[];
  });

// Реквизиты компании для превью КП (staff-доступ, admin-клиент только на чтение).
export const getQuoteDocSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId?: string | null } | undefined) =>
    z.object({ companyId: z.string().uuid().nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDocumentSettings } = await import("@/lib/documents/render.server");
    return await loadDocumentSettings(supabaseAdmin as never, data.companyId ?? null);
  });

// --- Библиотека переиспользуемых блоков (сниппетов) ---
const snippetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Укажите название").max(160),
  description: z.string().max(300).default(""),
  block_type: z.string().max(40).default("text"),
  title: z.string().max(160).default(""),
  content: z.string().max(5000).default(""),
  condition: z.string().max(40).default("always"),
});

export type QuoteSnippetRow = {
  id: string;
  name: string;
  description: string;
  block_type: string;
  title: string;
  content: string;
  condition: string;
  created_at: string;
};

export const listQuoteSnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuoteSnippetRow[]> => {
    await assertDocumentsStaff(context as never);
    const { data, error } = await context.supabase
      .from("doc_snippets")
      .select("id,name,description,block_type,title,content,condition,created_at")
      .eq("doc_type", "quote")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as QuoteSnippetRow[];
  });

export const saveQuoteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => snippetSchema.parse(d))
  .handler(async ({ data, context }): Promise<QuoteSnippetRow> => {
    await assertDocumentsStaff(context as never);
    const payload = {
      name: data.name,
      description: data.description,
      block_type: data.block_type,
      title: data.title,
      content: data.content,
      condition: data.condition,
    };
    const q = data.id
      ? context.supabase.from("doc_snippets").update(payload).eq("id", data.id)
      : context.supabase.from("doc_snippets").insert({ ...payload, doc_type: "quote", created_by: context.userId });
    const { data: row, error } = await (q as unknown as { select: (c: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } })
      .select("id,name,description,block_type,title,content,condition,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as QuoteSnippetRow;
  });

export const deleteQuoteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("doc_snippets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- История версий, шаблоны, отправка ---
export type QuoteVersionRow = {
  id: string;
  label: string;
  total: number;
  created_at: string;
};

export const listQuoteVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quoteId: string }) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<QuoteVersionRow[]> => {
    await assertDocumentsStaff(context as never);
    const { data: rows, error } = await context.supabase
      .from("quote_versions")
      .select("id,label,total,created_at")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as QuoteVersionRow[];
  });

export const createQuoteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quoteId: string; label?: string }) =>
    z.object({ quoteId: z.string().uuid(), label: z.string().max(160).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: quote }, { data: items }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.quoteId).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.quoteId).order("sort_order"),
    ]);
    if (!quote) throw new Error("КП не найдено");
    const { error } = await context.supabase.from("quote_versions").insert({
      quote_id: data.quoteId,
      label: data.label ?? "",
      total: Number((quote as Record<string, unknown>).total ?? 0),
      snapshot: { quote, items: items ?? [] },
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreQuoteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; quoteId: string }> => {
    await assertDocumentsStaff(context as never);
    const { data: version } = await context.supabase
      .from("quote_versions")
      .select("quote_id,snapshot")
      .eq("id", data.versionId)
      .maybeSingle();
    if (!version) throw new Error("Версия не найдена");
    const v = version as { quote_id: string; snapshot: { quote: Record<string, unknown>; items: Record<string, unknown>[] } };
    const restored = { ...v.snapshot.quote };
    for (const key of ["id", "created_at", "updated_at", "public_token", "quote_number", "created_by"]) delete restored[key];

    const { error } = await context.supabase.from("quotes").update(restored as never).eq("id", v.quote_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("quote_items").delete().eq("quote_id", v.quote_id);
    const rows = (v.snapshot.items ?? []).map((it, i) => {
      const c: Record<string, unknown> = { ...it, quote_id: v.quote_id, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (rows.length) await context.supabase.from("quote_items").insert(rows as never);
    return { ok: true, quoteId: v.quote_id };
  });

/** Сохранить текущее КП как шаблон (копия с флагом is_template). */
export const saveQuoteAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1, "Укажите название").max(160) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: src }, { data: items }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!src) throw new Error("КП не найдено");
    const row: Record<string, unknown> = { ...(src as Record<string, unknown>) };
    for (const key of ["id", "created_at", "updated_at", "public_token"]) delete row[key];
    row.quote_number = null;
    row.status = "draft";
    row.sent_at = null;
    row.created_by = context.userId;
    row.is_template = true;
    row.template_name = data.name;

    const { data: created, error } = await context.supabase.from("quotes").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;
    const copies = ((items ?? []) as Record<string, unknown>[]).map((it, i) => {
      const c: Record<string, unknown> = { ...it, quote_id: newId, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (copies.length) await context.supabase.from("quote_items").insert(copies as never);
    return { id: newId };
  });

/** Создать новое КП из шаблона. */
export const createQuoteFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string }) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: src }, { data: items }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.templateId).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.templateId).order("sort_order"),
    ]);
    if (!src) throw new Error("Шаблон не найден");
    const row: Record<string, unknown> = { ...(src as Record<string, unknown>) };
    for (const key of ["id", "created_at", "updated_at", "public_token"]) delete row[key];
    row.quote_number = null;
    row.status = "draft";
    row.sent_at = null;
    row.created_by = context.userId;
    row.is_template = false;
    row.template_name = "";

    const { data: created, error } = await context.supabase.from("quotes").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;
    const copies = ((items ?? []) as Record<string, unknown>[]).map((it, i) => {
      const c: Record<string, unknown> = { ...it, quote_id: newId, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (copies.length) await context.supabase.from("quote_items").insert(copies as never);
    return { id: newId };
  });

/** Отметить КП отправленным (фиксирует дату и статус). */
export const markQuoteSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; sent_at: string }> => {
    await assertDocumentsStaff(context as never);
    const sentAt = new Date().toISOString();
    const { error } = await context.supabase.from("quotes").update({ sent_at: sentAt, status: "sent" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, sent_at: sentAt };
  });

/** Публичная ссылка на КП (для клиента). */
function publicQuoteUrl(token: string): string {
  const site = (process.env["PUBLIC_SITE_URL"] ?? "https://event-hub.by").replace(/\/+$/, "");
  return `${site}/kp/${token}`;
}

/** Отправить КП клиенту: письмо со ссылкой и PDF-вложением. */
export const sendQuoteToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; email?: string; note?: string; attachPdf?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().email().max(200).optional(),
        note: z.string().max(2000).optional(),
        attachPdf: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; to: string; url: string }> => {
    await assertDocumentsStaff(context as never);

    const [{ data: row }, { data: itemRows }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!row) throw new Error("КП не найдено");
    const quote = normalizeQuote(row as Record<string, unknown>);
    const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizeItem);

    const to = (data.email ?? quote.client_email ?? "").trim();
    if (!to) throw new Error("Не указан e-mail клиента");

    const { sendQuoteShareEmail } = await import("@/lib/admin-email.server");
    const { loadDocumentSettings } = await import("@/lib/documents/render.server");
    const { buildStandaloneQuotePdf } = await import("@/lib/documents/pdf.server");
    const { quoteNumberDisplay, quoteValidUntil, quoteFileName } = await import("@/lib/documents/quote-html");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let pdf: { filename: string; bytes: Uint8Array } | null = null;
    if (data.attachPdf !== false) {
      try {
        const settings = await loadDocumentSettings(supabaseAdmin as never, quote.company_id);
        pdf = { filename: quoteFileName(quote), bytes: await buildStandaloneQuotePdf(quote, items, settings) };
      } catch (error) {
        console.error("[quote-email] requested PDF build failed", { quoteId: data.id, error });
        throw new Error("Не удалось сформировать PDF для письма. Повторите попытку");
      }
    }

    const url = publicQuoteUrl(quote.public_token);
    const res = await sendQuoteShareEmail({
      to,
      clientName: quote.client_name,
      docTitle: "Коммерческое предложение",
      docNumber: quoteNumberDisplay(quote),
      url,
      total: computeTotals(quote, items).total,
      validUntil: quoteValidUntil(quote),
      managerNote: data.note ?? "",
      pdf,
    });
    if (!res.ok) throw new Error(res.error ?? "Не удалось отправить письмо");

    await context.supabase
      .from("quotes")
      .update({ sent_at: new Date().toISOString(), status: quote.status === "draft" ? "sent" : quote.status })
      .eq("id", data.id);

    return { ok: true, to, url };
  });

/** Создать заказ на основе согласованного КП. */
export const createOrderFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ orderId: string }> => {
    await assertDocumentsStaff(context as never);

    const [{ data: row }, { data: itemRows }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!row) throw new Error("КП не найдено");
    const quote = normalizeQuote(row as Record<string, unknown>);
    if (quote.order_id) return { orderId: quote.order_id };

    const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizeItem);
    const total = computeTotals(quote, items).total;

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        client_name: quote.client_name || "Без имени",
        client_phone: quote.client_phone || "—",
        client_email: quote.client_email || "—",
        client_company: quote.client_company || null,
        event_date: quote.event_date,
        status: "confirmed",
        total,
        source: "quote",
        manager_id: context.userId,
        notes: quote.event_notes || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const orderId = (order as { id: string }).id;

    // Внутренние заметки хранятся в staff-only таблице — клиент их не видит.
    await context.supabase.from("order_internal_notes").upsert(
      { order_id: orderId, notes: `Создан из КП ${quote.quote_number ?? quote.id.slice(0, 8)}` },
      { onConflict: "order_id" },
    );

    if (items.length) {
      const rows = items.map((it) => ({
        order_id: orderId,
        entity_type: it.entity_type ?? "custom",
        entity_id: it.entity_id ?? null,
        title: it.title,
        qty: Math.max(1, Math.round(it.qty)),
        price: it.price,
        start_date: quote.event_date,
        end_date: quote.event_date,
      }));
      await context.supabase.from("order_items").insert(rows as never);
    }

    await context.supabase.from("quotes").update({ order_id: orderId }).eq("id", data.id);
    return { orderId };
  });
