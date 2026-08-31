/**
 * Гард Telegram: любой текст/подпись, отправляемый с parse_mode: "HTML",
 * обязан пройти через sanitizeTgHtml — иначе в чат утекают сырые теги
 * или Telegram отклоняет сообщение целиком.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasVisibleTgTags, mdToTgHtml, sanitizeTgHtml, splitTgText, toTgHtml } from "@/lib/calendar/tg-format";

const TRANSPORTS = [
  "src/lib/calendar/telegram.server.ts",
  "src/lib/assistant/transport.server.ts",
  "src/lib/dj/telegram/transport.server.ts",
];

describe("telegram: форматирование сообщений", () => {
  it("каждый транспорт санитизирует текст и подписи", () => {
    const bad: string[] = [];
    for (const f of TRANSPORTS) {
      const src = readFileSync(f, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        const m = /^\s*(text|caption):\s*(.+?),?\s*$/.exec(line);
        if (!m) return;
        // Учитываем только объекты, отправляемые как HTML.
        const around = lines.slice(i, i + 6).join("\n");
        if (!/parse_mode:\s*"HTML"/.test(around)) return;
        const value = m[2] as string;
        if (/sanitizeTgHtml|toTgHtml|chunks\[/.test(value)) return;
        if (value === "undefined") return;
        bad.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("sanitizeTgHtml оставляет разрешённые теги и экранирует остальные", () => {
    const out = sanitizeTgHtml('<b>Заявка</b> <div>x</div> <a href="https://x.by">ссылка</a>');
    expect(out).toContain("<b>Заявка</b>");
    expect(out).toContain('<a href="https://x.by">ссылка</a>');
    expect(out).not.toContain("<div>");
    expect(out).toContain("&lt;div&gt;");
  });

  it("markdown из модели превращается в HTML без утечки тегов", () => {
    const out = toTgHtml("**Итог:** 3 задачи\n- пункт `код`");
    expect(out).toContain("<b>Итог:</b>");
    expect(hasVisibleTgTags(out)).toBe(false);
    expect(hasVisibleTgTags("Текст &lt;b&gt;жирный&lt;/b&gt;")).toBe(true);
  });

  it("mdToTgHtml не ломает уже готовый HTML", () => {
    expect(hasVisibleTgTags(mdToTgHtml("<b>Готово</b> — 5 ✅"))).toBe(false);
  });

  it("длинные ответы режутся на части в пределах лимита", () => {
    const parts = splitTgText("а".repeat(9000));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(4096);
  });
});
