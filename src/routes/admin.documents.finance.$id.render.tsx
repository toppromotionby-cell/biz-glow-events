// Server route: /admin/documents/finance/$id/render — HTML или PDF сохранённого
// финансового документа (счёт, договор, акт) по его снимку данных.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildInvoiceHtml, buildContractHtml, buildActHtml, type DocOrder, type DocItem } from "@/lib/documents/build.server";
import { buildOrderDocPdf, buildAttachmentFilename } from "@/lib/documents/pdf.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";

const BUILDERS = {
  invoice: buildInvoiceHtml,
  contract: buildContractHtml,
  act: buildActHtml,
} as const;

export const Route = createFileRoute("/admin/documents/finance/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: doc, error }, settings] = await Promise.all([
          supabaseAdmin.from("finance_documents").select("*").eq("id", params.id).maybeSingle(),
          loadDocumentSettings(supabaseAdmin as never),
        ]);
        if (error || !doc) return new Response("Not found", { status: 404 });

        const kind = (doc.kind ?? "invoice") as keyof typeof BUILDERS;
        const items: DocItem[] = (Array.isArray(doc.items) ? doc.items : []).map((raw) => {
          const it = (raw ?? {}) as Record<string, unknown>;
          return { title: String(it.title ?? ""), qty: Number(it.qty ?? 1), price: Number(it.price ?? 0) };
        });

        const order: DocOrder & { id: string } = {
          id: String(doc.id),
          order_number: doc.doc_number ?? null,
          client_name: doc.client_name || "Клиент",
          client_company: doc.client_company || null,
          client_phone: doc.client_phone || null,
          client_email: doc.client_email || null,
          event_date: doc.event_date ?? null,
          notes: doc.notes || null,
          paid: doc.paid ?? 0,
        };

        if (new URL(request.url).searchParams.get("format") === "pdf") {
          return buildPdfResponse({
            filename: buildAttachmentFilename(kind, order),
            operation: `finance-${kind}`,
            entityId: order.id,
            build: () => buildOrderDocPdf(kind, order, items, settings),
          });
        }

        const html = BUILDERS[kind](order, items, settings);
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
