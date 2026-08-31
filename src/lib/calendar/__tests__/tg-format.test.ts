import { describe, expect, it } from "vitest";
import {
  hasVisibleTgTags,
  mdToTgHtml,
  sanitizeTgHtml,
  splitTgText,
  syncFooter,
  toTgHtml,
} from "@/lib/calendar/tg-format";

describe("tg-format", () => {
  it("переводит markdown в безопасный HTML", () => {
    expect(mdToTgHtml("**Важно** и *курсив*")).toContain("<b>Важно</b>");
    expect(toTgHtml("5 < 7 & 8 > 2")).not.toContain("<7");
  });

  it("экранирует неподдерживаемые теги, сохраняя разрешённые", () => {
    expect(sanitizeTgHtml("<div><b>ок</b></div>")).toBe("&lt;div&gt;<b>ок</b>&lt;/div&gt;");
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

  it("сохраняет готовые теги модели, а не показывает их текстом", () => {
    const out = toTgHtml("<b>Встречи:</b>\n• 14:00 Белтелеком");
    expect(out).toContain("<b>Встречи:</b>");
    expect(hasVisibleTgTags(out)).toBe(false);
  });

  it("не даёт двойного экранирования при смешанной разметке", () => {
    const out = toTgHtml("<b>Итог</b> и **важно** и 5 < 7 и <script>x</script>");
    expect(out).toContain("<b>Итог</b>");
    expect(out).toContain("<b>важно</b>");
    expect(out).toContain("&lt;script&gt;");
    expect(hasVisibleTgTags(out)).toBe(false);
  });

  it("закрывает незакрытые теги", () => {
    const out = toTgHtml("<b>Задачи");
    expect(out.endsWith("</b>")).toBe(true);
  });
});
