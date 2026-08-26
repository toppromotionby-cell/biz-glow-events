// Регрессия: порядок и число кадров одинаковы в превью и в подготовке к PDF,
// а «потерянные» фото (показ выключен) ловятся аудитом.
import { describe, expect, it } from "vitest";
import { MAX_SLIDE_PHOTOS, slidePhotos, typeScale } from "@/lib/presentations/design";
import { layoutSlideSpec } from "@/lib/presentations/blocks";
import { auditSlide } from "@/lib/presentations/audit";
import { blankSlide, type PresentationSlide } from "@/lib/presentations/model";

const withPhotos = (urls: string[], patch: Partial<PresentationSlide["content"]> = {}) => {
  const s = blankSlide("gallery", 0);
  s.content = { ...s.content, images: urls, showImage: true, ...patch };
  return s;
};

const urls = (n: number) => Array.from({ length: n }, (_, i) => `photo-${i + 1}.jpg`);

describe("порядок фотографий слайда", () => {
  it("главные фото уходят в начало", () => {
    const s = withPhotos(urls(5), { photoPriority: ["photo-4.jpg", "photo-2.jpg"] });
    expect(slidePhotos(s)).toEqual([
      "photo-4.jpg", "photo-2.jpg", "photo-1.jpg", "photo-3.jpg", "photo-5.jpg",
    ]);
  });

  it("лимит кадров соблюдается", () => {
    const s = withPhotos(urls(20));
    expect(slidePhotos(s)).toHaveLength(MAX_SLIDE_PHOTOS);
  });

  it("выключенный показ фото прячет все кадры", () => {
    expect(slidePhotos(withPhotos(urls(3), { showImage: false }))).toEqual([]);
  });

  it("галерея рисует ровно столько кадров, сколько фото", () => {
    for (const n of [1, 3, 7, 15, 18]) {
      const s = withPhotos(urls(n));
      const blocks = layoutSlideSpec({
        slide: s, ts: typeScale("normal"), brandName: "", footerLogo: false, index: 0, total: 1,
      });
      const images = blocks.filter((b) => b.kind === "image");
      expect(images).toHaveLength(Math.min(n, MAX_SLIDE_PHOTOS));
      // Индексы кадров совпадают с порядком slidePhotos — то же, что уйдёт в PDF.
      const order = slidePhotos(s);
      images.forEach((b) => {
        if (b.kind !== "image") return;
        expect(b.path).toBe(order[b.index]);
      });
    }
  });
});

describe("аудит фотографий", () => {
  it("предупреждает, когда фото загружены, но показ выключен", () => {
    const s = withPhotos(urls(2), { showImage: false });
    const issues = auditSlide(s, 0);
    expect(issues.some((i) => i.block === "photo" && /не отображаются/.test(i.message))).toBe(true);
  });

  it("не ругается, когда фото показываются", () => {
    const issues = auditSlide(withPhotos(urls(2)), 0);
    expect(issues.some((i) => i.block === "photo")).toBe(false);
  });
});
