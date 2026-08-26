import { describe, expect, it } from "vitest";
import { buildEconomics, costModePatch, marginTone, resolveUnitCost } from "@/lib/documents/economics";

const row = (over: Partial<Parameters<typeof buildEconomics>[0][number]> = {}) => ({
  id: "1", section: "Оборудование", title: "Свет", qty: 2, qtyLabel: "2 шт.",
  price: 100, unitCost: 60, costMode: "amount" as const, costInput: 60, ...over,
});

describe("economics", () => {
  it("считает себестоимость в процентах от цены", () => {
    expect(resolveUnitCost(200, "percent", 40)).toBe(80);
    expect(resolveUnitCost(200, "amount", 55)).toBe(55);
  });

  it("сохраняет смысл при переключении режима", () => {
    expect(costModePatch({ price: 200, cost: 80 }, "percent")).toEqual({ cost_mode: "percent", cost_input: 40, cost: 80 });
  });

  it("группирует по разделам и считает маржу", () => {
    const e = buildEconomics([row(), row({ id: "2", section: "Персонал", unitCost: 0, costInput: 0 })], { netRevenue: 350 });
    expect(e.revenue).toBe(400);
    expect(e.cost).toBe(120);
    expect(e.margin).toBe(280);
    expect(e.sections).toHaveLength(2);
    expect(e.missingCount).toBe(1);
    expect(e.netMargin).toBe(230);
  });

  it("исключает опции из итога", () => {
    const e = buildEconomics([row(), row({ id: "2", excluded: true })]);
    expect(e.revenue).toBe(200);
  });

  it("подсвечивает низкую маржу", () => {
    expect(marginTone(10)).toBe("bad");
    expect(marginTone(20)).toBe("warn");
    expect(marginTone(45)).toBe("good");
    expect(marginTone(45, false)).toBe("none");
  });
});
