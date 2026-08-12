import { describe, expect, it } from "vitest";
import { LOGO_MIN_FIT, planSlideLogos } from "@/lib/presentations/logo-plan";
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

describe("автоуменьшение логотипа (логика Canva)", () => {
  const FULL_BLOCK = [
    { x: 0, y: 0, w: 1280, h: 200 },
    { x: 0, y: 520, w: 1280, h: 200 },
  ];

  it("не меняет размер, когда угол свободен", () => {
    const base = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
    });
    const withBlocked = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
      blocked: [{ x: 400, y: 300, w: 200, h: 100 }],
    });
    expect(withBlocked.client?.maxH).toBe(base.client?.maxH);
  });

  it("уменьшает логотип, если все углы частично заняты", () => {
    const base = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
    });
    const tight = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
      blocked: [
        { x: 140, y: 0, w: 1000, h: 720 },
        { x: 0, y: 100, w: 1280, h: 620 },
      ],
    });
    expect(tight.client).not.toBeNull();
    expect(tight.client!.maxW).toBeLessThan(base.client!.maxW);
    expect(tight.client!.maxW / tight.client!.maxH).toBeCloseTo(base.client!.maxW / base.client!.maxH, 4);
    expect(tight.client!.maxW / base.client!.maxW).toBeGreaterThanOrEqual(LOGO_MIN_FIT);
  });

  it("не убирает логотип при нехватке места, а ужимает до минимума", () => {
    const plan = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
      blocked: FULL_BLOCK.concat([{ x: 0, y: 0, w: 1280, h: 720 }]),
    });
    expect(plan.client).not.toBeNull();
    expect(plan.client!.maxW).toBeGreaterThan(0);
  });

});
