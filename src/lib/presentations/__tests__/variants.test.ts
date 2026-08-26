import { describe, expect, it } from "vitest";
import {
  SLIDE_TYPE_LABELS, SLIDE_VARIANTS, blankSlide, hasVariants,
  type PresentationSlide, type SlideType,
} from "@/lib/presentations/model";
import { SLIDE_H, SLIDE_W } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { slideSpec } from "@/lib/presentations/spec";

const types = Object.keys(SLIDE_TYPE_LABELS) as SlideType[];

/** Заполняет слайд демо-данными, чтобы блоки любого типа реально построились. */
function demoSlide(type: SlideType, variant: string): PresentationSlide {
  const s = blankSlide(type, 0, variant);
  s.title = "Новогодний корпоратив в стиле 2000-х";
  s.subtitle = "Y2K nostalgia party";
  s.content = {
    ...s.content,
    text: "Первый абзац описания идеи.\nВторой абзац с деталями площадки.\nТретий абзац про технику.",
    images: ["a.jpg", "b.jpg", "c.jpg"],
    price: 12800,
    unit: "усл.",
    items: ["Площадка", "Декор", "Звук и свет", "Ведущий"],
    specs: [
      { label: "Гостей", value: "120" },
      { label: "Длительность", value: "6 ч" },
    ],
  };
  return s;
}

function specOf(type: SlideType, variant: string) {
  const slide = demoSlide(type, variant);
  return slideSpec({
    slide,
    fit: fitSlide(slide),
    company: null,
    presentationTitle: "Презентация",
    brandName: "Top Promotion",
    heroLogo: null,
    footerLogo: false,
    dateLabel: "26.08.2026",
    index: 1,
    total: 10,
  });
}

describe("варианты слайдов", () => {
  it("у каждого типа ровно 5 вариантов с уникальными id", () => {
    for (const t of types) {
      const list = SLIDE_VARIANTS[t];
      expect(list.length, t).toBe(5);
      expect(new Set(list.map((v) => v.id)).size, t).toBe(5);
      expect(hasVariants(t), t).toBe(true);
    }
  });

  it("смена варианта реально меняет композицию слайда", () => {
    for (const t of types) {
      const shapes = SLIDE_VARIANTS[t].map((v) =>
        JSON.stringify(
          specOf(t, v.id).blocks.map((b) =>
            b.kind === "shade"
              ? ["shade", b.from, b.alpha]
              : b.kind === "logo"
                ? ["logo", Math.round(b.x), Math.round(b.y)]
                : b.kind === "text"
                  ? ["text", Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.size)]
                  : [b.kind, Math.round(b.x), Math.round(b.y)],
          ),
        ),
      );
      expect(new Set(shapes).size, `${t}: варианты дают одинаковую композицию`).toBeGreaterThan(1);
    }
  });

  it("блоки любого типа и варианта не выходят за пределы слайда", () => {
    const slack = 4;
    for (const t of types) {
      for (const v of SLIDE_VARIANTS[t]) {
        for (const b of specOf(t, v.id).blocks) {
          if (b.kind === "shade") continue;
          expect(b.x, `${t}/${v.id} ${b.kind}: слева`).toBeGreaterThanOrEqual(-slack);
          expect(b.y, `${t}/${v.id} ${b.kind}: сверху`).toBeGreaterThanOrEqual(-slack);
          expect(b.x + b.w, `${t}/${v.id} ${b.kind}: справа`).toBeLessThanOrEqual(SLIDE_W + slack);
          if (b.kind !== "text") {
            expect(b.y + b.h, `${t}/${v.id} ${b.kind}: снизу`).toBeLessThanOrEqual(SLIDE_H + slack);
          }
        }
      }
    }
  });
});
