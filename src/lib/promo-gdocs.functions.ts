// Серверные функции экспорта промо-КП в Google Документы.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/authz";
import { normalizePromoItem, normalizePromoQuote, promoNumberDisplay } from "@/lib/promo-quote-model";

type Row = Record<string, unknown>;

/** Создаёт (при необходимости) документ и перезаписывает его текущим КП. */
export const exportPromoToGoogleDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await assertPermission(context as never, "documents.manage");
    const sb = context.supabase as unknown as { from: (t: string) => any };

    const [{ data: quoteRow }, { data: itemRows }] = await Promise.all([
      sb.from("promo_quotes").select("*").eq("id", data.id).maybeSingle(),
      sb.from("promo_quote_items").select("*").eq("quote_id", data.id).order("sort_order"),
    ]);
    if (!quoteRow) throw new Error("Промо-КП не найдено");

    const quote = normalizePromoQuote(quoteRow as Row);
    const items = ((itemRows ?? []) as Row[]).map(normalizePromoItem);

    const { createPromoDoc, renderPromoToDoc } = await import("@/lib/documents/promo-gdocs.server");

    let docId = (quoteRow as Row).gdoc_id as string | null;
    let url = (quoteRow as Row).gdoc_url as string | null;
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

    await renderPromoToDoc(docId!, quote, items, { n: (quoteRow as Row).company_line as string | undefined });
    return { url: url ?? `https://docs.google.com/document/d/${docId}/edit` };
  });
