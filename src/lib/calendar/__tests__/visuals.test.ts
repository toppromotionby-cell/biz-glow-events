import { describe, expect, it } from "vitest";
import { dayTimelineUrl, itemsTable, renderTable, weekLoadUrl } from "@/lib/calendar/visuals";
import type { CalDirection, CalItem } from "@/lib/calendar/model";

const dirs: CalDirection[] = [
  { id: "d1", key: "eventhub", title: "EventHub", color: "#10b981", emoji: "🎪" } as unknown as CalDirection,
];

function item(over: Partial<CalItem>): CalItem {
  return {
    id: "i1",
    kind: "meeting",
    title: "Встреча с подрядчиком",
    notes: null,
    direction_id: "d1",
    starts_at: "2026-09-01T09:00:00.000Z",
    ends_at: "2026-09-01T10:00:00.000Z",
    due_at: null,
    all_day: false,
    status: "planned",
    importance: "normal",
    location: null,
    reschedule_count: 0,
    google_event_id: null,
    ...over,
  } as unknown as CalItem;
}

describe("visuals", () => {
  it("строит URL таймлайна для записей со временем", () => {
    const url = dayTimelineUrl("Сегодня", [item({})], dirs, "Europe/Minsk");
    expect(url).toContain("quickchart.io/chart");
    expect(url).toContain("horizontalBar");
  });

  it("не строит таймлайн, когда времени нет", () => {
    expect(dayTimelineUrl("Сегодня", [item({ starts_at: null, all_day: true })], dirs, "Europe/Minsk")).toBeNull();
  });

  it("строит график недели по дням", () => {
    const url = weekLoadUrl("Неделя", [item({}), item({ id: "i2", starts_at: "2026-09-02T09:00:00.000Z" })], dirs, "Europe/Minsk");
    expect(url).toContain("stacked");
  });

  it("таблица экранирует HTML и выравнивает колонки", () => {
    const t = renderTable(["A", "B"], [["<b>x</b>", "y"]]);
    expect(t.startsWith("<pre>")).toBe(true);
    expect(t).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("таблица записей содержит название и тип", () => {
    const t = itemsTable([item({})], dirs, "Europe/Minsk");
    expect(t).toContain("встреча");
    expect(t).toContain("Встреча с подрядчиком");
  });
});
