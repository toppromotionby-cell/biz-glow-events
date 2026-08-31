import { describe, expect, it } from "vitest";
import { helpText, refusal, systemPrompt } from "@/lib/assistant/persona";
import { splitText, esc } from "@/lib/assistant/transport.server";
import { similarity } from "@/lib/knowledge/facts.server";
import { renderReport, RULES } from "@/lib/hygiene/engine.server";
import { assistantWebhookSecret } from "@/routes/api/public/assistant/webhook";

describe("роль помощника", () => {
  it("зашивает границы и формат в системный промпт", () => {
    const p = systemPrompt({ isAdmin: false, roles: ["manager"], webSearch: true, planOnly: false });
    expect(p).toContain("НЕ выдумывае");
    expect(p).toContain("Telegram-HTML");
    expect(p).toContain("не администратор");
    expect(p).toContain("Интернет-поиск разрешён");
  });

  it("сообщает об отключённом поиске и строгом режиме", () => {
    const p = systemPrompt({ isAdmin: true, roles: ["admin"], webSearch: false, planOnly: true });
    expect(p).toContain("ОТКЛЮЧЁН");
    expect(p).toContain("строгий режим");
    expect(p).toContain("доступны внутренние данные");
  });

  it("для непривязанного чата даёт инструкцию по привязке, а не список команд", () => {
    expect(helpText("guest")).toContain("код");
    expect(helpText("guest")).not.toContain("/hygiene");
    expect(helpText("admin")).toContain("/hygiene");
  });

  it("отказ всегда объясняет, что бот умеет", () => {
    expect(refusal("Нет прав")).toContain("/help");
  });
});

describe("транспорт", () => {
  it("режет длинный текст под лимит Telegram", () => {
    const chunks = splitText("строка\n".repeat(2000));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(3800);
  });

  it("экранирует HTML", () => {
    expect(esc('<b>&"')).toBe('&lt;b&gt;&amp;"');
  });
});

describe("база знаний", () => {
  it("узнаёт дубликаты по общим словам", () => {
    expect(similarity("Скидка постоянным клиентам 10 процентов", "Скидка постоянным клиентам десять процентов")).toBeGreaterThan(
      0.5,
    );
    expect(similarity("Реквизиты BeLight", "Тайминг свадебного вечера")).toBeLessThan(0.3);
  });
});

describe("гигиена данных", () => {
  it("все правила имеют уникальный ключ и область", () => {
    const keys = RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of RULES) expect(r.area).toBeTruthy();
  });

  it("отчёт читается человеком", () => {
    const text = renderReport({
      ranAt: new Date().toISOString(),
      autoFixed: 2,
      needsReview: 1,
      byArea: { knowledge: 3 },
      top: [{ title: "Дубликат факта", severity: "warn", area: "knowledge" }],
      errors: [],
    });
    expect(text).toContain("Гигиена данных");
    expect(text).toContain("Дубликат факта");
  });
});

describe("вебхук", () => {
  it("секрет детерминирован и не равен ключу", () => {
    const a = assistantWebhookSecret("key-1");
    expect(a).toBe(assistantWebhookSecret("key-1"));
    expect(a).not.toBe(assistantWebhookSecret("key-2"));
    expect(a).not.toContain("key-1");
  });
});
