// Серверные функции синхронизации состава КП с Google Таблицами.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import { computeTotals } from "@/lib/quotes-model";
import type { SheetDiffRow, SheetItemRow } from "@/lib/quote-sheets.server";

export type { SheetDiffRow, SheetItemRow };

type Ctx = { supabase: never; userId: string };


type QuoteRow = Record<string, unknown>;

async function loadQuoteAndItems(supabase: never, id: string) {
  const sb = supabase as unknown as {
    from: (t: string) => any;
  };
  const [{ data: quote }, { data: items }] = await Promise.all([
    sb.from("quotes").select("*").eq("id", id).maybeSingle(),
    sb.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!quote) throw new Error("КП не найдено");
  const rows: SheetItemRow[] = ((items ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    section: String(r.section ?? ""),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    qty: Number(r.qty ?? 0),
    unit: String(r.unit ?? "шт."),
    price: Number(r.price ?? 0),
    cost: Number(r.cost ?? 0),
  }));
  return { quote: quote as QuoteRow, rows };
}

function sheetTitle(quote: QuoteRow) {
  const num = quote.quote_number ? `КП №${quote.quote_number}` : "КП";
  const client = String(quote.client_company || quote.client_name || "").trim();
  return [num, client].filter(Boolean).join(" · ").slice(0, 90);
}

/** Создаёт (при необходимости) таблицу и заливает в неё текущий состав. */
export const ensureQuoteSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string; sheetId: string }> => {
    await assertDocumentsStaff(context as never);
    const { createSpreadsheet, writeRows } = await import("@/lib/quote-sheets.server");
    const { quote, rows } = await loadQuoteAndItems(context.supabase as never, data.id);

    let sheetId = (quote.sheet_id as string | null) ?? null;
    let url = (quote.sheet_url as string | null) ?? null;
    if (!sheetId) {
      const created = await (async () => {
        try {
          return await createSpreadsheet(sheetTitle(quote));
        } catch (e) {
          console.error(`[sheets] quotes ensure ${data.id} failed:`, (e as Error).message);
          throw e;
        }
      })();
      sheetId = created.id;
      url = created.url;
    }
    await writeRows(sheetId, rows);
    await (context.supabase as never as any)
      .from("quotes")
      .update({ sheet_id: sheetId, sheet_url: url, sheet_synced_at: new Date().toISOString(), sheet_snapshot: rows })
      .eq("id", data.id);
    return { url: url ?? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, sheetId };
  });

/** Выгружает текущий состав из админки в таблицу (перезапись листа). */
export const pushQuoteToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { writeRows } = await import("@/lib/quote-sheets.server");
    const { quote, rows } = await loadQuoteAndItems(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    if (!sheetId) throw new Error("Для этого КП ещё нет таблицы");
    await writeRows(sheetId, rows);
    await (context.supabase as never as any)
      .from("quotes")
      .update({ sheet_synced_at: new Date().toISOString(), sheet_snapshot: rows })
      .eq("id", data.id);
    return { ok: true };
  });

export type QuoteSheetState = {
  connected: boolean;
  url: string | null;
  syncedAt: string | null;
  diff: SheetDiffRow[];
  error: string | null;
};

/** Читает таблицу и сравнивает с составом в базе. */
export const getQuoteSheetDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<QuoteSheetState> => {
    await assertDocumentsStaff(context as never);
    const { quote, rows } = await loadQuoteAndItems(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    const url = (quote.sheet_url as string | null) ?? null;
    const syncedAt = (quote.sheet_synced_at as string | null) ?? null;
    if (!sheetId) return { connected: false, url: null, syncedAt: null, diff: [], error: null };
    try {
      const { readRows, diffRows } = await import("@/lib/quote-sheets.server");
      const sheetItems = await readRows(sheetId);
      return { connected: true, url, syncedAt, diff: diffRows(rows, sheetItems), error: null };
    } catch (e) {
      return { connected: true, url, syncedAt, diff: [], error: (e as Error).message };
    }
  });

/** Применяет выбранные изменения из таблицы к составу КП. */
export const applyQuoteSheetDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; rowIds: string[] }) =>
    z.object({ id: z.string().uuid(), rowIds: z.array(z.string()).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ applied: number; total: number }> => {
    await assertDocumentsStaff(context as never);
    const sb = context.supabase as never as any;
    const { readRows, diffRows } = await import("@/lib/quote-sheets.server");
    const { quote, rows } = await loadQuoteAndItems(context.supabase as never, data.id);
    const sheetId = quote.sheet_id as string | null;
    if (!sheetId) throw new Error("Для этого КП ещё нет таблицы");

    const sheetItems = await readRows(sheetId);
    const diff = diffRows(rows, sheetItems);
    const picked = new Set(data.rowIds);

    // Собираем итоговый состав: порядок берём из таблицы.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const applyMap = new Map<string, SheetDiffRow>();
    diff.forEach((d) => { if (picked.has(d.id)) applyMap.set(d.id, d); });

    const next: SheetItemRow[] = [];
    sheetItems.forEach((s, index) => {
      const addedKey = s.id || `new-${index}`;
      const existing = s.id ? byId.get(s.id) : undefined;
      if (!existing) {
        if (applyMap.get(addedKey)?.kind === "added") next.push({ ...s, id: "" });
        return;
      }
      const change = applyMap.get(s.id);
      if (change?.kind === "changed") next.push(s);
      else next.push(existing);
    });
    // Позиции, которых нет в таблице: удаляем только выбранные.
    rows.forEach((r) => {
      const inSheet = sheetItems.some((s) => s.id === r.id);
      if (inSheet) return;
      const removal = applyMap.get(r.id);
      if (removal?.kind === "removed") return;
      next.push(r);
    });

    await sb.from("quote_items").delete().eq("quote_id", data.id);
    if (next.length) {
      const insert = next.map((it, i) => ({
        quote_id: data.id,
        section: it.section,
        title: it.title,
        description: it.description,
        includes: [],
        qty: it.qty,
        unit: it.unit || "шт.",
        price: it.price,
        cost: it.cost,
        sort_order: i,
      }));
      const { error } = await sb.from("quote_items").insert(insert);
      if (error) throw new Error(error.message);
    }

    const total = computeTotals(
      quote as never,
      next.map((r) => ({ qty: r.qty, price: r.price, cost: r.cost })),
    ).total;
    await sb.from("quotes").update({ total, sheet_synced_at: new Date().toISOString() }).eq("id", data.id);

    // Возвращаем таблицу в согласованное состояние (новые позиции получили id).
    try {
      const { writeRows } = await import("@/lib/quote-sheets.server");
      const { rows: fresh } = await loadQuoteAndItems(context.supabase as never, data.id);
      await writeRows(sheetId, fresh);
      await sb.from("quotes").update({ sheet_snapshot: fresh }).eq("id", data.id);
    } catch (e) {
      console.error("[quote-sheets] re-push failed", e);
    }

    return { applied: applyMap.size, total };
  });

export type { Ctx };
