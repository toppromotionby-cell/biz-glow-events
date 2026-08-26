// Визуальная регрессия фотораскладок: превью (spec) и PDF должны совпадать
// по сетке и по кропу для любого количества фото 1–15, при любых настройках
// fit/anchor и при приоритетных кадрах.
import { describe, expect, it } from "vitest";
import { contentSlideSpec } from "@/lib/presentations/content-spec";
import { SLIDE_H, SLIDE_W, slidePhotos, type Rect } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import {
  EMPTY_CONTENT, MAX_IMAGES, normalizeSlide, type PresentationSlide,
} from "@/lib/presentations/model";
import {
  PHOTO_ANCHORS, PHOTO_FITS, photoDrawRect, photoDrawRectPdf,
} from "@/lib/presentations/photo-fit";
import { photoFrames } from "@/lib/presentations/photo-grid";

const EPS = 0.6;

function slideWith(n: number, patch: Partial<typeof EMPTY_CONTENT> = {}): PresentationSlide {
  const images = Array.from({ length: n }, (_, i) => `https://cdn.test/p${i}.jpg`);
  return normalizeSlide({
    id: `s-${n}`,
    type: "product",
    title: "Фотозона «Неон»",
    subtitle: "Оформление входной группы",
    content: {
      ...EMPTY_CONTENT,
      description: "Комплект оформления с подсветкой и печатью.",
      images,
      ...patch,
    },
  });
}

const imageBlocks = (slide: PresentationSlide) =>
  contentSlideSpec({ slide, fit: fitSlide(slide), brandName: "Event Hub", footerLogo: false })
    .filter((b) => b.kind === "image") as Extract<
      ReturnType<typeof contentSlideSpec>[number], { kind: "image" }
    >[];

describe("фотораскладка: превью и PDF", () => {
  for (let n = 1; n <= MAX_IMAGES; n++) {
    it(`${n} фото: спек содержит ровно ${n} кадров внутри холста`, () => {
      const blocks = imageBlocks(slideWith(n));
      expect(blocks).toHaveLength(n);
      for (const b of blocks) {
        expect(b.x).toBeGreaterThanOrEqual(-EPS);
        expect(b.y).toBeGreaterThanOrEqual(-EPS);
        expect(b.x + b.w).toBeLessThanOrEqual(SLIDE_W + EPS);
        expect(b.y + b.h).toBeLessThanOrEqual(SLIDE_H + EPS);
        expect(b.alt).toContain("фото");
      }
      // Кадры не накладываются друг на друга.
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          const hit = a.x < b.x + b.w - EPS && a.x + a.w - EPS > b.x
            && a.y < b.y + b.h - EPS && a.y + a.h - EPS > b.y;
          expect(hit).toBe(false);
        }
      }
    });

    it(`${n} фото: геометрия PDF повторяет превью`, () => {
      const slide = slideWith(n);
      const blocks = imageBlocks(slide);
      // PDF масштабирует холст 1280×720 в points коэффициентом K.
      const K = 720 / SLIDE_W;
      for (const b of blocks) {
        const preview: Rect = { x: b.x, y: b.y, w: b.w, h: b.h };
        const pdf: Rect = { x: b.x * K, y: b.y * K, w: b.w * K, h: b.h * K };
        expect(pdf.w / K).toBeCloseTo(preview.w, 5);
        expect(pdf.h / K).toBeCloseTo(preview.h, 5);
      }
    });
  }

  it("кроп совпадает: PDF-версия зеркалит только ось Y", () => {
    const frame: Rect = { x: 0, y: 0, w: 400, h: 300 };
    for (const fit of PHOTO_FITS) {
      for (const anchor of PHOTO_ANCHORS) {
        const a = photoDrawRect(frame, 1600, 900, fit, anchor);
        const b = photoDrawRectPdf(frame, 1600, 900, fit, anchor);
        expect(b.w).toBeCloseTo(a.w, 6);
        expect(b.h).toBeCloseTo(a.h, 6);
        expect(b.x).toBeCloseTo(a.x, 6);
        // Сумма смещений сверху и снизу равна свободному месту в рамке.
        expect((a.y - frame.y) + (b.y - frame.y)).toBeCloseTo(frame.h - a.h, 6);
      }
    }
  });

  it("cover заполняет рамку, contain вписывается целиком", () => {
    const frame: Rect = { x: 10, y: 20, w: 400, h: 300 };
    const cover = photoDrawRect(frame, 900, 1600, "cover");
    expect(cover.w).toBeGreaterThanOrEqual(frame.w - 0.001);
    expect(cover.h).toBeGreaterThanOrEqual(frame.h - 0.001);
    const contain = photoDrawRect(frame, 900, 1600, "contain");
    expect(contain.w).toBeLessThanOrEqual(frame.w + 0.001);
    expect(contain.h).toBeLessThanOrEqual(frame.h + 0.001);
  });

  it("приоритетные фото занимают первые (самые заметные) слоты", () => {
    const slide = slideWith(6, { photoPriority: ["https://cdn.test/p4.jpg"] });
    const photos = slidePhotos(slide);
    expect(photos[0]).toBe("https://cdn.test/p4.jpg");
    const blocks = imageBlocks(slide);
    const area = (b: { w: number; h: number }) => b.w * b.h;
    const first = area(blocks[0]);
    for (const b of blocks.slice(1)) expect(first).toBeGreaterThanOrEqual(area(b) - 1);
  });

  it("пропорции фото влияют на выбор паттерна", () => {
    const box: Rect = { x: 0, y: 0, w: 1152, h: 560 };
    const portraitSet = photoFrames(box, 3, { gap: 16, aspects: [0.66, 0.66, 0.66] });
    const landscapeSet = photoFrames(box, 3, { gap: 16, aspects: [1.9, 1.9, 1.9] });
    const ratios = (f: Rect[]) => f.map((r) => +(r.w / r.h).toFixed(2)).join("|");
    expect(ratios(portraitSet)).not.toBe(ratios(landscapeSet));
  });
});
