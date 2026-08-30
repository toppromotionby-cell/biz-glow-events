import { describe, expect, it } from "vitest";
import { PW_PRESETS } from "@/lib/paperwork/preset-templates";
import { ORDER_PRESETS } from "@/lib/paperwork/order-presets";
import {
  ORDER_KINDS,
  ORDER_KIND_MAP,
  daysBetween,
  orderBlocks,
  orderPresetId,
  ru,
  ruLong,
} from "@/lib/paperwork/orders/registry";

describe("реестр приказов", () => {
  it("коды видов уникальны и все зарегистрированы", () => {
    const codes = ORDER_KINDS.map((k) => k.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const k of ORDER_KINDS) expect(ORDER_KIND_MAP[k.code]).toBe(k);
  });

  it("каждый вид даёт шаблон в общем каталоге", () => {
    for (const k of ORDER_KINDS) {
      expect(PW_PRESETS.some((p) => p.id === orderPresetId(k.code))).toBe(true);
    }
    const names = PW_PRESETS.map((p) => p.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("шаблон приказа содержит заголовок, текст, подпись и ознакомление", () => {
    for (const preset of ORDER_PRESETS) {
      const types = preset.blocks.map((b) => b.type);
      expect(types).toContain("heading");
      expect(types).toContain("signature");
      const text = preset.blocks.map((b) => b.text ?? "").join("\n");
      expect(text).toContain("{{Текст приказа}}");
      expect(text).toContain("{{Ознакомлен}}");
    }
  });

  it("форматирование дат и подсчёт дней", () => {
    expect(ru("2026-03-06")).toBe("06.03.2026");
    expect(ruLong("2026-03-06")).toBe("06 марта 2026 г.");
    expect(daysBetween("2026-03-01", "2026-03-14")).toBe(14);
    expect(daysBetween("2026-03-14", "2026-03-01")).toBe(0);
  });

  it("отпуск: текст собирается с падежами и числом дней", () => {
    const kind = ORDER_KIND_MAP["vac-annual"]!;
    const values = kind.buildValues({
      people: [{ fullName: "Иванова Мария Петровна", position: "менеджер проектов" }],
      from: "2026-07-01",
      to: "2026-07-14",
    });
    expect(values["Текст приказа"]).toContain("01.07.2026");
    expect(values["Текст приказа"]).toContain("14.07.2026");
    expect(values["Текст приказа"]).toMatch(/14 \(четырнадцать\) календарных дней/i);
    expect(values["Ознакомлен"]).toBe("М.П. Иванова");
  });

  it("приём на работу: подставляются срок и оклад", () => {
    const kind = ORDER_KIND_MAP["hire"]!;
    const values = kind.buildValues({
      people: [{ fullName: "Петров Иван Сергеевич", position: "водитель" }],
      startDate: "2026-01-12",
      rate: "0,5",
      termYears: "2",
      to: "2028-01-11",
      partTime: "да",
    });
    expect(values["Текст приказа"]).toContain("0,5 ставки");
    expect(values["Текст приказа"]).toContain("12.01.2026");
    expect(values["Текст приказа"]).toMatch(/сроком на 2 \(два\) года/i);
  });

  it("блоки генерируются для каждого вида без пустого заголовка", () => {
    for (const kind of ORDER_KINDS) {
      const blocks = orderBlocks(kind);
      expect(blocks[0]?.type).toBe("heading");
      expect((blocks[0]?.text ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});
