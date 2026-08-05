import { describe, expect, it } from "vitest";
import { normalizeTime, quotePatchSchema } from "@/lib/quotes-model";
import { friendlyZodMessage } from "@/lib/admin/zod-message";

describe("normalizeTime", () => {
  it("приводит к ЧЧ:ММ", () => {
    expect(normalizeTime("18:00:00")).toBe("18:00");
    expect(normalizeTime("1800")).toBe("18:00");
    expect(normalizeTime("18.00")).toBe("18:00");
    expect(normalizeTime("9:5")).toBe("09:05");
    expect(normalizeTime("")).toBe("");
    expect(normalizeTime(null)).toBe("");
  });
  it("не ломает мусор", () => {
    expect(normalizeTime("вечер")).toBe("вечер");
  });
});

describe("quotePatchSchema время", () => {
  it("принимает секунды и слитный формат", () => {
    expect(quotePatchSchema.parse({ event_time_end: "23:00:00" }).event_time_end).toBe("23:00");
    expect(quotePatchSchema.parse({ event_time_start: "1830" }).event_time_start).toBe("18:30");
  });
  it("отклоняет некорректное", () => {
    expect(quotePatchSchema.safeParse({ event_time_end: "99:99" }).success).toBe(false);
  });
});

describe("friendlyZodMessage", () => {
  it("превращает JSON в человеческий текст", () => {
    const raw = '[ { "code": "custom", "message": "укажите в формате ЧЧ:ММ", "path": [ "patch", "event_time_end" ] } ]';
    expect(friendlyZodMessage(raw)).toBe("Время окончания: укажите в формате ЧЧ:ММ");
  });
  it("оставляет обычный текст", () => {
    expect(friendlyZodMessage(new Error("Нет сети"))).toBe("Нет сети");
  });
});
