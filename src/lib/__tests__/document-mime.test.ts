import { describe, expect, it } from "vitest";
import { expectedSignature, isPreviewableMime, matchesSignature } from "@/lib/document-mime";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("document-mime", () => {
  it("PDF и HTML показываем в предпросмотре", () => {
    expect(isPreviewableMime("application/pdf")).toBe(true);
    expect(isPreviewableMime("text/html; charset=utf-8")).toBe(true);
    expect(isPreviewableMime("image/png")).toBe(true);
  });

  it("DOCX и архивы только скачиваем — iframe их «съедает»", () => {
    expect(isPreviewableMime(DOCX)).toBe(false);
    expect(isPreviewableMime("application/zip")).toBe(false);
    expect(isPreviewableMime("")).toBe(false);
  });

  it("сигнатуры известны по mime и по расширению", () => {
    expect(expectedSignature("application/pdf")).toBe("%PDF-");
    expect(expectedSignature(DOCX)).toBe("PK\u0003\u0004");
    expect(expectedSignature("application/octet-stream", "doc.docx")).toBe("PK\u0003\u0004");
    expect(expectedSignature("application/octet-stream", "data.bin")).toBeNull();
  });

  it("битые байты не проходят проверку", () => {
    expect(matchesSignature("%PDF-1.7", "%PDF-")).toBe(true);
    expect(matchesSignature("<!DOCTYPE", "%PDF-")).toBe(false);
    expect(matchesSignature("PK\u0003\u0004xx", "PK\u0003\u0004")).toBe(true);
  });
});
