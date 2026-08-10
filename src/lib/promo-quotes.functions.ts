import { assertPermission } from "@/lib/authz";
// Серверные функции раздела «Документы → КП промо».
// Доступ только для staff (admin/manager), данные пишутся под пользователем (RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computePromoTotals,
  normalizeIncludes,
  normalizePromoItem,
  normalizePromoQuote,
  promoItemSchema,
  promoQuotePatchSchema,
  PROMO_PRESETS,
  type PromoItem,
  type PromoQuote,
} from "@/lib/promo-quote-model";

async function assertStaff(context: { supabase: unknown; userId: string }) {
  await assertPermission(context as never, "documents.manage");
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
        cost: Number(it.cost ?? 0),
        note: String(it.note ?? ""),
        includes: normalizeIncludes(it.includes),
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
      cost: it.cost ?? 0,
      note: it.note ?? "",
      includes: normalizeIncludes(it.includes),
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
        cost: it.cost,
        note: it.note,
        includes: it.includes,
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

    // Наполнение базы знаний — не должно влиять на результат сохранения.
    try {
      const { harvestKnowledge } = await import("@/lib/doc-knowledge.server");
      const r = row as Record<string, unknown>;
      await harvestKnowledge({
        contacts: [{
          name: (r.contact_name as string) || "", company: r.client_name as string,
          phone: r.contact_phone as string, email: r.contact_email as string,
          contact_role: r.contact_role as string,
        }],
        items: ((items ?? []) as Record<string, unknown>[]).map((it) => ({
          section: it.section as string, title: it.title as string, description: it.note as string,
          unit: it.unit as string, price: Number(it.price ?? 0), cost: Number(it.cost ?? 0),
          includes: it.includes,
        })),
        texts: [
          { kind: "venue" as const, value: r.venue },
          { kind: "footer" as const, value: r.footer_note },
          ...((items ?? []) as Record<string, unknown>[]).map((it) => ({ kind: "section" as const, value: it.section })),
        ],
      });
    } catch (e) {
      console.error("[promo-quotes] knowledge harvest failed", e);
    }

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
      cost: Number(it.cost ?? 0),
      note: String(it.note ?? ""),
      includes: normalizeIncludes(it.includes),
      exclude_from_commission: it.exclude_from_commission === true,
      sort_order: i,
    }));
    if (rows.length) await context.supabase.from("promo_quote_items").insert(rows);
    return { id };
  });

// ==== Библиотека блоков (сниппеты позиций) ====

export type PromoSnippetRow = {
  id: string;
  name: string;
  description: string;
  section: string;
  items: PromoItem[];
  created_at: string;
};

export const listPromoSnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoSnippetRow[]> => {
    await assertStaff(context as never);
    const { data, error } = await context.supabase
      .from("promo_item_snippets")
      .select("id,name,description,section,items,created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      description: String(r.description ?? ""),
      section: String(r.section ?? ""),
      items: (Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : []).map(normalizePromoItem),
      created_at: String(r.created_at ?? ""),
    }));
  });

export const savePromoSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; section?: string; items: unknown[] }) =>
    z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(500).default(""),
        section: z.string().max(120).default(""),
        items: z.array(promoItemSchema).min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);
    const { data: created, error } = await context.supabase
      .from("promo_item_snippets")
      .insert({
        name: data.name,
        description: data.description,
        section: data.section,
        items: data.items,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

export const deletePromoSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { error } = await context.supabase.from("promo_item_snippets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==== История версий ====

export type PromoVersionRow = { id: string; label: string; total: number; created_at: string };

export const listPromoVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quoteId: string }) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PromoVersionRow[]> => {
    await assertStaff(context as never);
    const { data: rows, error } = await context.supabase
      .from("promo_quote_versions")
      .select("id,label,total,created_at")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as PromoVersionRow[];
  });

