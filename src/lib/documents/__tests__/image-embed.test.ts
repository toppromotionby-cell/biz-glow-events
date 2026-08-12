import { describe, expect, it, vi, afterEach } from "vitest";
import {
  sniffImageFormat, loadEmbeddableImageBytes,
} from "@/lib/documents/image-embed.server";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([
  ...[..."RIFF"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0,
  ...[..."WEBP"].map((c) => c.charCodeAt(0)),
]);

function res(bytes: Uint8Array) {
  return new Response(bytes.slice().buffer as ArrayBuffer, { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("sniffImageFormat", () => {
  it("определяет png/jpg/webp", () => {
    expect(sniffImageFormat(png)).toBe("png");
    expect(sniffImageFormat(jpg)).toBe("jpg");
    expect(sniffImageFormat(webp)).toBe("webp");
    expect(sniffImageFormat(new Uint8Array(4))).toBe("unknown");
  });
});

describe("loadEmbeddableImageBytes", () => {
  it("отдаёт jpeg напрямую без конвертации", async () => {
    const fetchMock = vi.fn(async () => res(jpg));
    vi.stubGlobal("fetch", fetchMock);
    const out = await loadEmbeddableImageBytes("https://x.by/a.jpg");
    expect(out?.format).toBe("jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("конвертирует webp через прокси", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return res(calls.length === 1 ? webp : jpg);
    }));
    const out = await loadEmbeddableImageBytes("https://event-tech.by/a.webp");
    expect(out?.format).toBe("jpg");
    expect(calls[1]).toContain("images.weserv.nl");
  });

  it("возвращает null для недоступного файла", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    expect(await loadEmbeddableImageBytes("https://x.by/a.webp")).toBeNull();
  });
});
