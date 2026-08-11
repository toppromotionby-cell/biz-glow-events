// Серверные функции экспорта/импорта промо-КП в Google Документы.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/authz";
import {
  computePromoTotals,
  normalizePromoItem,
  normalizePromoQuote,
  promoNumberDisplay,
  type PromoItem,
} from "@/lib/promo-quote-model";
import type { PromoSheetDiffRow, PromoSheetRow } from "@/lib/promo-sheets.server";

type Row = Record<string, unknown>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function toSheetRow(it: PromoItem): PromoSheetRow {
  return {
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
  };
}

async function loadPromo(context: { supabase: unknown }, id: string) {
  const sb = context.supabase as unknown as { from: (t: string) => any };
  const [{ data: quoteRow }, { data: itemRows }] = await Promise.all([
    sb.from("promo_quotes").select("*").eq("id", id).maybeSingle(),
    sb.from("promo_quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!quoteRow) throw new Error("Промо-КП не найдено");
  const items = ((itemRows ?? []) as Row[]).map(normalizePromoItem);
  return {
    sb,
    quoteRow: quoteRow as Row,
    quote: normalizePromoQuote(quoteRow as Row),
    items,
    rows: items.map(toSheetRow),
  };
}

/** Создаёт (при необходимости) документ и перезаписывает его текущим КП. */
export const exportPromoToGoogleDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await assertPermission(context as never, "documents.manage");
    const { sb, quoteRow, quote, items } = await loadPromo(context as never, data.id);
    const { createPromoDoc, renderPromoToDoc } = await import("@/lib/documents/promo-gdocs.server");

    let docId = quoteRow.gdoc_id as string | null;
    let url = quoteRow.gdoc_url as string | null;
    if (!docId) {
      const title = [
        `Промо-КП №${promoNumberDisplay(quote)}`,
        String(quote.client_name || quote.project || "").trim(),
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 90);
      const created = await createPromoDoc(title);
      docId = created.id;
      url = created.url;
      await sb.from("promo_quotes").update({ gdoc_id: docId, gdoc_url: url }).eq("id", data.id);
    }

    await renderPromoToDoc(docId!, quote, items, {
      companyLine: (quoteRow.company_line as string | undefined) ?? undefined,
    });
    return { url: url ?? `https://docs.google.com/document/d/${docId}/edit` };
  });

export type PromoDocState = {
  connected: boolean;
  url: string | null;
  diff: PromoSheetDiffRow[];
  error: string | null;
};

/** Сопоставляет строки документа с составом КП: id и служебные поля — из базы. */
function matchDocRows(
  parsed: Array<{
    section: string;
    title: string;
    unit: string;
    qty: number;
    multiplier: number;
    price: number;
    note: string;
    rate_unit: string;
  }>,
  dbRows: PromoSheetRow[],
): PromoSheetRow[] {
  const pool = new Map<string, PromoSheetRow[]>();
  for (const r of dbRows) {
    const key = `${norm(r.section)}|${norm(r.title)}`;
    if (!pool.has(key)) pool.set(key, []);
    pool.get(key)!.push(r);
  }
  return parsed.map((p) => {
    const key = `${norm(p.section)}|${norm(p.title)}`;
    const base = pool.get(key)?.shift();
    return {
      id: base?.id ?? "",
      section: p.section,
      title: p.title,
      unit: p.unit,
      qty: p.qty,
      multiplier: p.multiplier || 1,
      price: p.price,
      cost: base?.cost ?? 0,
      included: base?.included ?? true,
      exclude_from_commission: base?.exclude_from_commission ?? false,
      is_info: base?.is_info ?? false,
      note: p.note,
      rate_unit: p.rate_unit || base?.rate_unit || "",
    };
  });
}

/** Что изменилось в Google Документе относительно состава КП. */
export const getPromoDocDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PromoDocState> => {
    await assertPermission(context as never, "documents.manage");
    const { quoteRow, rows } = await loadPromo(context as never, data.id);
    const docId = quoteRow.gdoc_id as string | null;
    const url = (quoteRow.gdoc_url as string | null) ?? null;
    if (!docId) return { connected: false, url: null, diff: [], error: null };
    try {
      const { readPromoDocRows } = await import("@/lib/documents/promo-gdocs.server");
      const { diffPromoRows } = await import("@/lib/promo-sheets.server");
      const parsed = await readPromoDocRows(docId);
      return { connected: true, url, diff: diffPromoRows(rows, matchDocRows(parsed, rows)), error: null };
    } catch (e) {
      return { connected: true, url, diff: [], error: (e as Error).message };
    }
  });

/** Применяет выбранные строки документа к составу КП и перерисовывает документ. */
export const applyPromoDocDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; rowIds: string[] }) =>
    z.object({ id: z.string().uuid(), rowIds: z.array(z.string()).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ applied: number }> => {
    await assertPermission(context as never, "documents.manage");
    const { sb, quoteRow, rows, items } = await loadPromo(context as never, data.id);
    const docId = quoteRow.gdoc_id as string | null;
    if (!docId) throw new Error("Для этого промо-КП ещё нет документа");

    const { readPromoDocRows, renderPromoToDoc } = await import("@/lib/documents/promo-gdocs.server");
    const { diffPromoRows } = await import("@/lib/promo-sheets.server");
    const docRows = matchDocRows(await readPromoDocRows(docId), rows);
    const diff = diffPromoRows(rows, docRows);
    const picked = new Set(data.rowIds);
    const applyMap = new Map<string, PromoSheetDiffRow>();
    diff.forEach((d) => { if (picked.has(d.id)) applyMap.set(d.id, d); });

    const dbById = new Map(rows.map((r) => [r.id, r]));
    const extrasById = new Map(items.map((it) => [it.id, it]));

    const next: PromoSheetRow[] = [];
    docRows.forEach((s, index) => {
      const key = s.id || `new-${index}`;
      const existing = s.id ? dbById.get(s.id) : undefined;
      if (!existing) {
        if (applyMap.get(key)?.kind === "added") next.push({ ...s, id: "" });
        return;
      }
      next.push(applyMap.get(s.id)?.kind === "changed" ? s : existing);
    });
    rows.forEach((r) => {
      if (docRows.some((s) => s.id === r.id)) return;
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

    const fresh = await loadPromo(context as never, data.id);
    const totals = computePromoTotals(fresh.quote, fresh.items);
    await sb.from("promo_quotes").update({ total: totals.totalWithVat }).eq("id", data.id);

    // Возвращаем документ к эталонному виду.
    try {
      await renderPromoToDoc(docId, fresh.quote, fresh.items, {
        companyLine: (fresh.quoteRow.company_line as string | undefined) ?? undefined,
      });
    } catch (e) {
      console.warn("[gdocs] перерисовка после импорта:", (e as Error).message);
    }

    return { applied: applyMap.size };
  });
