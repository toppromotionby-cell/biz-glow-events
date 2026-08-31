import { describe, expect, it } from "vitest";
import { detectIntent, plural } from "@/lib/calendar/assistant.server";
import { dayRange, parseDayToken } from "@/lib/calendar/when";
import { plainText, speechText } from "@/lib/calendar/outbox.server";

const TZ = "Europe/Minsk";
const NOW = new Date("2026-03-10T09:00:00Z"); // вторник

describe("detectIntent", () => {
  it("распознаёт запросы на чтение", () => {
    expect(detectIntent("что сегодня?", TZ, NOW)).toMatchObject({ type: "list", scope: "today" });
    expect(detectIntent("что на завтра", TZ, NOW)).toMatchObject({ type: "list", scope: "tomorrow" });
    expect(detectIntent("что на неделе", TZ, NOW)).toMatchObject({ type: "list", scope: "week" });
    expect(detectIntent("что просрочено", TZ, NOW)).toMatchObject({ type: "list", scope: "overdue" });
  });

  it("распознаёт день, поиск, закрытие и создание", () => {
    expect(detectIntent("что 15.03", TZ, NOW).type).toBe("day");
    expect(detectIntent("найди подрядчика", TZ, NOW)).toMatchObject({ type: "find", query: "подрядчика" });
    expect(detectIntent("отметь встречу с подрядчиком", TZ, NOW)).toMatchObject({ type: "done" });
    expect(detectIntent("что нового", TZ, NOW).type).toBe("news");
    expect(detectIntent("завтра в 15 встреча по EventHub", TZ, NOW).type).toBe("create");
    expect(detectIntent("", TZ, NOW).type).toBe("help");
  });
});

describe("when", () => {
  it("считает границы суток в локальной таймзоне", () => {
    const { from, to } = dayRange(NOW, TZ);
    expect(from.toISOString()).toBe("2026-03-09T21:00:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(86_400_000);
  });

  it("разбирает относительные дни и даты", () => {
    expect(parseDayToken("завтра", TZ, NOW)?.toISOString()).toBe("2026-03-10T21:00:00.000Z");
    expect(parseDayToken("15.03", TZ, NOW)?.toISOString()).toBe("2026-03-14T21:00:00.000Z");
    expect(parseDayToken("абракадабра", TZ, NOW)).toBeNull();
  });
});

describe("текст для озвучки", () => {
  it("чистит HTML и эмодзи", () => {
    expect(plainText("<b>Встреча</b><br/>в 15:00")).toBe("Встреча\nв 15:00");
    expect(speechText("⏰ Через 15 мин: <b>Созвон</b>")).toBe("Через 15 мин: Созвон");
  });

  it("склоняет числительные", () => {
    expect([1, 2, 5, 11, 21].map((n) => plural(n, "запись", "записи", "записей"))).toEqual([
      "запись",
      "записи",
      "записей",
      "записей",
      "запись",
    ]);
  });
});
