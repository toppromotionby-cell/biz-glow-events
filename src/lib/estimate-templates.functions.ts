// Единая библиотека образцов смет: сохраняем любой документ (КП или КП промо)
// как образец и создаём по нему новые документы любого типа.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import { normalizeIncludes } from "@/lib/promo-quote-model";


export type EstimateTemplateRow = {
  id: string;
  name: string;
  description: string;
  kind: string;
  strict: boolean;
  active: boolean;
  version: number;
  items_count: number;
  total: number;
  updated_at: string;
};

type TplItem = {
  section: string;
  title: string;
  unit: string;
  qty: number;
  multiplier: number;
  price: number;
  cost: number;
  note: string;
  includes: unknown;
  exclude_from_commission: boolean;
  included: boolean;
  group_key: string;
  qty_unit: string;
  rate_unit: string;
  rate_qty: number;
  is_info: boolean;
  sort_order: number;
};

function toTplItem(it: Record<string, unknown>, i: number): TplItem {
  return {
    section: String(it.section ?? ""),
    title: String(it.title ?? ""),
    unit: String(it.unit ?? "услуга"),
    qty: Number(it.qty ?? 1),
    multiplier: Number(it.multiplier ?? 1),
    price: Number(it.price ?? 0),
    cost: Number(it.cost ?? 0),
    note: String(it.note ?? it.description ?? ""),
    includes: normalizeIncludes(it.includes),
    exclude_from_commission: it.exclude_from_commission === true,
    included: it.included !== false,
    group_key: String(it.group_key ?? ""),
    qty_unit: String(it.qty_unit ?? ""),
    rate_unit: String(it.rate_unit ?? ""),
    rate_qty: Number(it.rate_qty ?? it.multiplier ?? 1),
    is_info: it.is_info === true,
    sort_order: i,
  };
}

const lineSum = (it: TplItem) => (it.is_info || !it.included ? 0 : it.qty * (it.multiplier || 1) * it.price);

/* ------------------------------- Список ------------------------------- */

