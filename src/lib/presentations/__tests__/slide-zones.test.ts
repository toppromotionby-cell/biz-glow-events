import { describe, expect, it } from "vitest";
import { rectsOverlap, slideLayout, SLIDE_W } from "@/lib/presentations/design";
import { planSlideLogos } from "@/lib/presentations/logo-plan";
import {
  DEFAULT_PRESENTATION_LOGO_LAYOUT, blankSlide, normalizeContent,
  type PresentationSlide, type SlideLayoutOverrides,
} from "@/lib/presentations/model";
import { nearestZone, photoZones, textZones } from "@/lib/presentations/zones";

function slideWith(over: Partial<SlideLayoutOverrides>, photos = ["a.jpg", "b.jpg"]): PresentationSlide {
  const s = blankSlide("product", 0);
  s.content = {
    ...s.content,
    description: "Описание позиции ".repeat(10),
    images: photos,
    layout: { ...s.content.layout, ...over },
  };
  return s;
}

describe("умные зоны раскладки слайда", () => {
  it("старые слайды без настроек остаются на автомате", () => {
    const c = normalizeContent({ description: "x" });
    expect(c.layout.photoZone).toBe("auto");
    expect(c.layout.photoScale).toBeNull();
  });

  it("зона фото задаёт сторону, масштаб ограничивается 25–65%", () => {
    const left = slideLayout(slideWith({ photoZone: "left", photoScale: 0.9 }));
    expect(left.placement).toBe("left");
    expect(left.photoBox!.w).toBeLessThanOrEqual(SLIDE_W * 0.65 + 1);

    const right = slideLayout(slideWith({ photoZone: "right", photoScale: 0.05 }));
    expect(right.placement).toBe("right");
    expect(right.photoBox!.w).toBeGreaterThanOrEqual(SLIDE_W * 0.25 - 1);
  });

  it("фото и текст не пересекаются при ручном масштабе", () => {
    for (const scale of [0.25, 0.4, 0.65]) {
      for (const zone of ["left", "right"] as const) {
        const l = slideLayout(slideWith({ photoZone: zone, photoScale: scale }));
        const p = l.photoBox!;
        const t = l.textBox;
        const overlap = p.x < t.x + t.w && p.x + p.w > t.x;
        expect(overlap).toBe(false);
      }
    }
  });

  it("ширина текста ужимается коэффициентом", () => {
    const full = slideLayout(slideWith({ photoZone: "none" }));
    const half = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5 }));
    expect(half.textBox.w).toBeLessThan(full.textBox.w);
  });

  it("зона цены даёт отдельную область", () => {
    expect(slideLayout(slideWith({})).priceBox).toBeNull();
    expect(slideLayout(slideWith({ priceZone: "corner" })).priceBox).not.toBeNull();
  });

  it("ближайшая зона выбирается по координате", () => {
    expect(nearestZone(photoZones(), { x: 40, y: 360 }).id).toBe("left");
    expect(nearestZone(photoZones(), { x: 1240, y: 360 }).id).toBe("right");
    expect(nearestZone(textZones(), { x: 640, y: 90 }).id).toBe("top");
    expect(nearestZone(textZones(), { x: 640, y: 640 }).id).toBe("bottom");
  });

  it("ручная зона логотипа уважается и не конфликтует", () => {
    const plan = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: true,
      hasClientLogo: true,
      overrides: {
        ...slideWith({}).content.layout,
        brandLogo: { zone: "tl", scale: 1.5 },
        clientLogo: { zone: "tl", scale: null },
      },
    });
    expect(plan.client?.slot).toBe("tl");
    expect(plan.brand?.slot).not.toBe("tl");
  });
});

describe("выравнивание блоков на слайде", () => {
  it("по горизонтали сдвигает текстовый блок внутри колонки", () => {
    const left = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5, alignX: "left" }));
    const center = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5, alignX: "center" }));
    const right = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5, alignX: "right" }));
    expect(center.textBox.x).toBeGreaterThan(left.textBox.x);
    expect(right.textBox.x).toBeGreaterThan(center.textBox.x);
    expect(right.textAlignX).toBe("right");
    expect(left.textBox.w).toBeCloseTo(right.textBox.w, 5);
  });

  it("растягивание по ширине отменяет ручное сужение", () => {
    const narrow = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5 }));
    const full = slideLayout(slideWith({ photoZone: "none", textWidth: 0.5, stretchX: true }));
    expect(full.textBox.w).toBeGreaterThan(narrow.textBox.w);
  });

  it("растягивание по высоте отключает вертикальное выравнивание", () => {
    const l = slideLayout(slideWith({ photoZone: "none", textZone: "center", stretchY: true }));
    expect(l.textAlign).toBe("top");
    expect(l.textFill).toBe(true);
  });

  it("выровненный текст не выходит за фото", () => {
    for (const zone of ["left", "right"] as const) {
      const l = slideLayout(slideWith({ photoZone: zone, textWidth: 0.5, alignX: "right" }));
      const p = l.photoBox!;
      const t = l.textBox;
      expect(t.x + t.w).toBeLessThanOrEqual(SLIDE_W);
      expect(p.x < t.x + t.w && p.x + p.w > t.x).toBe(false);
    }
  });
});

describe("сборка слайда без наложений", () => {
  it("блок цены не попадает на фото ни при одной зоне", () => {
    for (const photoZone of ["left", "right", "top"] as const) {
      for (const priceZone of ["under-text", "corner", "beside-photo"] as const) {
        const l = slideLayout(slideWith({ photoZone, priceZone }));
        const p = l.priceBox!;
        expect(p).not.toBeNull();
        expect(rectsOverlap(p, l.photoBox!, 12)).toBe(false);
      }
    }
  });

  it("текстовая колонка ужимается под блоком цены", () => {
    const plain = slideLayout(slideWith({ photoZone: "none" }));
    const withPrice = slideLayout(slideWith({ photoZone: "none", priceZone: "corner" }));
    expect(withPrice.textBox.h).toBeLessThan(plain.textBox.h);
    expect(rectsOverlap(withPrice.priceBox!, withPrice.textBox, 8)).toBe(false);
  });

  it("зона выбирается по попаданию в область, а не только по центру", () => {
    expect(nearestZone(photoZones(), { x: 10, y: 700 }).id).toBe("left");
    expect(nearestZone(textZones(), { x: 640, y: 400 }).id).toBe("center");
  });

  it("логотип уходит из зоны, занятой ценой", () => {
    const price = { x: SLIDE_W - 360, y: 0, w: 340, h: 120 };
    const plan = planSlideLogos({
      slideType: "product",
      layout: DEFAULT_PRESENTATION_LOGO_LAYOUT,
      hasBrandLogo: false,
      hasClientLogo: true,
      blocked: [price],
    });
    expect(plan.client?.slot).not.toBe("tr");
  });
});
