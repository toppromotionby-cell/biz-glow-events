// Server route: /admin/documents/quotes/$id/render — HTML КП, ?format=pdf → PDF.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildQuoteHtmlDoc, quoteFileName, quoteNumberDisplay } from "@/lib/documents/quote-html";
import { buildStandaloneQuotePdf } from "@/lib/documents/pdf.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { normalizeQuote, normalizeItem, computeTotals } from "@/lib/quotes-model";
import { quoteEconRows } from "@/lib/documents/economics-source";
import { buildEconomicsSheetDoc } from "@/lib/documents/economics-sheet";

export const Route = createFileRoute("/admin/documents/quotes/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: row }, { data: itemRows }] = await Promise.all([
          supabaseAdmin.from("quotes").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order"),
        ]);
        if (!row) return new Response("Not found", { status: 404 });
        const settings = await loadDocumentSettings(supabaseAdmin as never, (row as { company_id?: string | null }).company_id ?? null);

        const quote = normalizeQuote(row as Record<string, unknown>);
        const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizeItem);

        const url = new URL(request.url);
        const internal = url.searchParams.get("internal") === "1";
        if (internal) {
          const rows = quoteEconRows(items);
          const totals = computeTotals(quote, items);
          const label = `КП №${quoteNumberDisplay(quote)}`;
          if (url.searchParams.get("format") === "pdf") {
            const { buildEconomicsPdf } = await import("@/lib/documents/economics-pdf.server");
            return buildPdfResponse({
              filename: quoteFileName(quote).replace(/\.pdf$/i, "") + "-внутренний.pdf",
              operation: "quote-internal",
              entityId: params.id,
              build: () =>
                buildEconomicsPdf(rows, settings, {
                  docLabel: label,
                  client: quote.client_company || quote.client_name || undefined,
                  netRevenue: totals.net,
                }),
            });
          }
          return new Response(
            buildEconomicsSheetDoc(
              { docLabel: label, client: quote.client_company || quote.client_name || undefined },
              rows,
              totals.net,
            ),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
          );
        }

        if (url.searchParams.get("format") === "pdf") {
          return buildPdfResponse({
            filename: quoteFileName(quote),
            operation: "quote",
            entityId: params.id,
            build: () => buildStandaloneQuotePdf(quote, items, settings),
          });
        }


        return new Response(buildQuoteHtmlDoc(quote, items, settings), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
