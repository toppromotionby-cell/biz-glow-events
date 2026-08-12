// Регрессия: серверные валидаторы обязаны принимать все шаблоны, статусы и
// типы слайдов, которые показывает интерфейс.
import { describe, expect, it } from "vitest";
import {
  PRESENTATION_TEMPLATES, PRESENTATION_STATUSES, SLIDE_TYPES,
  TEMPLATE_LABELS, STATUS_LABELS, SLIDE_TYPE_LABELS,
} from "@/lib/presentations/model";

describe("presentations: списки значений", () => {
  it("подписи шаблонов покрывают все шаблоны", () => {
    expect(Object.keys(TEMPLATE_LABELS).sort()).toEqual([...PRESENTATION_TEMPLATES].sort());
  });
  it("подписи статусов покрывают все статусы", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...PRESENTATION_STATUSES].sort());
  });
  it("подписи типов слайдов покрывают все типы", () => {
    expect(Object.keys(SLIDE_TYPE_LABELS).sort()).toEqual([...SLIDE_TYPES].sort());
  });
  it("серверная схема сохранения принимает каждый шаблон", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/presentations.functions.ts", "utf8"));
    expect(src).not.toMatch(/z\.enum\(\["light"/);
    expect(src).toContain("z.enum(PRESENTATION_TEMPLATES)");
  });
});
