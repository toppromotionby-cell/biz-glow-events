import { describe, expect, it } from "vitest";
import {
  detectVersionFromText,
  reconcileWithCatalog,
  versionLabel,
  brandedDisplayTitle,
  brandedVersionFileName,
} from "./version-detect";

describe("detectVersionFromText", () => {
  it("считает трек без скобок оригиналом", () => {
    const v = detectVersionFromText("Believer");
    expect(v.isRemix).toBe(false);
    expect(versionLabel(v)).toBe("Оригинал");
  });

  it("вытаскивает ремиксера из скобок", () => {
    const v = detectVersionFromText("Believer (Dj Smash Remix)");
    expect(v.isRemix).toBe(true);
    expect(v.remixer).toBe("Dj Smash");
    expect(versionLabel(v)).toBe("Dj Smash Remix");
  });

  it("не путает Extended Mix с ремиксом", () => {
    const v = detectVersionFromText("Believer (Extended Mix)");
    expect(v.isRemix).toBe(false);
  });
});

describe("брендирование", () => {
  it("подписывает оригинал", () => {
    expect(brandedDisplayTitle({ artist: "Imagine Dragons", title: "Believer", label: "Оригинал" }))
      .toBe("Imagine Dragons - Believer (Оригинал) [event-hub.by]");
  });

  it("подписывает ремикс и чистит имя файла", () => {
    const name = brandedVersionFileName({
      artist: "Imagine Dragons",
      title: "Believer",
      label: "Dj Smash Remix",
      ext: "mp3",
    });
    expect(name).toContain("Dj Smash Remix");
    expect(name).toContain("event-hub.by");
    expect(name.endsWith(".mp3")).toBe(true);
    expect(name).not.toMatch(/[/\\:*?"<>|]/);
  });
});

describe("reconcileWithCatalog", () => {
  it("доверяет скобкам, когда каталог молчит", () => {
    const local = detectVersionFromText("Believer (Dj Smash Remix)");
    const r = reconcileWithCatalog(local, null);
    expect(r.isRemix).toBe(true);
    expect(r.source).toBe("brackets");
  });

  it("помечает оригинал по каталогу", () => {
    const local = detectVersionFromText("Believer");
    const r = reconcileWithCatalog(local, { artist: "Imagine Dragons", title: "Believer", fullTitle: "Believer", durationSec: 204, provider: "deezer" });
    expect(r.isRemix).toBe(false);
  });
});
