// Серверные функции раздела «Документы → КП».
// Доступ только для staff (admin/manager) — проверяется через has_role,
// данные пишутся под пользователем (RLS), каталог читается admin-клиентом.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

async function assertStaff(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!isAdmin && !isManager) throw new Error("Forbidden");
}

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
};

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string } | undefined) =>
    z.object({ search: z.string().max(200).optional(), status: z.string().max(30).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<QuoteListRow[]> => {
    await assertStaff(context as never);
    let q = context.supabase
      .from("quotes")
      .select("id,quote_number,status,title,client_name,client_company,event_date,total,updated_at,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const s = (data.search ?? "").trim();
    if (s) q = q.or(`title.ilike.%${s}%,client_name.ilike.%${s}%,client_company.ilike.%${s}%,quote_number.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as QuoteListRow[];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ quote: Quote; items: QuoteItem[] }> => {
    await assertStaff(context as never);
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
    await assertStaff(context as never);

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
    await assertStaff(context as never);

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
          qty: it.qty,
          unit: it.unit ?? "шт.",
          price: it.price,
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
    const { data: itemRows } = await context.supabase.from("quote_items").select("qty,price").eq("quote_id", data.id);
    total = computeTotals(merged as never, ((itemRows ?? []) as Array<{ qty: number; price: number }>).map((r) => ({ qty: Number(r.qty), price: Number(r.price) }))).total;

    const { error } = await context.supabase
      .from("quotes")
      .update({ ...data.patch, total })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, total };
  });

export const duplicateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);
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
    row.title = `${String(row.title ?? "КП")} (копия)`;

    const { data: created, error } = await context.supabase.from("quotes").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;
    const copyItems = ((items ?? []) as Record<string, unknown>[]).map((it, i) => {
      const c = { ...it, quote_id: newId, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (copyItems.length) await context.supabase.from("quote_items").insert(copyItems);
    return { id: newId };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
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
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = data.type && (CATALOG_TABLES as readonly string[]).includes(data.type) ? [data.type] : [...CATALOG_TABLES];
    const term = (data.q ?? "").trim();

    const results = await Promise.all(
      tables.map(async (table) => {
        let q = supabaseAdmin.from(table).select("id,title,pricing,short_description").order("sort_order").limit(term ? 20 : 12);
        if (term) q = q.ilike("title", `%${term}%`);
        const { data: rows } = await q;
        return ((rows ?? []) as Array<Record<string, unknown>>).map((r) => {
          const pricing = (r.pricing ?? {}) as { from?: number; unit?: string };
          return {
            entity_type: table,
            entity_id: String(r.id),
            title: String(r.title ?? ""),
            price: Number(pricing.from ?? 0),
            unit: String(pricing.unit ?? "шт."),
            description: String(r.short_description ?? ""),
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
    await assertStaff(context as never);
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
