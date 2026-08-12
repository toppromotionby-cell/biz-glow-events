// Тесты чистых модулей редактора: история изменений и магнитные направляющие.
import { describe, expect, it } from "vitest";
import {
  canRedo, canUndo, createHistory, pushHistory, redoHistory, undoHistory, HISTORY_LIMIT,
} from "@/lib/editor/history";
import { snapRect, SNAP_TOLERANCE } from "@/lib/presentations/snap";
import { SLIDE_W } from "@/lib/presentations/design";

describe("история изменений", () => {
  it("отмена и повтор возвращают предыдущие состояния", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    expect(canUndo(h)).toBe(true);
    h = undoHistory(h);
    expect(h.present).toBe("b");
    h = undoHistory(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);
    h = redoHistory(h);
    expect(h.present).toBe("b");
    expect(canRedo(h)).toBe(true);
  });

  it("новый шаг после отмены очищает будущее", () => {
    let h = pushHistory(pushHistory(createHistory(1), 2), 3);
    h = undoHistory(h);
    h = pushHistory(h, 9);
    expect(h.present).toBe(9);
    expect(canRedo(h)).toBe(false);
  });

  it("глубина истории ограничена", () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) h = pushHistory(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });

  it("одинаковое состояние не создаёт шаг", () => {
    const h = pushHistory(createHistory("a"), "a");
    expect(canUndo(h)).toBe(false);
  });
});

describe("магнитные направляющие", () => {
  it("притягивает блок к центру холста", () => {
    const w = 200;
    const near = SLIDE_W / 2 - w / 2 + 4;
    const r = snapRect({ x: near, y: 300, w, h: 100 });
    expect(r.x).toBeCloseTo(SLIDE_W / 2 - w / 2);
    expect(r.guides.some((g) => g.axis === "x" && g.at === SLIDE_W / 2)).toBe(true);
  });

  it("не двигает блок вдали от направляющих", () => {
    const r = snapRect({ x: 137, y: 211, w: 90, h: 40 }, [], 4);
    expect(r.x).toBe(137);
    expect(r.y).toBe(211);
    expect(r.guides).toHaveLength(0);
  });

  it("выравнивает по краю соседнего блока", () => {
    const neighbor = { x: 400, y: 100, w: 200, h: 100 };
    const r = snapRect({ x: 400 + SNAP_TOLERANCE - 2, y: 400, w: 100, h: 50 }, [neighbor]);
    expect(r.x).toBe(400);
  });
});
