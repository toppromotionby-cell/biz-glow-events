// Server route: /admin/paperwork/$id/render — HTML-превью документа,
// ?format=pdf → PDF, ?format=docx → DOCX. Источник блоков один и тот же.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { normalizeCompanyProfile } from "@/lib/documents/company-profile";
import { DEFAULT_BLANK, normalizeBlank, normalizeDocument, pwFileName } from "@/lib/paperwork/model";
import { applyVarsToBlocks, autoContext, resolveValues } from "@/lib/paperwork/variables";
import { clientLogoUrlFrom, paperworkHtml } from "@/lib/paperwork/html";

export const Route = createFileRoute("/admin/paperwork/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const { data: row } = await supabaseAdmin
          .from("paperwork_documents")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (!row) return new Response("Not found", { status: 404 });

        const doc = normalizeDocument(row as Record<string, unknown>);

        const [{ data: companyRow }, { data: blankRow }] = await Promise.all([
          doc.company_profile_id
            ? supabaseAdmin.from("company_profiles").select("*").eq("id", doc.company_profile_id).maybeSingle()
            : Promise.resolve({ data: null }),
          doc.company_profile_id
            ? supabaseAdmin
                .from("paperwork_brand_blanks")
                .select("settings")
                .eq("company_profile_id", doc.company_profile_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const company = companyRow ? normalizeCompanyProfile(companyRow as Record<string, unknown>) : null;
        const blank = normalizeBlank(
          (blankRow as { settings?: unknown } | null)?.settings ?? DEFAULT_BLANK,
        );

        const values = resolveValues(autoContext(company, doc), doc.values);
        const blocks = applyVarsToBlocks(doc.blocks, values);
        const payload = { doc, blocks, company, blank, clientLogoUrl: clientLogoUrlFrom(values) };

        const format = new URL(request.url).searchParams.get("format");

        if (format === "pdf") {
          const { buildPaperworkPdf } = await import("@/lib/paperwork/pdf.server");
          return buildPdfResponse({
            filename: pwFileName(doc.title, "pdf"),
            operation: "paperwork",
            entityId: params.id,
            build: () => buildPaperworkPdf(payload),
          });
        }

        if (format === "docx") {
          const { buildPaperworkDocx } = await import("@/lib/paperwork/docx-export.server");
          const bytes = await buildPaperworkDocx(payload);
          const head = new Uint8Array(bytes as unknown as ArrayBufferLike, 0, Math.min(4, (bytes as Uint8Array).byteLength));
          const validZip =
            (bytes as Uint8Array).byteLength > 0 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
          if (!validZip) {
            const errorId = crypto.randomUUID();
            console.error("[paperwork] docx build produced invalid file", { errorId, id: params.id });
            return new Response("Не удалось собрать DOCX", {
              status: 500,
              headers: { "x-document-error-id": errorId },
            });
          }
          return new Response(bytes as unknown as BodyInit, {
            status: 200,
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pwFileName(doc.title, "docx"))}`,
              "cache-control": "no-store",
            },
          });
        }

        return new Response(paperworkHtml(payload), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
