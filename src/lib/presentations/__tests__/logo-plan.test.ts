import { describe, expect, it } from "vitest";
import { planSlideLogos } from "@/lib/presentations/logo-plan";
import { DEFAULT_PRESENTATION_LOGO_LAYOUT, type SlideType } from "@/lib/presentations/model";

const TYPES: SlideType[] = ["title", "product", "text", "section", "contacts"];

describe("planSlideLogos", () => {
  it("даёт максимум один логотип каждого вида и без конфликта слотов", () => {
    for (const slideType of TYPES) {
      const plan = planSlideLogos({
        slideType,
        layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
        hasBrandLogo: true,
        hasClientLogo: true,
      });
      expect(plan.brand).not.toBeNull();
      expect(plan.client).not.toBeNull();
      expect(plan.brand!.slot).not.toBe(plan.client!.slot);
    }
  });

  it("на титульном логотип компании крупный и не в футере", () => {
    const plan = planSlideLogos({
      slideType: "title",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: true,
      hasClientLogo: false,
    });
    expect(plan.brand?.slot).toBe("hero");
  });

  it("на обычных слайдах логотип компании только в футере", () => {
    for (const slideType of ["product", "text", "section", "contacts"] as SlideType[]) {
      const plan = planSlideLogos({
        slideType,
        layout: { ...DEFAULT_PRESENTATION_LOGO_LAYOUT, brand: "always" },
        hasBrandLogo: true,
        hasClientLogo: false,
      });
      expect(plan.brand?.slot).toBe("footer");
    }
  });

  it("клиентский логотип уходит из угла, занятого фото", () => {
    const plan = planSlideLogos({
      slideType: "product",
      frames: [{ x: 640, y: 0, w: 640, h: 720 }],
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: true,
      hasClientLogo: true,
    });
    expect(plan.client?.slot).toBe("tl");
  });

  it("режимы off / title-only соблюдаются", () => {
    const off = planSlideLogos({
      slideType: "text",
      layout: { brand: "off", client: "title-only", scale: 1 },
      hasBrandLogo: true,
      hasClientLogo: true,
    });
    expect(off.brand).toBeNull();
    expect(off.client).toBeNull();
  });
});
