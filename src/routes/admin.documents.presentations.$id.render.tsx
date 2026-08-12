// Server route: /admin/documents/presentations/$id/render?format=pdf — PDF 16:9.
import { createFileRoute } from "@tanstack/react-router";
import { requireStaff } from "@/lib/admin-route-guard";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { presentationFileName } from "@/lib/presentations/model";
import { loadPresentationBundle, buildBundlePdf } from "@/lib/presentations/render.server";

export const Route = createFileRoute("/admin/documents/presentations/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const bundle = await loadPresentationBundle({ id: params.id });
        if (!bundle) return new Response("Not found", { status: 404 });

        return buildPdfResponse({
          filename: presentationFileName(bundle.presentation.title, "pdf"),
          operation: "presentation",
          entityId: params.id,
          build: () => buildBundlePdf(bundle),
        });
      },
    },
  },
});
