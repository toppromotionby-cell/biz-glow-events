import { describe, expect, it } from "vitest";
import { auditPresentation } from "@/lib/presentations/audit";
import { emptySlide } from "@/lib/presentations/model";

function slide(patch: Record<string, unknown> = {}) {
  const s = emptySlide();
  return { ...s, ...patch } as ReturnType<typeof emptySlide>;
}

describe("auditPresentation", () => {
  it("не находит проблем на пустом наборе", () => {
    expect(auditPresentation([]).issues).toEqual([]);
  });

  it("сообщает об отсутствии заголовка", () => {
    const r = auditPresentation([slide({ title: "", is_visible: true })]);
    expect(r.issues.some((i) => i.block === "title")).toBe(true);
  });

  it("ругается на очень длинный текст", () => {
    const long = "Очень длинное описание позиции. ".repeat(120);
    const s = slide({ title: "Сцена", is_visible: true });
    s.content = { ...s.content, description: long };
    const r = auditPresentation([s]);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("не учитывает скрытые слайды", () => {
    const r = auditPresentation([slide({ title: "", is_visible: false })]);
    expect(r.issues).toEqual([]);
  });
});
