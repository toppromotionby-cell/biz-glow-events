type PdfBuildOptions = {
  filename: string;
  operation: string;
  entityId?: string;
  build: () => Promise<Uint8Array>;
};

function safeAsciiFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "") || "document.pdf";
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  const ascii = safeAsciiFilename(filename);
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}

export async function buildPdfResponse(options: PdfBuildOptions): Promise<Response> {
  try {
    return pdfResponse(await options.build(), options.filename);
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error("[document-pdf] build failed", {
      errorId,
      operation: options.operation,
      entityId: options.entityId,
      error,
    });
    return Response.json(
      { error: "Не удалось сформировать PDF", errorId },
      {
        status: 500,
        headers: { "cache-control": "no-store", "x-document-error-id": errorId },
      },
    );
  }
}