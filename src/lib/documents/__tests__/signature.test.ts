import { describe, expect, it } from "vitest";
import {
  resolveSignature,
  signatureAvailability,
  signatureMediaHtml,
  SIGN_MEDIA_MM,
} from "@/lib/documents/signature";

describe("resolveSignature", () => {
  it("берёт картинку документа приоритетнее компании", () => {
    const r = resolveSignature({
      docSignatureUrl: "https://a/doc.png",
      companySignatureUrl: "https://a/company.png",
    });
    expect(r.signatureUrl).toBe("https://a/doc.png");
  });

  it("подхватывает подпись из карточки компании", () => {
    const r = resolveSignature({ companySignatureUrl: "https://a/company.png" });
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

  it("без картинок ничего не рисуем, даже если тумблеры включены", () => {
    const r = resolveSignature({ showSignature: true, showStamp: true });
    expect(r.signatureUrl).toBeNull();
    expect(r.stampUrl).toBeNull();
  });

  it("печать показывается, когда картинка загружена", () => {
    const r = resolveSignature({ companyStampUrl: "https://a/p.png", showStamp: true });
    expect(r.stampUrl).toBe("https://a/p.png");
  });
});

describe("signatureAvailability", () => {
  it("ничего не доступно без картинок", () => {
    expect(signatureAvailability({})).toEqual({ hasSignature: false, hasStamp: false });
  });

  it("есть только печать — доступна только печать", () => {
    expect(signatureAvailability({ companyStampUrl: "https://a/p.png" })).toEqual({
      hasSignature: false,
      hasStamp: true,
    });
  });

  it("пустые строки не считаются картинкой", () => {
    expect(signatureAvailability({ docSignatureUrl: "   ", companySignatureUrl: null }).hasSignature).toBe(false);
  });
});

describe("signatureMediaHtml", () => {
  it("пусто, когда картинок нет", () => {
    expect(signatureMediaHtml({ signatureUrl: null, stampUrl: null })).toBe("");
  });

  it("рисует обе картинки с общими размерами в мм", () => {
    const html = signatureMediaHtml({ signatureUrl: "https://a/s.png", stampUrl: "https://a/p.png" });
    expect(html).toContain(`height:${SIGN_MEDIA_MM.signatureH}mm`);
    expect(html).toContain(`height:${SIGN_MEDIA_MM.stampH}mm`);
    expect(html).toContain("sign-image");
    expect(html).toContain("sign-stamp");
  });

  it("не содержит слова «факсимиле»", () => {
    const html = signatureMediaHtml({ signatureUrl: "https://a/s.png", stampUrl: null });
    expect(html.toLowerCase()).not.toContain("facsimile");
    expect(html).not.toContain("аксимиле");
  });

  it("экранирует URL", () => {
    const html = signatureMediaHtml({ signatureUrl: 'https://a/"x.png', stampUrl: null });
    expect(html).not.toContain('src="https://a/"x.png"');
    expect(html).toContain("&quot;");
  });
});
