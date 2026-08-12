// Публичная ссылка на презентацию: /p/<token>
// GET             — простая страница просмотра со встроенным PDF
// GET ?format=pdf — сам файл презентации
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { presentationFileName } from "@/lib/presentations/model";
import { loadPresentationBundle, buildBundlePdf } from "@/lib/presentations/render.server";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function notFound(): Response {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><title>Ссылка недействительна</title></head>
     <body style="font-family:system-ui,sans-serif;background:#0b0b0f;color:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
     <div style="text-align:center;max-width:420px;padding:24px">
       <h1 style="font-size:22px;margin:0 0 8px">Ссылка недействительна</h1>
       <p style="color:#a1a1aa;font-size:14px;margin:0">Презентация не найдена или доступ по ссылке отключён.</p>
     </div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/p/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const bundle = await loadPresentationBundle({ token: params.token });
        if (!bundle) return notFound();

        if (new URL(request.url).searchParams.get("format") === "pdf") {
          return buildPdfResponse({
            filename: presentationFileName(bundle.presentation.title, "pdf"),
            operation: "public-presentation",
            entityId: bundle.presentation.id,
            build: () => buildBundlePdf(bundle),
          });
        }

        await supabaseAdmin
          .from("presentations")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", bundle.presentation.id)
          .is("viewed_at", null);

        const title = esc(bundle.presentation.title);
        const pdf = `/p/${encodeURIComponent(params.token)}?format=pdf`;
        return new Response(
          `<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/><title>${title}</title></head>
<body style="margin:0;background:#0b0b0f;color:#f4f4f5;font-family:system-ui,sans-serif;display:flex;flex-direction:column;min-height:100vh">
  <header style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #27272a">
    <strong style="font-size:16px">${title}</strong>
    <a href="${pdf}" download style="background:#f4f4f5;color:#0b0b0f;border-radius:8px;padding:8px 14px;text-decoration:none;font-size:14px">Скачать PDF</a>
  </header>
  <iframe src="${pdf}#view=FitH" title="${title}" style="flex:1;border:0;width:100%;min-height:80vh"></iframe>
</body></html>`,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
              "x-robots-tag": "noindex, nofollow",
            },
          },
        );
      },
    },
  },
});
