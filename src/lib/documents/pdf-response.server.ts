// Хелпер: если в запросе есть ?format=pdf — отдать сгенерированный PDF
// с заголовками attachment, иначе вернуть null (роут продолжит отдавать HTML-превью).
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { DocKind, DocOrder, DocItem } from "@/lib/documents/build.server";
import { buildOrderDocPdf, buildAttachmentFilename } from "@/lib/documents/pdf.server";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";

export async function maybePdfResponse(
  kind: DocKind,
  request: Request,
  order: DocOrder & { id: string; client_name?: string | null; client_company?: string | null },
  items: DocItem[],
  settings: DocumentSettings,
): Promise<Response | null> {
  const wantsPdf = new URL(request.url).searchParams.get("format") === "pdf";
  if (!wantsPdf) return null;

  const filename = buildAttachmentFilename(kind, order);
  return buildPdfResponse({
    filename,
    operation: `order-${kind}`,
    entityId: order.id,
    build: () => buildOrderDocPdf(kind, order, items, settings),
  });
}
