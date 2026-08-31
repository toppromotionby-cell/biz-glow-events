import { describe, expect, it } from "vitest";
import { mdToTgHtml, sanitizeTgHtml, splitTgText, syncFooter, toTgHtml } from "@/lib/calendar/tg-format";

describe("tg-format", () => {
  it("переводит markdown в безопасный HTML", () => {
    expect(mdToTgHtml("**Важно** и *курсив*")).toContain("<b>Важно</b>");
    expect(toTgHtml("5 < 7 & 8 > 2")).not.toContain("<7");
  });

  it("вырезает неподдерживаемые теги", () => {
    expect(sanitizeTgHtml("<div><b>ок</b></div>")).toBe("<b>ок</b>");
  });

  it("делит длинный текст на части", () => {
    const parts = splitTgText("строка\n".repeat(2000));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(3500);
  });

  it("строит строку синхронизации", () => {
    const s = syncFooter([{ target: "calendar", state: "ok" }]);
    expect(s).toContain("Календар");
  });
});
