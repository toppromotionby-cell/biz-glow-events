// Серверные функции синхронизации состава промо-КП с Google Таблицами.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/authz";
import { computePromoTotals, normalizePromoItem, normalizePromoQuote } from "@/lib/promo-quote-model";
import type { PromoSheetDiffRow, PromoSheetRow } from "@/lib/promo-sheets.server";

export type { PromoSheetDiffRow, PromoSheetRow };

async function assertStaff(context: unknown) {
  await assertPermission(context as never, "documents.manage");
}

type Row = Record<string, unknown>;

async function loadPromo(supabase: never, id: string) {
  const sb = supabase as unknown as { from: (t: string) => any };
  const [{ data: quote }, { data: items }] = await Promise.all([
    sb.from("promo_quotes").select("*").eq("id", id).maybeSingle(),
    sb.from("promo_quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!quote) throw new Error("Промо-КП не найдено");
  const raw = ((items ?? []) as Row[]).map(normalizePromoItem);
  const rows: PromoSheetRow[] = raw.map((it) => ({
    id: it.id,
    section: it.section,
    title: it.title,
    unit: it.unit,
    qty: it.qty,
    multiplier: it.multiplier,
    price: it.price,
    cost: it.cost,
    included: it.included,
    exclude_from_commission: it.exclude_from_commission,
    is_info: it.is_info,
    note: it.note,
    rate_unit: it.rate_unit,
  }));
  return {
    quote: quote as Row,
    promo: normalizePromoQuote(quote as Row),
    itemsModel: raw,
    rawItems: ((items ?? []) as Row[]),
    rows,
  };
}

function sheetTitle(quote: Row) {
  const num = quote.doc_number ? `Промо-КП №${quote.doc_number}` : "Промо-КП";
  const client = String(quote.client_name || quote.project || "").trim();
  return [num, client].filter(Boolean).join(" · ").slice(0, 90);
}

/** Создаёт (при необходимости) таблицу и заливает в неё текущий состав. */
export const ensurePromoSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string; sheetId: string }> => {
    await assertStaff(context);
    const { createPromoSpreadsheet, writePromoSheet } = await import("@/lib/promo-sheets.server");
    const { quote, promo, itemsModel, rows } = await loadPromo(context.supabase as never, data.id);

    let sheetId = (quote.sheet_id as string | null) ?? null;
    let url = (quote.sheet_url as string | null) ?? null;
    if (!sheetId) {
      const created = await createPromoSpreadsheet(sheetTitle(quote));
      sheetId = created.id;
      url = created.url;
    }
    await writePromoSheet(sheetId, promo, itemsModel);
    await (context.supabase as never as any)
      .from("promo_quotes")
      .update({ sheet_id: sheetId, sheet_url: url, sheet_synced_at: new Date().toISOString(), sheet_snapshot: rows })
      .eq("id", data.id);
    return { url: url ?? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, sheetId };
  });

/** Перезаписывает лист текущим составом из админки. */
export const pushPromoToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context);
    const { writePromoSheet } = await import("@/lib/promo-sheets.server");
    const { quote, promo, itemsModel, rows } = await loadPromo(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    if (!sheetId) throw new Error("Для этого промо-КП ещё нет таблицы");
    await writePromoSheet(sheetId, promo, itemsModel);
    await (context.supabase as never as any)
      .from("promo_quotes")
      .update({ sheet_synced_at: new Date().toISOString(), sheet_snapshot: rows })
      .eq("id", data.id);
    return { ok: true };
  });

export type PromoSheetState = {
  connected: boolean;
  url: string | null;
  syncedAt: string | null;
  diff: PromoSheetDiffRow[];
  error: string | null;
};

export const getPromoSheetDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PromoSheetState> => {
    await assertStaff(context);
    const { quote, rows } = await loadPromo(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    const url = (quote.sheet_url as string | null) ?? null;
    const syncedAt = (quote.sheet_synced_at as string | null) ?? null;
    if (!sheetId) return { connected: false, url: null, syncedAt: null, diff: [], error: null };
    try {
      const { readPromoRows, diffPromoRows } = await import("@/lib/promo-sheets.server");
      const sheetItems = await readPromoRows(sheetId);
      return { connected: true, url, syncedAt, diff: diffPromoRows(rows, sheetItems), error: null };
    } catch (e) {
      return { connected: true, url, syncedAt, diff: [], error: (e as Error).message };
    }
  });

