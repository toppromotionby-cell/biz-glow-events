// Server route: /admin/documents/quotes/$id/render — HTML КП, ?format=pdf → PDF.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildQuoteHtmlDoc, quoteFileName } from "@/lib/documents/quote-html";
import { buildStandaloneQuotePdf } from "@/lib/documents/pdf.server";
import { normalizeQuote, normalizeItem } from "@/lib/quotes-model";

export const Route = createFileRoute("/admin/documents/quotes/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: row }, { data: itemRows }, settings] = await Promise.all([
          supabaseAdmin.from("quotes").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order"),
          loadDocumentSettings(supabaseAdmin as never),
        ]);
        if (!row) return new Response("Not found", { status: 404 });

        const quote = normalizeQuote(row as Record<string, unknown>);
        const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizeItem);

        if (new URL(request.url).searchParams.get("format") === "pdf") {
          try {
            const bytes = await buildStandaloneQuotePdf(quote, items, settings);
            const filename = quoteFileName(quote);
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
          } catch (e) {
            console.error("[quote-render] PDF build failed", params.id, e);
            const msg = e instanceof Error ? e.message : String(e);
            return new Response(`Не удалось собрать PDF: ${msg}`, {
              status: 500,
              headers: { "content-type": "text/plain; charset=utf-8" },
            });
          }
        }


        return new Response(buildQuoteHtmlDoc(quote, items, settings), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
