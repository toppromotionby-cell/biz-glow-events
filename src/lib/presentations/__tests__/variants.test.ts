import { describe, expect, it } from "vitest";
import { SLIDE_TYPE_LABELS, SLIDE_VARIANTS, blankSlide, type SlideType } from "@/lib/presentations/model";
import { slideLayout } from "@/lib/presentations/design";
import { variantPlan } from "@/lib/presentations/variant-layout";

const types = Object.keys(SLIDE_TYPE_LABELS) as SlideType[];

describe("варианты слайдов", () => {
  it("у каждого типа ровно 5 вариантов с уникальными id", () => {
    for (const t of types) {
      const list = SLIDE_VARIANTS[t];
      expect(list.length, t).toBe(5);
      expect(new Set(list.map((v) => v.id)).size, t).toBe(5);
    }
  });

  it("каждый вариант имеет план композиции и они не идентичны внутри типа", () => {
    for (const t of types) {
      const plans = SLIDE_VARIANTS[t].map((v) => JSON.stringify(variantPlan(t, v.id)));
      expect(new Set(plans).size, `${t}: варианты дают одинаковую композицию`).toBeGreaterThan(1);
    }
  });

  it("смена варианта меняет раскладку слайда при авто-настройках", () => {
    for (const t of types) {
      const layouts = SLIDE_VARIANTS[t].map((v) => {
        const slide = blankSlide(t, 0, v.id);
        slide.content = { ...slide.content, images: ["a.jpg", "b.jpg"] };
        const l = slideLayout(slide);
        return JSON.stringify([
          l.placement,
          l.textAlignX,
          l.textAlign,
          Math.round(l.textBox.w),
          Math.round(l.textBox.x),
        ]);
      });
      expect(new Set(layouts).size, `${t}: раскладка не реагирует на вариант`).toBeGreaterThan(1);
    }
  });
});
