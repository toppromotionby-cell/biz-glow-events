import { describe, expect, it } from "vitest";

import { DOC_PAGE_H, DOC_PAGE_W, fitScale } from "../fit-scale";

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
