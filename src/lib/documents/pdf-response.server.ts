// Хелпер: если в запросе есть ?format=pdf — отдать сгенерированный PDF
// с заголовками attachment, иначе вернуть null (роут продолжит отдавать HTML-превью).
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { DocKind, DocOrder, DocItem } from "@/lib/documents/build.server";
import { buildOrderDocPdf, buildAttachmentFilename } from "@/lib/documents/pdf.server";

export async function maybePdfResponse(
  kind: DocKind,
  request: Request,
  order: DocOrder & { id: string; client_name?: string | null; client_company?: string | null },
  items: DocItem[],
  settings: DocumentSettings,
): Promise<Response | null> {
  const wantsPdf = new URL(request.url).searchParams.get("format") === "pdf";
  if (!wantsPdf) return null;

  const bytes = await buildOrderDocPdf(kind, order, items, settings);
  const filename = buildAttachmentFilename(kind, order);
  // RFC 5987 — кириллица в имени файла.
  const filenameStar = `UTF-8''${encodeURIComponent(filename)}`;
  // pdf-lib иногда отдаёт Uint8Array поверх большего буфера — берём slice.
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=${filenameStar}`,
      "cache-control": "no-store",
    },
  });
}
