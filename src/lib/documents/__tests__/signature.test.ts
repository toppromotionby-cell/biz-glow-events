import { describe, expect, it } from "vitest";
import { resolveSignature, signatureMediaHtml, SIGN_MEDIA_MM } from "@/lib/documents/signature";

describe("resolveSignature", () => {
  it("берёт картинку документа приоритетнее компании", () => {
    const r = resolveSignature({
      docSignatureUrl: "https://a/doc.png",
      companySignatureUrl: "https://a/company.png",
      showSignature: true,
    });
    expect(r.signatureUrl).toBe("https://a/doc.png");
  });

  it("подхватывает подпись из карточки компании", () => {
    const r = resolveSignature({ companySignatureUrl: "https://a/company.png", showSignature: true });
    expect(r.signatureUrl).toBe("https://a/company.png");
  });

  it("тумблеры выключают картинки жёстко", () => {
    const r = resolveSignature({
      companySignatureUrl: "https://a/s.png",
      companyStampUrl: "https://a/p.png",
      showSignature: false,
      showStamp: false,
    });
    expect(r.signatureUrl).toBeNull();
    expect(r.stampUrl).toBeNull();
  });

  it("печать без тумблера не показывается", () => {
    const r = resolveSignature({ companyStampUrl: "https://a/p.png" });
    expect(r.stampUrl).toBeNull();
  });

  it("предупреждает, когда тумблер включён, а картинки нет", () => {
    const r = resolveSignature({ showSignature: true, showStamp: true });
    expect(r.warnings).toHaveLength(2);
  });
});

describe("signatureMediaHtml", () => {
  it("пусто, когда картинок нет", () => {
    expect(signatureMediaHtml({ signatureUrl: null, stampUrl: null, warnings: [] })).toBe("");
  });

  it("рисует обе картинки с общими размерами в мм", () => {
    const html = signatureMediaHtml({ signatureUrl: "https://a/s.png", stampUrl: "https://a/p.png", warnings: [] });
    expect(html).toContain(`height:${SIGN_MEDIA_MM.signatureH}mm`);
    expect(html).toContain(`height:${SIGN_MEDIA_MM.stampH}mm`);
    expect(html).toContain("sign-facsimile");
    expect(html).toContain("sign-stamp");
  });

  it("экранирует URL", () => {
    const html = signatureMediaHtml({ signatureUrl: 'https://a/"x.png', stampUrl: null, warnings: [] });
    expect(html).not.toContain('src="https://a/"x.png"');
    expect(html).toContain("&quot;");
  });
});
