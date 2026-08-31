import { describe, expect, it } from "vitest";
import { routeTarget } from "@/lib/calendar/routing";

const meeting = { kind: "meeting" as const, starts_at: "2026-01-01T10:00:00Z", due_at: null };
const timedTask = { kind: "task" as const, starts_at: "2026-01-01T10:00:00Z", due_at: null };
const looseTask = { kind: "task" as const, starts_at: null, due_at: "2026-01-02T00:00:00Z" };

describe("маршрутизация записей", () => {
  it("встреча всегда идёт в календарь", () => {
    expect(routeTarget(meeting, "tasks")).toBe("calendar");
  });

  it("задача без времени — в Google Задачи", () => {
    expect(routeTarget(looseTask, "auto")).toBe("tasks");
    expect(routeTarget(looseTask, "calendar")).toBe("none");
  });

  it("задача со временем зависит от настройки", () => {
    expect(routeTarget(timedTask, "auto")).toBe("calendar");
    expect(routeTarget(timedTask, "tasks")).toBe("tasks");
    expect(routeTarget(timedTask, "both")).toBe("both");
  });
});
