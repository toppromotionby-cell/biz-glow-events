// Серверные функции раздела «Документы → КП промо».
// Доступ только для staff (admin/manager), данные пишутся под пользователем (RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computePromoTotals,
  normalizePromoItem,
  normalizePromoQuote,
  promoItemSchema,
  promoQuotePatchSchema,
  PROMO_PRESETS,
  type PromoItem,
  type PromoQuote,
} from "@/lib/promo-quote-model";

async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!isAdmin && !isManager) throw new Error("Forbidden");
}

export type PromoListRow = {
  id: string;
  doc_number: string | null;
  status: string;
  project: string;
  client_name: string;
  period: string;
  total: number;
  is_template: boolean;
  template_name: string;
  created_at: string;
  updated_at: string;
};

export const listPromoQuotes = createServerFn({ method: "GET" })
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
  .handler(async ({ data, context }): Promise<PromoListRow[]> => {
    await assertStaff(context as never);
    let q = context.supabase
      .from("promo_quotes")
      .select("id,doc_number,status,project,client_name,period,total,is_template,template_name,created_at,updated_at")
      .eq("is_template", data.templates === true)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const s = (data.search ?? "").trim();
    if (s) q = q.or(`project.ilike.%${s}%,client_name.ilike.%${s}%,doc_number.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PromoListRow[];
  });

export const getPromoQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ quote: PromoQuote; items: PromoItem[] }> => {
    await assertStaff(context as never);
    const [{ data: row, error }, { data: items }] = await Promise.all([
      context.supabase.from("promo_quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Документ не найден");
    return {
      quote: normalizePromoQuote(row as Record<string, unknown>),
      items: ((items ?? []) as Record<string, unknown>[]).map(normalizePromoItem),
    };
  });

export const createPromoQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preset?: string; fromId?: string } | undefined) =>
    z.object({ preset: z.string().max(40).optional(), fromId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);

    if (data.fromId) {
      const [{ data: src }, { data: srcItems }] = await Promise.all([
        context.supabase.from("promo_quotes").select("*").eq("id", data.fromId).maybeSingle(),
        context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.fromId).order("sort_order"),
      ]);
      if (!src) throw new Error("Источник не найден");
      const s = src as Record<string, unknown>;
      delete s.id;
      delete s.doc_number;
      delete s.created_at;
      delete s.updated_at;
      const { data: created, error } = await context.supabase
        .from("promo_quotes")
        .insert({ ...s, created_by: context.userId, status: "draft", is_template: false })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const id = (created as { id: string }).id;
      const rows = ((srcItems ?? []) as Record<string, unknown>[]).map((it, i) => ({
        quote_id: id,
        section: String(it.section ?? ""),
        title: String(it.title ?? ""),
        unit: String(it.unit ?? "услуга"),
        qty: Number(it.qty ?? 1),
        multiplier: Number(it.multiplier ?? 1),
        price: Number(it.price ?? 0),
        note: String(it.note ?? ""),
        exclude_from_commission: it.exclude_from_commission === true,
        sort_order: i,
      }));
      if (rows.length) await context.supabase.from("promo_quote_items").insert(rows);
      return { id };
    }

    const { data: created, error } = await context.supabase
      .from("promo_quotes")
      .insert({ created_by: context.userId, project: "Новый проект" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (created as { id: string }).id;

    const preset = PROMO_PRESETS.find((p) => p.key === (data.preset ?? "blank")) ?? PROMO_PRESETS[2];
    const rows = preset.items.map((it, i) => ({
      quote_id: id,
      section: it.section ?? "",
      title: it.title ?? "",
      unit: it.unit ?? "услуга",
      qty: it.qty ?? 1,
      multiplier: it.multiplier ?? 1,
      price: it.price ?? 0,
      note: it.note ?? "",
      exclude_from_commission: it.exclude_from_commission === true,
      sort_order: i,
    }));
    if (rows.length) await context.supabase.from("promo_quote_items").insert(rows);
    return { id };
  });

export const savePromoQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch?: Record<string, unknown>; items?: unknown[] }) =>
    z
      .object({
        id: z.string().uuid(),
        patch: promoQuotePatchSchema.optional(),
        items: z.array(promoItemSchema).max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; total: number }> => {
    await assertStaff(context as never);

    if (data.items) {
      await context.supabase.from("promo_quote_items").delete().eq("quote_id", data.id);
      const rows = data.items.map((it, i) => ({
        quote_id: data.id,
        section: it.section,
        title: it.title,
        unit: it.unit,
        qty: it.qty,
        multiplier: it.multiplier,
        price: it.price,
        note: it.note,
        exclude_from_commission: it.exclude_from_commission,
        sort_order: i,
      }));
      if (rows.length) {
        const { error } = await context.supabase.from("promo_quote_items").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    if (data.patch && Object.keys(data.patch).length) {
      const { error } = await context.supabase.from("promo_quotes").update(data.patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    // пересчитываем итог из актуальных данных
    const [{ data: row }, { data: items }] = await Promise.all([
      context.supabase.from("promo_quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!row) throw new Error("Документ не найден");
    const totals = computePromoTotals(
      normalizePromoQuote(row as Record<string, unknown>),
      ((items ?? []) as Record<string, unknown>[]).map(normalizePromoItem),
    );
    await context.supabase.from("promo_quotes").update({ total: totals.totalWithVat }).eq("id", data.id);
    return { ok: true, total: totals.totalWithVat };
  });

export const deletePromoQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { error } = await context.supabase.from("promo_quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePromoTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);
    const [{ data: src }, { data: srcItems }] = await Promise.all([
      context.supabase.from("promo_quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!src) throw new Error("Документ не найден");
    const s = src as Record<string, unknown>;
    delete s.id;
    delete s.doc_number;
    delete s.created_at;
    delete s.updated_at;
    const { data: created, error } = await context.supabase
      .from("promo_quotes")
      .insert({ ...s, created_by: context.userId, is_template: true, template_name: data.name, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (created as { id: string }).id;
    const rows = ((srcItems ?? []) as Record<string, unknown>[]).map((it, i) => ({
      quote_id: id,
      section: String(it.section ?? ""),
      title: String(it.title ?? ""),
      unit: String(it.unit ?? "услуга"),
      qty: Number(it.qty ?? 1),
      multiplier: Number(it.multiplier ?? 1),
      price: Number(it.price ?? 0),
      note: String(it.note ?? ""),
      exclude_from_commission: it.exclude_from_commission === true,
      sort_order: i,
    }));
    if (rows.length) await context.supabase.from("promo_quote_items").insert(rows);
    return { id };
  });