/** Применяет выбранные строки таблицы к составу промо-КП и пересчитывает итог. */
export const applyPromoSheetDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; rowIds: string[] }) =>
    z.object({ id: z.string().uuid(), rowIds: z.array(z.string()).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ applied: number; total: number }> => {
    await assertStaff(context);
    const sb = context.supabase as never as any;
    const { readPromoRows, diffPromoRows, writePromoSheet } = await import("@/lib/promo-sheets.server");
    const { quote, rawItems, rows } = await loadPromo(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    if (!sheetId) throw new Error("Для этого промо-КП ещё нет таблицы");

    const sheetItems = await readPromoRows(sheetId);
    const diff = diffPromoRows(rows, sheetItems);
    const picked = new Set(data.rowIds);
    const applyMap = new Map<string, PromoSheetDiffRow>();
    diff.forEach((d) => { if (picked.has(d.id)) applyMap.set(d.id, d); });

    const dbById = new Map(rows.map((r) => [r.id, r]));
    // Поля, которых нет в таблице (includes, группы, подписи единиц), берём из базы.
    const extrasById = new Map(rawItems.map((r) => [String(r.id), normalizePromoItem(r)]));

    const next: PromoSheetRow[] = [];
    sheetItems.forEach((s, index) => {
      const key = s.id || `new-${index}`;
      const existing = s.id ? dbById.get(s.id) : undefined;
      if (!existing) {
        if (applyMap.get(key)?.kind === "added") next.push({ ...s, id: "" });
        return;
      }
      next.push(applyMap.get(s.id)?.kind === "changed" ? s : existing);
    });
    rows.forEach((r) => {
      if (sheetItems.some((s) => s.id === r.id)) return;
      if (applyMap.get(r.id)?.kind === "removed") return;
      next.push(r);
    });

    await sb.from("promo_quote_items").delete().eq("quote_id", data.id);
    if (next.length) {
      const insert = next.map((it, i) => {
        const extra = it.id ? extrasById.get(it.id) : undefined;
        return {
          quote_id: data.id,
          section: it.section,
          title: it.title,
          unit: it.unit || "услуга",
          qty: it.qty,
          multiplier: it.multiplier,
          rate_qty: it.multiplier,
          price: it.price,
          cost: it.cost,
          note: it.note,
          includes: extra?.includes ?? [],
          exclude_from_commission: it.exclude_from_commission,
          included: it.included,
          is_info: it.is_info,
          group_key: extra?.group_key ?? "",
          qty_unit: extra?.qty_unit ?? "",
          rate_unit: it.rate_unit || extra?.rate_unit || "",
          sort_order: i,
        };
      });
      const { error } = await sb.from("promo_quote_items").insert(insert);
      if (error) throw new Error(error.message);
    }

    const { data: freshRow } = await sb.from("promo_quotes").select("*").eq("id", data.id).maybeSingle();
    const { data: freshItems } = await sb
      .from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order");
    const totals = computePromoTotals(
      normalizePromoQuote((freshRow ?? {}) as Row),
      ((freshItems ?? []) as Row[]).map(normalizePromoItem),
    );
    await sb
      .from("promo_quotes")
      .update({ total: totals.totalWithVat, sheet_synced_at: new Date().toISOString() })
      .eq("id", data.id);

    // Возвращаем таблицу в согласованное состояние (у новых позиций появились id).
    try {
      const { rows: fresh } = await loadPromo(context.supabase as never, data.id);
      await writePromoRows(sheetId, fresh);
      await sb.from("promo_quotes").update({ sheet_snapshot: fresh }).eq("id", data.id);
    } catch (e) {
      console.error("[promo-sheets] re-push failed", e);
    }

    return { applied: applyMap.size, total: totals.totalWithVat };
  });
