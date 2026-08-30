import { describe, expect, it } from "vitest";

import { DOC_PAGE_H, DOC_PAGE_W, fitScale, visibleWidth } from "../fit-scale";

describe("fitScale", () => {
  it("вписывает лист по ширине узкой панели — лист не обрезается", () => {
    const { scale } = fitScale({ boxW: 540, boxH: 800 });
    expect(scale).toBeLessThan(1);
    expect(DOC_PAGE_W * scale).toBeLessThanOrEqual(540);
  });

  it("режим «страница целиком» помещает всю страницу по высоте", () => {
    const { scale } = fitScale({ boxW: 1200, boxH: 600, mode: "page" });
    expect(DOC_PAGE_H * scale).toBeLessThanOrEqual(600);
  });

  it("учитывает длинный документ при режиме «страница целиком»", () => {
    const tall = fitScale({ boxW: 1200, boxH: 600, sheetH: DOC_PAGE_H * 3, mode: "page" });
    const one = fitScale({ boxW: 1200, boxH: 600, mode: "page" });
    expect(tall.scale).toBeLessThan(one.scale);
  });

  it("применяет пользовательский зум поверх «вписать»", () => {
    const a = fitScale({ boxW: 900, boxH: 900 });
    const b = fitScale({ boxW: 900, boxH: 900, zoom: 2 });
    expect(b.scale).toBeCloseTo(a.scale * 2, 5);
  });
});

describe("fitScale — широкое содержимое", () => {
  it("уменьшает лист, если содержимое шире A4 (иначе обрезалось бы справа)", () => {
    const wide = fitScale({ boxW: 600, boxH: 800, sheetW: DOC_PAGE_W * 1.5 });
    expect(DOC_PAGE_W * 1.5 * wide.scale).toBeLessThanOrEqual(600);
  });

  it("масштабированный лист никогда не шире области просмотра", () => {
    for (const boxW of [320, 480, 540, 900, 1440]) {
      for (const sheetW of [DOC_PAGE_W, 900, 1200]) {
        const { scale } = fitScale({ boxW, boxH: 900, sheetW, pad: 16 });
        expect(sheetW * scale).toBeLessThanOrEqual(boxW);
      }
    }
  });
});

describe("fitScale — потолок увеличения (maxBase)", () => {
  it("не увеличивает лист сверх натуральной величины в режиме «по ширине»", () => {
    const { scale } = fitScale({ boxW: 1600, boxH: 1200, pad: 16, maxBase: 1 });
    expect(scale).toBeLessThanOrEqual(1);
  });

  it("ручной зум по-прежнему работает поверх потолка", () => {
    const { scale } = fitScale({ boxW: 1600, boxH: 1200, pad: 16, maxBase: 1, zoom: 1.5 });
    expect(scale).toBeCloseTo(1.5, 5);
  });

  it("нет петли обратной связи: раздутая ширина области не увеличивает лист", () => {
    const normal = fitScale({ boxW: 540, boxH: 900, pad: 16, maxBase: 1 });
    const inflated = fitScale({ boxW: 540 * 3, boxH: 900, pad: 16, maxBase: 1 });
    expect(inflated.scale).toBeLessThanOrEqual(1);
    expect(DOC_PAGE_W * normal.scale).toBeLessThanOrEqual(540);
  });
});

describe("visibleWidth — реально видимая ширина панели", () => {
  it("обрезка родителем с overflow:hidden уменьшает измерение", () => {
    // Панель «заявляет» 540 px, но родитель показывает только 350.
    const w = visibleWidth({
      clientWidth: 540,
      left: 0,
      right: 540,
      viewportWidth: 1440,
      clipLeft: 0,
      clipRight: 350,
    });
    expect(w).toBe(350);
    expect(DOC_PAGE_W * fitScale({ boxW: w, boxH: 800, pad: 16, maxBase: 1 }).scale).toBeLessThanOrEqual(w);
  });

  it("панель, вылезшая за окно, меряется по видимой части", () => {
    expect(visibleWidth({ clientWidth: 800, left: 600, right: 1400, viewportWidth: 1000 })).toBe(400);
  });

  it("нормальный случай не меняет измерение", () => {
    expect(visibleWidth({ clientWidth: 520, left: 40, right: 560, viewportWidth: 1440 })).toBe(520);
  });

  it("лист никогда не шире видимой области при любых расхождениях", () => {
    for (const clip of [280, 350, 520, 900]) {
      const w = visibleWidth({ clientWidth: 1200, left: 0, right: 1200, viewportWidth: 1440, clipRight: clip });
      const { scale } = fitScale({ boxW: Math.max(220, w), boxH: 800, pad: 16, maxBase: 1 });
      expect(DOC_PAGE_W * scale).toBeLessThanOrEqual(Math.max(220, w));
    }
  });
});