export const createPromoVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quoteId: string; label?: string }) =>
    z.object({ quoteId: z.string().uuid(), label: z.string().max(200).default("Снимок") }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);
    const [{ data: row }, { data: items }] = await Promise.all([
      context.supabase.from("promo_quotes").select("*").eq("id", data.quoteId).maybeSingle(),
      context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.quoteId).order("sort_order"),
    ]);
    if (!row) throw new Error("Документ не найден");
    const quote = normalizePromoQuote(row as Record<string, unknown>);
    const list = ((items ?? []) as Record<string, unknown>[]).map(normalizePromoItem);
    const totals = computePromoTotals(quote, list);
    const { data: created, error } = await context.supabase
      .from("promo_quote_versions")
      .insert({
        quote_id: data.quoteId,
        label: data.label,
        total: totals.totalWithVat,
        snapshot: { quote, items: list },
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

export const restorePromoVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { data: v } = await context.supabase
      .from("promo_quote_versions")
      .select("quote_id,snapshot")
      .eq("id", data.versionId)
      .maybeSingle();
    if (!v) throw new Error("Версия не найдена");
    const row = v as { quote_id: string; snapshot: { quote: Record<string, unknown>; items: Record<string, unknown>[] } };
    const snap = normalizePromoQuote(row.snapshot.quote ?? {});
    const patch = promoQuotePatchSchema.parse({
      status: snap.status,
      project: snap.project,
      client_name: snap.client_name,
      period: snap.period,
      venue: snap.venue,
      contact_name: snap.contact_name,
      contact_role: snap.contact_role,
      contact_phone: snap.contact_phone,
      contact_email: snap.contact_email,
      logo_url: snap.logo_url,
      client_logo_url: snap.client_logo_url,
      accent_color: snap.accent_color,
      show_qty: snap.show_qty,
      show_total_qty: snap.show_total_qty,
      show_notes: snap.show_notes,
      vat_enabled: snap.vat_enabled,
      vat_rate: snap.vat_rate,
      commission_enabled: snap.commission_enabled,
      commission_rate: snap.commission_rate,
      commission_label: snap.commission_label,
      management_enabled: snap.management_enabled,
      management_amount: snap.management_amount,
      management_label: snap.management_label,
      discount_type: snap.discount_type,
      discount_value: snap.discount_value,
      valid_until: snap.valid_until,
      currency: snap.currency,
      footer_note: snap.footer_note,
    });
    await context.supabase.from("promo_quotes").update(patch).eq("id", row.quote_id);

    await context.supabase.from("promo_quote_items").delete().eq("quote_id", row.quote_id);
    const items = (row.snapshot.items ?? []).map(normalizePromoItem).map((it, i) => ({
      quote_id: row.quote_id,
      section: it.section,
      title: it.title,
      unit: it.unit,
      qty: it.qty,
      multiplier: it.multiplier,
      price: it.price,
      cost: it.cost,
      note: it.note,
      includes: it.includes,
      exclude_from_commission: it.exclude_from_commission,
      sort_order: i,
    }));
    if (items.length) await context.supabase.from("promo_quote_items").insert(items);
    return { ok: true };
  });

export const markPromoSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { error } = await context.supabase
      .from("promo_quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Отправить КП промо клиенту: письмо со ссылкой и PDF-вложением. */
export const sendPromoQuoteToClient = createServerFn({ method: "POST" })
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
    await assertStaff(context as never);

    const [{ data: row }, { data: itemRows }] = await Promise.all([
      context.supabase.from("promo_quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!row) throw new Error("КП не найдено");
    const quote = normalizePromoQuote(row as Record<string, unknown>);
    const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizePromoItem);

    const to = (data.email ?? quote.contact_email ?? "").trim();
    if (!to) throw new Error("Не указан e-mail клиента");

    const { sendQuoteShareEmail } = await import("@/lib/admin-email.server");
    const { loadDocumentSettings } = await import("@/lib/documents/render.server");
    const { buildPromoQuotePdf } = await import("@/lib/documents/pdf.server");
    const { promoFileName, promoNumberDisplay } = await import("@/lib/promo-quote-model");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let pdf: { filename: string; bytes: Uint8Array } | null = null;
    if (data.attachPdf !== false) {
      try {
        const settings = await loadDocumentSettings(supabaseAdmin as never);
        pdf = { filename: promoFileName(quote, "pdf"), bytes: await buildPromoQuotePdf(quote, items, settings) };
      } catch (error) {
        console.error("[promo-email] requested PDF build failed", { quoteId: data.id, error });
        throw new Error("Не удалось сформировать PDF для письма. Повторите попытку");
      }
    }

    const site = (process.env["PUBLIC_SITE_URL"] ?? "https://event-hub.by").replace(/\/+$/, "");
    const url = `${site}/kp/${quote.public_token}`;
    const res = await sendQuoteShareEmail({
      to,
      clientName: quote.contact_name || quote.client_name,
      docTitle: "Коммерческое предложение",
      docNumber: promoNumberDisplay(quote),
      url,
      total: computePromoTotals(quote, items).totalWithVat,
      validUntil: quote.valid_until,
      managerNote: data.note ?? "",
      pdf,
    });
    if (!res.ok) throw new Error(res.error ?? "Не удалось отправить письмо");

    await context.supabase
      .from("promo_quotes")
      .update({ sent_at: new Date().toISOString(), status: quote.status === "draft" ? "sent" : quote.status })
      .eq("id", data.id);

    return { ok: true, to, url };
  });
