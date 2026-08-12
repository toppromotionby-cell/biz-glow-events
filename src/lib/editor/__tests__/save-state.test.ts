import { describe, expect, it } from "vitest";
import { AUTOSAVE_DELAY, saveStatus, shouldWarnOnLeave } from "@/lib/editor/save-state";

describe("save-state", () => {
  it("одинаковая задержка автосохранения во всех редакторах", () => {
    expect(AUTOSAVE_DELAY).toBe(1200);
  });

  it("показывает время последнего сохранения", () => {
    const at = new Date(2026, 0, 1, 9, 5);
    expect(saveStatus("saved", at)).toEqual({ text: "Сохранено в 09:05", tone: "ok" });
  });

  it("сообщает об ошибке сохранения", () => {
    expect(saveStatus("error", null, "нет связи")).toEqual({
      text: "Не сохранено: нет связи",
      tone: "error",
    });
  });

  it("подсвечивает несохранённые правки", () => {
    expect(saveStatus("dirty", null).tone).toBe("pending");
    expect(saveStatus("saving", null).text).toBe("Сохраняем…");
    expect(saveStatus("idle", null).tone).toBe("muted");
  });

  it("предупреждает об уходе только при риске потери правок", () => {
    expect(shouldWarnOnLeave("dirty")).toBe(true);
    expect(shouldWarnOnLeave("saving")).toBe(true);
    expect(shouldWarnOnLeave("error")).toBe(true);
    expect(shouldWarnOnLeave("saved")).toBe(false);
    expect(shouldWarnOnLeave("idle")).toBe(false);
  });
});
