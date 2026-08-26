import { describe, expect, it } from "vitest";
import { BRAND_KIT_PRESETS, applyBrandKit, brandFrameBlock, normalizeBrandKit } from "@/lib/presentations/brand-kit";
import { checkPresentation, repairPresentation } from "@/lib/presentations/integrity";
import { blankSlide } from "@/lib/presentations/model";

function slide(i: number, patch: Partial<ReturnType<typeof blankSlide>> = {}) {
  const s = blankSlide("text", i);
  return { ...s, title: `Слайд ${i}`, content: { ...s.content, description: "Текст" }, ...patch };
}

describe("integrity", () => {
  it("не находит проблем на нормальных слайдах", () => {
    const r = checkPresentation([slide(0), slide(1)]);
    expect(r.errors).toBe(0);
  });

  it("ловит дубликаты и пустые слайды и чинит их", () => {
    const a = slide(0);
    const dup = { ...a, id: "dup" };
    const empty = blankSlide("text", 2);
    const report = checkPresentation([a, dup, empty]);
    expect(report.issues.some((i) => i.code === "duplicate-slide")).toBe(true);
    expect(report.issues.some((i) => i.code === "empty-slide")).toBe(true);

    const fixed = repairPresentation([a, dup, empty]);
    expect(fixed.slides).toHaveLength(1);
    expect(fixed.actions.length).toBeGreaterThan(0);
    expect(checkPresentation(fixed.slides).errors).toBe(0);
  });
});

describe("brand kit", () => {
  it("нормализует набор и рисует рамку", () => {
    const kit = normalizeBrandKit(BRAND_KIT_PRESETS[1]);
    expect(kit?.frame).toBe("soft");
    expect(brandFrameBlock("none")).toBeNull();
    expect(brandFrameBlock("card")?.kind).toBe("rect");
  });

  it("подменяет только шаблонный фон", () => {
    const kit = BRAND_KIT_PRESETS[0]!;
    const tpl = { mode: "template", stops: [] as string[], angle: 0 };
    expect(applyBrandKit(tpl, kit, "#000").background.stops).toEqual(kit.stops);
    const own = { mode: "gradient", stops: ["#123456"], angle: 90 };
    expect(applyBrandKit(own, kit, "#000").background.stops).toEqual(["#123456"]);
  });
});
