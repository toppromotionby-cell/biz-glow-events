import { describe, expect, it } from "vitest";
import { collectVariables } from "@/lib/paperwork/variables";
import { presetById } from "@/lib/paperwork/preset-templates";
import { WORKACT_PRESET, WORKACT_PRESET_ID } from "@/lib/paperwork/workact-preset";
import { workActAmounts } from "@/lib/paperwork/workact-calc";

describe("workact preset", () => {
  it("зарегистрирован в каталоге встроенных шаблонов", () => {
    expect(presetById(WORKACT_PRESET_ID)?.doc_type).toBe("workact");
  });

  it("содержит договор, разрыв страницы и акт", () => {
    const types = WORKACT_PRESET.blocks.map((b) => b.type);
    expect(types.filter((t) => t === "pagebreak")).toHaveLength(1);
    const texts = WORKACT_PRESET.blocks.map((b) => b.text).join("\n");
    expect(texts).toContain("ДОГОВОР ПОДРЯДА");
    expect(texts).toContain("АКТ СДАЧИ-ПРИЁМКИ ВЫПОЛНЕННЫХ РАБОТ");
  });

  it("выводит сумму к выплате в договоре и акте", () => {
    const vars = collectVariables(WORKACT_PRESET.blocks).map((v) => v.toLowerCase());
    expect(vars).toContain("сумма к выплате");
    expect(vars).toContain("сумма к выплате прописью");
    expect(vars).toContain("сумма к выплате по акту");
    expect(vars).toContain("сумма к выплате по акту прописью");
  });

  it("собирает данные подрядчика в переменные", () => {
    const vars = collectVariables(WORKACT_PRESET.blocks).map((v) => v.toLowerCase());
    for (const key of [
      "фио подрядчика",
      "серия паспорта",
      "номер паспорта",
      "идентификационный номер",
      "адрес регистрации",
      "номер договора",
      "дата договора",
      "номер акта",
      "дата акта",
    ]) {
      expect(vars).toContain(key);
    }
  });
});

describe("workActAmounts", () => {
  it("считает 13%, 1% и сумму к выплате", () => {
    const a = workActAmounts(930.23);
    expect(a.tax).toBe(120.93);
    expect(a.fszn).toBe(9.3);
    expect(a.payout).toBe(930.23 - 120.93 - 9.3);
    expect(a.payoutWords).toMatch(/руб/);
  });

  it("не уходит в минус на пустой сумме", () => {
    const a = workActAmounts(0);
    expect(a.payout).toBe(0);
    expect(a.priceWords).toMatch(/ноль/i);
  });
});
