import { describe, expect, it } from "vitest";
import { LOAN_LENDERS, LOAN_PRESETS } from "@/lib/paperwork/loan-presets";
import { PW_PRESETS } from "@/lib/paperwork/preset-templates";
import { missingBlocks } from "@/lib/paperwork/kinds";

describe("шаблоны договора займа", () => {
  it("каждому варианту займодавца соответствует шаблон", () => {
    expect(LOAN_LENDERS).toHaveLength(4);
    for (const lender of LOAN_LENDERS) {
      const preset = LOAN_PRESETS.find((p) => p.id === lender.presetId);
      expect(preset, lender.key).toBeTruthy();
      expect(preset!.doc_type).toBe("loan");
    }
  });

  it("шаблоны входят в каталог встроенных и имеют обязательные блоки", () => {
    for (const preset of LOAN_PRESETS) {
      expect(PW_PRESETS.some((p) => p.id === preset.id)).toBe(true);
      const types = preset.blocks.map((b) => b.type);
      expect(missingBlocks("loan", types)).toEqual([]);
    }
  });

  it("имена шаблонов уникальны — доустановка не создаёт дублей", () => {
    const names = PW_PRESETS.map((p) => p.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