export const listEstimateTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind?: string } | undefined) =>
    z.object({ kind: z.enum(["quote", "promo", "any"]).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<EstimateTemplateRow[]> => {
    await assertDocumentsStaff(context as never);
    const { data: rows, error } = await context.supabase
      .from("estimate_templates")
      .select("id,name,description,kind,strict,active,version,updated_at")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Omit<EstimateTemplateRow, "items_count" | "total">>;
    const filtered =
      data.kind && data.kind !== "any" ? list.filter((t) => t.kind === data.kind || t.kind === "any") : list;
    if (!filtered.length) return [];

    const { data: items } = await context.supabase
      .from("estimate_template_items")
      .select("template_id,qty,multiplier,price,included,is_info")
      .in("template_id", filtered.map((t) => t.id));

    const agg = new Map<string, { n: number; sum: number }>();
    for (const raw of (items ?? []) as Record<string, unknown>[]) {
      const key = String(raw.template_id);
      const cur = agg.get(key) ?? { n: 0, sum: 0 };
      cur.n += 1;
      if (raw.included !== false && raw.is_info !== true) {
        cur.sum += Number(raw.qty ?? 1) * Number(raw.multiplier ?? 1) * Number(raw.price ?? 0);
      }
      agg.set(key, cur);
    }
    return filtered.map((t) => ({
      ...t,
      items_count: agg.get(t.id)?.n ?? 0,
      total: Math.round((agg.get(t.id)?.sum ?? 0) * 100) / 100,
    }));
  });

/* --------------------------- Сохранить образец --------------------------- */

export const saveEstimateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        source: z.enum(["quote", "promo"]),
        docId: z.string().uuid(),
        name: z.string().trim().min(1, "Укажите название").max(160),
        description: z.string().max(500).optional(),
        strict: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    const isPromo = data.source === "promo";
    const [{ data: doc }, { data: items }] = await Promise.all([
      context.supabase.from(isPromo ? "promo_quotes" : "quotes").select("*").eq("id", data.docId).maybeSingle(),
      context.supabase
        .from(isPromo ? "promo_quote_items" : "quote_items")
        .select("*")
        .eq("quote_id", data.docId)
        .order("sort_order"),
    ]);
    if (!doc) throw new Error("Документ не найден");

    const d = doc as Record<string, unknown>;
    const settings: Record<string, unknown> = isPromo
      ? {
          currency: d.currency,
          vat_enabled: d.vat_enabled,
          vat_rate: d.vat_rate,
          vat_mode: d.vat_mode,
          commission_enabled: d.commission_enabled,
          commission_rate: d.commission_rate,
          commission_label: d.commission_label,
          management_enabled: d.management_enabled,
          management_label: d.management_label,
          management_amount: d.management_amount,
          show_qty: d.show_qty,
          show_notes: d.show_notes,
          footer_note: d.footer_note,
        }
      : {
          currency: d.currency,
          vat_enabled: d.vat_enabled,
          vat_rate: d.vat_rate,
          vat_mode: d.vat_mode,
          texts: d.texts,
          design: d.design,
        };

    const { data: created, error } = await context.supabase
      .from("estimate_templates")
      .insert({
        name: data.name,
        description: data.description ?? "",
        kind: data.source,
        strict: data.strict === true,
        settings: settings as never,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (created as { id: string }).id;

    const rows = ((items ?? []) as Record<string, unknown>[]).map((it, i) => ({
      template_id: id,
      ...toTplItem(it, i),
    }));
    if (rows.length) {
      const { error: e2 } = await context.supabase.from("estimate_template_items").insert(rows as never);
      if (e2) throw new Error(e2.message);
    }
    return { id };
  });

/* -------------------- Создать документ по образцу -------------------- */

export const createDocFromEstimateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ templateId: z.string().uuid(), target: z.enum(["quote", "promo"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; kind: "quote" | "promo" }> => {
    await assertDocumentsStaff(context as never);

    const [{ data: tpl }, { data: items }] = await Promise.all([
      context.supabase.from("estimate_templates").select("*").eq("id", data.templateId).maybeSingle(),
      context.supabase
        .from("estimate_template_items")
        .select("*")
        .eq("template_id", data.templateId)
        .order("sort_order"),
    ]);
    if (!tpl) throw new Error("Образец не найден");
    const t = tpl as Record<string, unknown>;
    const settings = (t.settings ?? {}) as Record<string, unknown>;
    const list = ((items ?? []) as Record<string, unknown>[]).map(toTplItem);

    const { data: defaultCompany } = await context.supabase
      .from("company_profiles").select("id").eq("is_default", true).maybeSingle();
    const companyId = (defaultCompany as { id?: string } | null)?.id ?? null;

    const pick = (keys: string[]) =>
      Object.fromEntries(keys.filter((k) => settings[k] !== undefined && settings[k] !== null).map((k) => [k, settings[k]]));

    if (data.target === "promo") {
      const base: Record<string, unknown> = {
        created_by: context.userId,
        company_id: companyId,
        project: String(t.name ?? "Новый проект"),
        ...pick([
          "currency", "vat_enabled", "vat_rate", "vat_mode", "commission_enabled", "commission_rate",
          "commission_label", "management_enabled", "management_label", "management_amount",
          "show_qty", "show_notes", "footer_note",
        ]),
      };
      const { data: created, error } = await context.supabase
        .from("promo_quotes").insert(base).select("id").single();
      if (error) throw new Error(error.message);
      const id = (created as { id: string }).id;
      const rows = list.map((it, i) => ({ ...it, quote_id: id, sort_order: i }));
      if (rows.length) {
        const { error: e2 } = await context.supabase.from("promo_quote_items").insert(rows as never);
        if (e2) throw new Error(e2.message);
      }
      const total = Math.round(list.reduce((s, it) => s + lineSum(it), 0) * 100) / 100;
      await context.supabase.from("promo_quotes").update({ total }).eq("id", id);
      return { id, kind: "promo" };
    }

    const base: Record<string, unknown> = {
      created_by: context.userId,
      company_id: companyId,
      title: String(t.name ?? "Предложение по организации мероприятия"),
      ...pick(["currency", "vat_enabled", "vat_rate", "vat_mode", "texts", "design"]),
    };
    const { data: created, error } = await context.supabase.from("quotes").insert(base).select("id").single();
    if (error) throw new Error(error.message);
    const id = (created as { id: string }).id;
    const rows = list.map(({ note, exclude_from_commission: _skip, ...it }, i) => ({
      ...it,
      description: note,
      quote_id: id,
      sort_order: i,
    }));
    if (rows.length) {
      const { error: e2 } = await context.supabase.from("quote_items").insert(rows as never);
      if (e2) throw new Error(e2.message);
    }
    const total = Math.round(list.reduce((s, it) => s + lineSum(it), 0) * 100) / 100;
    await context.supabase.from("quotes").update({ total }).eq("id", id);
    return { id, kind: "quote" };
  });

/* ----------------------------- Обслуживание ----------------------------- */

export const renameEstimateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(500).optional(),
        strict: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { id, ...patch } = data;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length) {
      const { error } = await context.supabase.from("estimate_templates").update(clean as never).eq("id", id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEstimateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("estimate_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
