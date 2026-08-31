import { describe, expect, it } from "vitest";
import { decodeCb, encodeCb, esc, helpText, table, trackCard } from "./cards";

describe("dj telegram cards", () => {
  it("кодирует и декодирует callback в пределах лимита Telegram", () => {
    const cbs = [
      { action: "trk", op: "pub", id: "3f4b1a2c-1111-2222-3333-444455556666" },
      { action: "mem", status: "approved", id: "3f4b1a2c-1111-2222-3333-444455556666" },
    ] as const;
    for (const cb of cbs) {
      const raw = encodeCb(cb);
      expect(raw.length).toBeLessThanOrEqual(64);
      expect(decodeCb(raw)).toEqual(cb);
    }
  });

  it("не падает на мусорном callback", () => {
    expect(decodeCb("")).toBeNull();
    expect(decodeCb("абра-кадабра")).toBeNull();
  });

  it("экранирует HTML в карточках", () => {
    const card = trackCard({
      id: "1",
      artist: "<b>Hack</b>",
      title: "A & B",
      version: "Оригинал",
      status: "pending",
    } as never);
    expect(card).toContain("&lt;b&gt;Hack&lt;/b&gt;");
    expect(card).toContain("A &amp; B");
  });

  it("esc обрабатывает пустые значения", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("таблица моноширинная и не пустая", () => {
    const t = table(["A", "B"], [["1", "2"]]);
    expect(t).toContain("<pre>");
    expect(t).toContain("1");
  });

  it("подсказка зависит от роли", () => {
    expect(helpText("guest")).not.toContain("/queue");
    expect(helpText("admin")).toContain("/queue");
  });
});
