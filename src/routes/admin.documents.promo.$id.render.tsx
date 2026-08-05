// Server route: /admin/documents/promo/$id/render — HTML промо-КП, ?format=pdf → PDF.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildPromoQuoteHtmlDoc } from "@/lib/documents/promo-quote-html";
import { buildPromoQuotePdf } from "@/lib/documents/pdf.server";
import { normalizePromoItem, normalizePromoQuote, promoFileName } from "@/lib/promo-quote-model";

export const Route = createFileRoute("/admin/documents/promo/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: row }, { data: itemRows }, settings] = await Promise.all([
          supabaseAdmin.from("promo_quotes").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin.from("promo_quote_items").select("*").eq("quote_id", params.id).order("sort_order"),
          loadDocumentSettings(supabaseAdmin as never),
        ]);
        if (!row) return new Response("Not found", { status: 404 });

        const quote = normalizePromoQuote(row as Record<string, unknown>);
        const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizePromoItem);

        if (new URL(request.url).searchParams.get("format") === "pdf") {
          const bytes = await buildPromoQuotePdf(quote, items, settings);
          const filename = promoFileName(quote, "pdf");
          // ASCII-only fallback: HTTP-заголовки не принимают не-latin1 символы.
          const asciiName =
            filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "") || "quote.pdf";
          return new Response(bytes.slice(), {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
              "cache-control": "no-store",
            },
          });
        }

        return new Response(buildPromoQuoteHtmlDoc(quote, items), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
