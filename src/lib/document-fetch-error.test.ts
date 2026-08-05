import { describe, expect, it } from "vitest";
import { documentFetchError } from "@/lib/document-fetch-error";

describe("documentFetchError", () => {
  it("does not expose raw server response text", () => {
    expect(documentFetchError(502)).toBe("Не удалось сформировать документ. Повторите попытку");
  });

  it("keeps the safe diagnostic id", () => {
    expect(documentFetchError(500, "abc-123")).toContain("Код ошибки: abc-123");
  });

  it("uses useful messages for auth and missing files", () => {
    expect(documentFetchError(401)).toContain("Войдите снова");
    expect(documentFetchError(403)).toContain("Недостаточно прав");
    expect(documentFetchError(404)).toBe("Документ не найден");
  });
});