import { describe, expect, it } from "vitest";
import { PAGE_FORMATS, normalizeElement, type CanvasPage } from "../model";
import { elementOps, fitFontSize, pageOps, MIN_FONT } from "../ops";

const el = (over: Parameters<typeof normalizeElement>[0]) => normalizeElement(over);

describe("fitFontSize", () => {
  it("оставляет базовый кегль, когда текст помещается", () => {
    expect(fitFontSize("Привет", { w: 400, h: 80 }, 24, 1.3)).toBe(24);
  });

  it("уменьшает кегль для длинного текста в узком блоке", () => {
    const size = fitFontSize("а".repeat(600), { w: 200, h: 60 }, 32, 1.3);
    expect(size).toBeLessThan(32);
    expect(size).toBeGreaterThanOrEqual(MIN_FONT);
  });
});

describe("elementOps", () => {
  it("пропускает пустой текст и картинку без src", () => {
    expect(elementOps(el({ id: "a", type: "text", props: { text: "  " } }))).toEqual([]);
    expect(elementOps(el({ id: "b", type: "image", props: {} }))).toEqual([]);
  });

  it("логотип рисуется с fit=contain по умолчанию", () => {
    const [op] = elementOps(el({ id: "l", type: "logo", props: { src: "x.png" } }));
    expect(op).toMatchObject({ kind: "image", fit: "contain" });
  });
});

describe("pageOps", () => {
  const page = (elements: CanvasPage["elements"]): CanvasPage => ({
    id: "p", format: PAGE_FORMATS.a4, background: "#ffffff", elements,
  });

  it("фон идёт первым, слои — по zIndex", () => {
    const ops = pageOps(page([
      el({ id: "top", type: "shape", zIndex: 5, props: { fill: "#111" } }),
      el({ id: "low", type: "shape", zIndex: 1, props: { fill: "#222" } }),
    ]));
    expect(ops.map((o) => (o.kind === "rect" ? o.fill : o.kind))).toEqual(["#ffffff", "#222", "#111"]);
  });

  it("не рисует элементы за пределами листа", () => {
    const ops = pageOps(page([el({ id: "off", type: "shape", x: -500, y: 0, w: 100, h: 100 })]));
    expect(ops).toHaveLength(1); // только фон
  });
});
