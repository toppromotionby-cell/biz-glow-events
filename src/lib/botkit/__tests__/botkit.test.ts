import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUTTON_LABELS, commonRules, forgottenAck, LEARNED_ACK, stripFakeButtons } from "@/lib/botkit/format";
import { cardButtons, CARD_APPROVE, CARD_DROP, CARD_EDIT, renderCard, renderDecided } from "@/lib/botkit/cards";
import { detectForget, detectTeaching } from "@/lib/botkit/learn";
import { memoryPrompt, type MemoryRow } from "@/lib/botkit/memory.server";
import { visionMessages } from "@/lib/botkit/vision.server";
import { buildPersona } from "@/lib/calendar/persona";
import { systemPrompt } from "@/lib/assistant/persona";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("botkit: единые правила", () => {
  it("общий блок правил содержит формат, план, скриншоты и общее обучение", () => {
    const rules = commonRules();
    expect(rules).toContain("Telegram-HTML");
    expect(rules).toContain("План-режим");
    expect(rules).toContain("Скриншоты");
    expect(rules).toContain("общая память");
  });

  it("оба бота получают правило общего обучения", () => {
    const planner = buildPersona({
      prefs: { tz: "Europe/Minsk", tone: "friendly", owner_name: "Дмитрий" },
      dirs: [],
      now: new Date("2026-01-05T09:00:00Z"),
      channel: "telegram",
    });
    const assistant = systemPrompt({ isAdmin: true, roles: ["admin"], webSearch: true, planOnly: false });
    for (const prompt of [planner, assistant]) {
      expect(prompt).toContain("Общее обучение");
      expect(prompt).toContain("Второй бот тоже в курсе");
    }
  });

  it("голосовой канал не тащит telegram-разметку", () => {
    const voice = buildPersona({
      prefs: { tz: "Europe/Minsk", tone: "dry", owner_name: null },
      dirs: [],
      now: new Date(),
      channel: "voice",
    });
    expect(voice).not.toContain("Telegram-HTML");
  });
});

describe("botkit: карточки решений", () => {
  it("кнопки одинаковые и привязаны к номеру плана", () => {
    const [row] = cardButtons("plan-1");
    expect(row.map((b) => b.text)).toEqual([CARD_APPROVE, CARD_EDIT, CARD_DROP]);
    expect(row.every((b) => b.data.endsWith("plan-1"))).toBe(true);
  });

  it("в тексте карточки нет нарисованных кнопок", () => {
    const html = renderCard({
      id: "p1",
      title: "Разбор скриншота",
      summary: "Ошибка 500 на странице заказа.\nКнопки: ✅ Утвердить / ✏️ Правки / 🚫 Отменить",
      steps: [{ label: "Создать задачу на проверку", action: "create_item" }],
      questions: ["Какой номер заказа?"],
      risk: "Данные не меняю до утверждения",
    });
    for (const label of BUTTON_LABELS) {
      expect(new RegExp(`^\\s*[^\\p{L}\\n]*${label}`, "imu").test(html.replace("Решение — кнопками ниже.", ""))).toBe(false);
    }
    expect(html).toContain("Разбор скриншота");
  });

  it("после решения карточка фиксирует статус", () => {
    expect(renderDecided("Текст", "approved", "Готово")).toContain("Утверждено");
    expect(renderDecided("Текст", "rejected")).toContain("Удалено");
    expect(renderDecided("Текст", "editing")).toContain("правках");
  });

  it("stripFakeButtons не режет обычный текст", () => {
    expect(stripFakeButtons("Нужно утвердить смету у подрядчика до пятницы.")).toContain("утвердить смету");
  });
});

describe("botkit: обучение", () => {
  it("ловит устойчивые правила", () => {
    expect(detectTeaching("Запомни: планёрки по понедельникам в 10")?.kind).toBeDefined();
    expect(detectTeaching("всегда ставь встречи с запасом 15 минут")?.kind).toBe("rule");
    expect(detectTeaching("запомни: ЕХ это EventHub")).toMatchObject({ kind: "alias", key: "ЕХ" });
  });

  it("разовые просьбы в память не пишет", () => {
    expect(detectTeaching("покажи, что у меня завтра")).toBeNull();
    expect(detectTeaching("напомни позвонить в 15")).toBeNull();
    expect(detectTeaching("/today")).toBeNull();
  });

  it("понимает «забудь про …»", () => {
    expect(detectForget("забудь про планёрки")).toBe("планёрки");
    expect(detectForget("что там по планёркам?")).toBeNull();
  });

  it("подтверждения общие для двух ботов", () => {
    expect(LEARNED_ACK).toContain("Второй бот");
    expect(forgottenAck(2)).toContain("Второй бот");
    expect(forgottenAck(0)).toContain("не нашёл");
  });

  it("память попадает в промпт сгруппированно", () => {
    const rows = [
      { kind: "rule", key: "планёрки", value: "понедельник 10:00" },
      { kind: "alias", key: "ЕХ", value: "EventHub" },
    ] as MemoryRow[];
    const prompt = memoryPrompt(rows);
    expect(prompt).toContain("Правила общения и работы");
    expect(prompt).toContain("Сокращения и имена");
  });
});

describe("botkit: зрение у обоих ботов", () => {
  it("картинка и PDF уходят разными блоками", () => {
    const msgs = visionMessages({
      system: "s",
      question: "разбери",
      attachments: [
        { fileId: "1", mime: "image/png", base64: "AAA", bytes: 3 },
        { fileId: "2", mime: "application/pdf", base64: "BBB", bytes: 3, filename: "kp.pdf" },
      ],
    }) as Array<{ content: unknown }>;
    const content = JSON.stringify(msgs[1].content);
    expect(content).toContain("image_url");
    expect(content).toContain("file_data");
  });

  it("подсказку действий можно задать под конкретного бота", () => {
    const msgs = visionMessages({ system: "s", question: "q", attachments: [], actions: "ТОЛЬКО create_item" }) as Array<{
      content: Array<{ text?: string }>;
    }>;
    expect(msgs[1].content[0].text).toContain("ТОЛЬКО create_item");
  });

  it("оба вебхука принимают фото и документы", () => {
    const planner = read("src/routes/api/public/planner/telegram.ts");
    expect(planner).toContain("handleTelegramMedia");
    expect(planner).toContain("photo");
    expect(planner).toContain("document");
  });

  it("память планера и помощника — один и тот же слой", () => {
    expect(read("src/lib/calendar/memory.server.ts")).toContain("@/lib/botkit/memory.server");
    expect(read("src/lib/assistant/agent.server.ts")).toContain("@/lib/botkit/memory.server");
  });
});
