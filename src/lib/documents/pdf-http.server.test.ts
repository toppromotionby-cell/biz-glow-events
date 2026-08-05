import { describe, expect, it, vi } from "vitest";
import { buildPdfResponse, pdfResponse } from "@/lib/documents/pdf-http.server";

describe("PDF HTTP response", () => {
  it("returns PDF with safe ASCII and UTF-8 filenames", async () => {
    const response = pdfResponse(new TextEncoder().encode("%PDF-test"), "Счёт №1.pdf");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(await response.text()).toBe("%PDF-test");
  });

  it("hides internal build failures and returns a diagnostic id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await buildPdfResponse({
      filename: "doc.pdf",
      operation: "test",
      entityId: "entity",
      build: async () => { throw new Error("secret internal detail"); },
    });
    const body = await response.json() as { error: string; errorId: string };
    expect(response.status).toBe(500);
    expect(body.error).toBe("Не удалось сформировать PDF");
    expect(body.errorId).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
    expect(response.headers.get("x-document-error-id")).toBe(body.errorId);
  });
});