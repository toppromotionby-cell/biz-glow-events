// Регрессия: каждый тип структурного слайда во всех 5 вариантах даёт
// корректную геометрию — блоки внутри холста и без нулевых размеров.
import { describe, expect, it } from "vitest";
import { LAYOUT_SLIDE_TYPES, layoutSlideSpec } from "@/lib/presentations/blocks";
import { SLIDE_H, SLIDE_W, typeScale } from "@/lib/presentations/design";
import { SLIDE_VARIANTS, blankSlide } from "@/lib/presentations/model";

const ts = typeScale("normal");

describe("структурные слайды", () => {
  for (const type of LAYOUT_SLIDE_TYPES) {
    for (const v of SLIDE_VARIANTS[type]) {
      it(`${type} / ${v.id} — блоки внутри холста`, () => {
        const slide = blankSlide(type, 0, v.id);
        slide.content.images = ["a.jpg", "b.jpg", "c.jpg"];
        const blocks = layoutSlideSpec({
          slide, ts, brandName: "Event Hub", footerLogo: false, index: 0, total: 5,
        });
        expect(blocks.length).toBeGreaterThan(0);
        for (const b of blocks) {
          if (b.kind === "shade") continue;
          if (b.kind === "circle") {
            expect(b.r).toBeGreaterThan(0);
            expect(b.cx).toBeGreaterThanOrEqual(0);
            expect(b.cy).toBeLessThanOrEqual(SLIDE_H);
            continue;
          }
          expect(b.x).toBeGreaterThanOrEqual(-1);
          expect(b.y).toBeGreaterThanOrEqual(-1);
          expect(b.x + b.w).toBeLessThanOrEqual(SLIDE_W + 1);
          if (b.kind !== "text") {
            expect(b.h).toBeGreaterThan(0);
            expect(b.y + b.h).toBeLessThanOrEqual(SLIDE_H + 1);
          }
        }
      });
    }
  }
});
