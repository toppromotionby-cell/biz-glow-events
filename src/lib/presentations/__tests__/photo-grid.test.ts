import { describe, expect, it } from "vitest";
import { MIN_FRAME_H, MIN_FRAME_W, photoFrames } from "@/lib/presentations/photo-grid";
import type { Rect } from "@/lib/presentations/design";

const LAND: Rect = { x: 64, y: 56, w: 1152, h: 560 };
const SIDE: Rect = { x: 0, y: 0, w: 460, h: 720 };
const EPS = 0.51;

const inside = (f: Rect, box: Rect) =>
  f.x >= box.x - EPS &&
  f.y >= box.y - EPS &&
  f.x + f.w <= box.x + box.w + EPS &&
  f.y + f.h <= box.y + box.h + EPS;

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && a.x + a.w - EPS > b.x && a.y < b.y + b.h - EPS && a.y + a.h - EPS > b.y;

describe("photoFrames", () => {
  for (const box of [LAND, SIDE]) {
    for (let n = 1; n <= 15; n++) {
      it(`даёт ${n} корректных кадров в области ${box.w}×${box.h}`, () => {
        const frames = photoFrames(box, n, { gap: 16 });
        expect(frames).toHaveLength(n);
        for (const f of frames) {
          expect(inside(f, box)).toBe(true);
          expect(f.w).toBeGreaterThan(0);
          expect(f.h).toBeGreaterThan(0);
        }
        for (let i = 0; i < frames.length; i++) {
          for (let j = i + 1; j < frames.length; j++) {
            expect(overlap(frames[i], frames[j])).toBe(false);
          }
        }
      });
    }
  }

  it("последний ряд добирается до правого края (нет дыр)", () => {
    for (let n = 6; n <= 15; n++) {
      const frames = photoFrames(LAND, n, { gap: 16 });
      const right = Math.max(...frames.map((f) => f.x + f.w));
      expect(right).toBeGreaterThan(LAND.x + LAND.w - 1);
      const bottom = Math.max(...frames.map((f) => f.y + f.h));
      expect(bottom).toBeGreaterThan(LAND.y + LAND.h - 1);
    }
  });

  it("кадры не мельчат ниже минимума на широкой области", () => {
    for (let n = 1; n <= 15; n++) {
      const frames = photoFrames(LAND, n, { gap: 16 });
      for (const f of frames) {
        expect(f.w).toBeGreaterThanOrEqual(MIN_FRAME_W);
        expect(f.h).toBeGreaterThanOrEqual(MIN_FRAME_H);
      }
    }
  });

  it("сохраняет исторические раскладки 1–5", () => {
    expect(photoFrames(LAND, 1)).toEqual([LAND]);
    const two = photoFrames(LAND, 2, { gap: 16 });
    expect(two[0].w).toBeCloseTo(two[1].w);
    expect(two[0].h).toBeCloseTo(LAND.h);
    const three = photoFrames(LAND, 3, { gap: 16 });
    expect(three[0].w).toBeGreaterThan(three[1].w); // герой слева
    const five = photoFrames(LAND, 5, { gap: 16 });
    expect(five[0].h).toBeCloseTo(LAND.h);
    expect(five).toHaveLength(5);
  });
});
