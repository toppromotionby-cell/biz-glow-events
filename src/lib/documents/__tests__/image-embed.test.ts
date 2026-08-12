import { describe, expect, it } from "vitest";
import {
  conversionCandidates,
  proxyUrl,
  sniffImageFormat,
} from "@/lib/documents/image-embed.server";

const bytes = (s: string) => new TextEncoder().encode(s);
const STORAGE = "https://x.supabase.co/storage/v1/object/public/catalog-media/a/logo.svg";

describe("sniffImageFormat", () => {
  it("узнаёт SVG с прологом, BOM и голым тегом", () => {
    expect(sniffImageFormat(bytes('<svg width="10" height="10"></svg>'))).toBe("svg");
    expect(sniffImageFormat(bytes('<?xml version="1.0"?><svg viewBox="0 0 1 1"/>'))).toBe("svg");
    expect(sniffImageFormat(bytes('\uFEFF  <svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
  });

  it("не путает SVG с растром и произвольным текстом", () => {
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpg");
    expect(sniffImageFormat(bytes("<html><body>not an image</body></html>"))).toBe("unknown");
  });
});

describe("conversionCandidates", () => {
  it("для SVG из хранилища идёт сразу в прокси и просит PNG", () => {
    const list = conversionCandidates(STORAGE, 1600, "svg");
    expect(list[0]).toBe(proxyUrl(STORAGE, 1600, "png"));
    expect(list.some((u) => u.includes("/render/image/"))).toBe(false);
    expect(list.at(-1)).toBe(proxyUrl(STORAGE, 1600, "jpg"));
  });

  it("для растра из хранилища сначала пробует трансформер, потом прокси", () => {
    const url = STORAGE.replace("logo.svg", "photo.webp");
    const list = conversionCandidates(url, 1600, "webp");
    expect(list[0]).toContain("/storage/v1/render/image/");
    expect(list.slice(1)).toEqual([proxyUrl(url, 1600, "png"), proxyUrl(url, 1600, "jpg")]);
  });

  it("для внешней ссылки использует только прокси", () => {
    const list = conversionCandidates("https://cdn.example.com/a.webp", 800, "webp");
    expect(list.every((u) => u.startsWith("https://images.weserv.nl/"))).toBe(true);
  });

  it("gif конвертируется в JPEG (прозрачность не нужна)", () => {
    expect(conversionCandidates("https://cdn.example.com/a.gif", 800, "gif")).toEqual([
      proxyUrl("https://cdn.example.com/a.gif", 800, "jpg"),
    ]);
  });
});
