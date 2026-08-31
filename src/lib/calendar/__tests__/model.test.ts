// Регрессионные тесты модели планера: эвристики разбора, приоритеты, слоты, таймзоны.
import { describe, expect, it } from "vitest";
import {
  detectImportance,
  fmtWhen,
  freeSlots,
  guessDirection,
  guessKind,
  isOverdue,
  localDay,
  localHm,
  overlaps,
  priorityScore,
  type CalDirection,
  type CalItem,
} from "@/lib/calendar/model";

const dirs: CalDirection[] = [
  {
    id: "d1",
    key: "eventhub",
    title: "EventHub",
    color: "#f00",
    google_color_id: null,
    emoji: null,
    keywords: ["ивент", "eventhub", "подрядчик"],
    work_start: "09:00",
    work_end: "19:00",
    sort: 0,
    active: true,
  },
  {
    id: "d2",
    key: "belight",
    title: "Belight",
    color: "#0f0",
    google_color_id: null,
    emoji: null,
    keywords: ["belight", "свет"],
    work_start: "10:00",
    work_end: "18:00",
    sort: 1,
    active: true,
  },
];

function item(patch: Partial<CalItem>): CalItem {
  return {
    id: "i1",
    kind: "task",
    title: "Тест",
    notes: null,
    direction_id: null,
    starts_at: null,
    ends_at: null,
    due_at: null,
    all_day: false,
    tz: "Europe/Minsk",
    status: "planned",
    importance: "normal",
    location: null,
    participants: [],
    source: "web",
    google_event_id: null,
    google_task_id: null,
    reschedule_count: 0,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch,
  };
}

describe("разбор фраз (эвристики)", () => {
  it("определяет встречу и задачу", () => {
    expect(guessKind("встреча с подрядчиком завтра")).toBe("meeting");
    expect(guessKind("созвон с клиентом")).toBe("meeting");
    expect(guessKind("сделать смету по объекту")).toBe("task");
    expect(guessKind("подготовить и отправить договор")).toBe("task");
  });

  it("определяет жёсткость по маркерам", () => {
    expect(detectImportance("жёсткая встреча в 15:00")).toBe("hard");
    expect(detectImportance("это нельзя перенести")).toBe("hard");
    expect(detectImportance("обычный звонок")).toBe("normal");
  });

  it("подбирает направление по ключевым словам", () => {
    expect(guessDirection("встреча с подрядчиком по EventHub", dirs)?.key).toBe("eventhub");
    expect(guessDirection("смета по belight", dirs)?.key).toBe("belight");
    expect(guessDirection("купить молоко", dirs)).toBeNull();
  });

  it("неактивное направление не подбирается", () => {
    const inactive = dirs.map((d) => ({ ...d, active: false }));
    expect(guessDirection("встреча по eventhub", inactive)).toBeNull();
  });
});

describe("приоритеты", () => {
  const now = new Date("2026-08-31T09:00:00Z");
  it("просроченное выше обычного", () => {
    const overdue = priorityScore(item({ due_at: "2026-08-30T09:00:00Z" }), now);
    const future = priorityScore(item({ due_at: "2026-09-05T09:00:00Z" }), now);
    expect(overdue).toBeGreaterThan(future);
  });
  it("жёсткая важнее обычной при равном сроке", () => {
    const due = "2026-09-01T09:00:00Z";
    expect(priorityScore(item({ due_at: due, importance: "hard" }), now)).toBeGreaterThan(
      priorityScore(item({ due_at: due }), now),
    );
  });
  it("частые переносы поднимают приоритет", () => {
    const due = "2026-09-01T09:00:00Z";
    expect(priorityScore(item({ due_at: due, reschedule_count: 4 }), now)).toBeGreaterThan(
      priorityScore(item({ due_at: due }), now),
    );
  });
});

describe("время и таймзоны", () => {
  it("isOverdue не считает выполненное просроченным", () => {
    const past = "2026-08-30T09:00:00Z";
    expect(isOverdue(item({ due_at: past }), new Date("2026-08-31T09:00:00Z"))).toBe(true);
    expect(isOverdue(item({ due_at: past, status: "done" }), new Date("2026-08-31T09:00:00Z"))).toBe(false);
    expect(isOverdue(item({ due_at: past, status: "canceled" }), new Date("2026-08-31T09:00:00Z"))).toBe(false);
  });
  it("localHm/localDay уважают таймзону (переход через полночь)", () => {
    const d = new Date("2026-08-31T22:30:00Z"); // в Минске уже 01:30 1 сентября
    expect(localHm(d, "Europe/Minsk")).toBe("01:30");
    expect(localDay(d, "Europe/Minsk")).toBe("2026-09-01");
    expect(localDay(d, "UTC")).toBe("2026-08-31");
  });
  it("fmtWhen показывает дедлайн без времени начала", () => {
    const s = fmtWhen(item({ due_at: "2026-09-01T12:00:00Z" }), "Europe/Minsk");
    expect(s).toContain("до");
  });
});

describe("накладки и свободные слоты", () => {
  it("overlaps ловит пересечения", () => {
    const a = item({ starts_at: "2026-09-01T10:00:00Z", ends_at: "2026-09-01T11:00:00Z" });
    const b = item({ starts_at: "2026-09-01T10:30:00Z", ends_at: "2026-09-01T11:30:00Z" });
    const c = item({ starts_at: "2026-09-01T12:00:00Z", ends_at: "2026-09-01T13:00:00Z" });
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false);
  });
  it("freeSlots не предлагает занятое время и держится рабочих часов", () => {
    const busy = [
      item({ starts_at: "2026-09-01T09:00:00Z", ends_at: "2026-09-01T12:00:00Z" }),
      item({ starts_at: "2026-09-01T14:00:00Z", ends_at: "2026-09-01T19:00:00Z" }),
    ];
    const slots = freeSlots(busy, {
      from: new Date("2026-09-01T06:00:00Z"), // 09:00 в Минске
      days: 1,
      durationMin: 60,
      tz: "Europe/Minsk",
      workStart: "09:00",
      workEnd: "19:00",
      limit: 3,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const hm = localHm(s, "Europe/Minsk");
      expect(hm >= "09:00").toBe(true);
      expect(hm < "19:00").toBe(true);
      // Единственное свободное окно — 12:00–14:00.
      expect(hm >= "12:00" && hm < "14:00").toBe(true);
    }
  });
  it("отменённые записи не блокируют слоты", () => {
    const busy = [item({ starts_at: "2026-09-01T09:00:00Z", ends_at: "2026-09-01T19:00:00Z", status: "canceled" })];
    const slots = freeSlots(busy, {
      from: new Date("2026-09-01T06:00:00Z"),
      days: 1,
      durationMin: 30,
      tz: "Europe/Minsk",
      workStart: "09:00",
      workEnd: "19:00",
      limit: 1,
    });
    expect(slots.length).toBe(1);
  });
});
