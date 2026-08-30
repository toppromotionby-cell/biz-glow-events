import { describe, expect, it } from "vitest";
import { ATTORNEY_KINDS, ATTORNEY_PRESETS } from "@/lib/paperwork/attorney-presets";
import { PW_PRESETS } from "@/lib/paperwork/preset-templates";
import { missingBlocks } from "@/lib/paperwork/kinds";

describe("шаблоны доверенностей", () => {
  it("каждому варианту соответствует шаблон", () => {
    expect(ATTORNEY_KINDS).toHaveLength(2);
    for (const kind of ATTORNEY_KINDS) {
      const preset = ATTORNEY_PRESETS.find((p) => p.id === kind.presetId);
      expect(preset, kind.key).toBeTruthy();
      expect(preset!.doc_type).toBe("attorney");
    }
  });

  it("шаблоны входят в каталог встроенных и имеют обязательные блоки", () => {
    for (const preset of ATTORNEY_PRESETS) {
      expect(PW_PRESETS.some((p) => p.id === preset.id)).toBe(true);
      const types = preset.blocks.map((b) => b.type);
      expect(missingBlocks("attorney", types)).toEqual([]);
    }
  });

  it("имена шаблонов уникальны — доустановка не создаёт дублей", () => {
    const names = PW_PRESETS.map((p) => p.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
