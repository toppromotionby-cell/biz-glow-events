// Публичная страница коммерческого предложения по ссылке-токену: /kp/<token>
// GET  — HTML документа + панель действий (или PDF при ?format=pdf)
// POST — решение клиента (согласовать / отказаться)
import { createFileRoute } from "@tanstack/react-router";
import {
  loadPublicDoc, markViewed, applyClientResponse, buildPublicPage, buildDocPdf, docFileName,
} from "@/lib/documents/public-doc.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";

function notFound(): Response {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><title>Ссылка недействительна</title></head>
     <body style="font-family:Inter,system-ui,sans-serif;background:#0b0b0f;color:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
     <div style="text-align:center;max-width:420px;padding:24px">
       <h1 style="font-size:22px;margin:0 0 8px">Ссылка недействительна</h1>
       <p style="color:#a1a1aa;font-size:14px;margin:0">Предложение не найдено или больше не доступно. Свяжитесь с вашим менеджером.</p>
     </div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/kp/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const doc = await loadPublicDoc(params.token);
        if (!doc) return notFound();

        if (new URL(request.url).searchParams.get("format") === "pdf") {
          return buildPdfResponse({
            filename: docFileName(doc),
            operation: `public-${doc.kind}`,
            entityId: doc.quote.id,
            build: () => buildDocPdf(doc),
          });
        }

        await markViewed(doc);
        return new Response(buildPublicPage(doc, params.token), {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      },

      POST: async ({ params, request }) => {
        const doc = await loadPublicDoc(params.token);
        if (!doc) return notFound();

        const form = await request.formData();
        const response = String(form.get("response") ?? "");
        const comment = String(form.get("comment") ?? "").slice(0, 2000);
        if (response !== "accepted" && response !== "rejected") {
          return new Response("Bad request", { status: 400 });
        }
        if (!doc.quote.client_response) {
          await applyClientResponse(doc, response, comment);
        }
        return new Response(null, { status: 303, headers: { location: `/kp/${params.token}` } });
      },
    },
  },
});
