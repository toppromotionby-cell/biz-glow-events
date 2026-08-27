import { describe, expect, it } from "vitest";

import { DEFAULT_BLANK, type PwBlock } from "../model";
import {
  availableHeightPt,
  estimateContentHeightPt,
  fittedBlank,
  MIN_FIT_K,
  MIN_FONT_PT,
  pickFitFactor,
  shrinkBlank,
} from "../fit-page";

const para = (text: string): PwBlock =>
  ({ id: Math.random().toString(36).slice(2), type: "paragraph", text, align: "left", indent: false }) as PwBlock;

const many = (n: number) => Array.from({ length: n }, (_, i) => para(`Строка ${i} `.repeat(12)));

describe("pickFitFactor", () => {
  it("короткий документ не сжимается", () => {
    expect(pickFitFactor(many(3), DEFAULT_BLANK)).toBe(1);
  });

  it("документ с небольшим переполнением сжимается и влезает на лист", () => {
    const blocks = many(2);
    const blank = DEFAULT_BLANK;
    // добираем содержимое ровно до лёгкого переполнения
    let all = blocks;
    while (estimateContentHeightPt(all, blank) < availableHeightPt(blank) * 1.05) all = [...all, para("Текст ".repeat(30))];
    const k = pickFitFactor(all, blank);
    expect(k).toBeLessThan(1);
    expect(k).toBeGreaterThanOrEqual(MIN_FIT_K);
    const fitted = fittedBlank(all, blank);
    expect(estimateContentHeightPt(fitted, fitted)).toBeLessThanOrEqual(availableHeightPt(fitted) * 1.02);
  });

  it("большой документ не сжимается — верстается на несколько страниц", () => {
    expect(pickFitFactor(many(60), DEFAULT_BLANK)).toBe(1);
  });

  it("отключённая опция запрещает подгонку", () => {
    const blank = { ...DEFAULT_BLANK, fitOnePage: false };
    expect(pickFitFactor(many(20), blank)).toBe(1);
  });
});

describe("shrinkBlank", () => {
  it("не опускает кегль ниже минимума и сохраняет поля читаемыми", () => {
    const b = shrinkBlank({ ...DEFAULT_BLANK, fontSizePt: 8.5 }, MIN_FIT_K);
    expect(b.fontSizePt).toBeGreaterThanOrEqual(MIN_FONT_PT);
    expect(b.marginTopMm).toBeGreaterThanOrEqual(10);
    expect(b.marginBottomMm).toBeGreaterThanOrEqual(10);
  });

  it("k = 1 не меняет бланк", () => {
    expect(shrinkBlank(DEFAULT_BLANK, 1)).toBe(DEFAULT_BLANK);
  });
});
