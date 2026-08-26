// Server route: /admin/documents/promo/$id/render — HTML промо-КП, ?format=pdf → PDF.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildPromoQuoteHtmlDoc } from "@/lib/documents/promo-quote-html";
import { companyRequisitesLine } from "@/lib/documents/company";
import { buildPromoQuotePdf } from "@/lib/documents/pdf.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { normalizePromoItem, normalizePromoQuote, promoFileName, promoNumberDisplay, computePromoTotals } from "@/lib/promo-quote-model";
import { promoEconRows } from "@/lib/documents/economics-source";
import { buildEconomicsSheetDoc } from "@/lib/documents/economics-sheet";

export const Route = createFileRoute("/admin/documents/promo/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: row }, { data: itemRows }] = await Promise.all([
          supabaseAdmin.from("promo_quotes").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin.from("promo_quote_items").select("*").eq("quote_id", params.id).order("sort_order"),
        ]);
        if (!row) return new Response("Not found", { status: 404 });
        const settings = await loadDocumentSettings(supabaseAdmin as never, (row as { company_id?: string | null }).company_id ?? null);

        const quote = normalizePromoQuote(row as Record<string, unknown>);
        const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizePromoItem);

        const url = new URL(request.url);
        if (url.searchParams.get("internal") === "1") {
          const rows = promoEconRows(items);
          const totals = computePromoTotals(quote, items);
          const label = `КП промо №${promoNumberDisplay(quote)}`;
          const client = quote.client_name || undefined;
          if (url.searchParams.get("format") === "pdf") {
            const { buildEconomicsPdf } = await import("@/lib/documents/economics-pdf.server");
            return buildPdfResponse({
              filename: promoFileName(quote, "pdf").replace(/\.pdf$/i, "") + "-внутренний.pdf",
              operation: "promo-quote-internal",
              entityId: params.id,
              build: () =>
                buildEconomicsPdf(rows, settings, {
                  docLabel: label,
                  client,
                  netLabel: "после комиссии, скидки и НДС",
                  netRevenue: totals.net,
                }),
            });
          }
          return new Response(
            buildEconomicsSheetDoc({ docLabel: label, client, netLabel: "После комиссии, скидки и НДС" }, rows, totals.net),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
          );
        }

        if (url.searchParams.get("format") === "pdf") {
          return buildPdfResponse({
            filename: promoFileName(quote, "pdf"),
            operation: "promo-quote",
            entityId: params.id,
            build: () => buildPromoQuotePdf(quote, items, settings),
          });
        }


        return new Response(buildPromoQuoteHtmlDoc(quote, items, companyRequisitesLine(quote.company_overrides, settings)), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
