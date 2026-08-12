import { describe, expect, it } from "vitest";
import { specToElements, slidePageFromSpec, paintHex } from "../to-elements";
import type { SpecBlock } from "../slide-spec";
import { slideTheme, SLIDE_W } from "../design";
import { pageOps } from "@/lib/canvas/ops";

const theme = slideTheme("light", "#ff5533");

describe("specToElements", () => {
  it("переносит геометрию и кегль текста без изменений", () => {
    const blocks: SpecBlock[] = [{
      kind: "text", id: "title", x: 80, y: 100, w: 500, size: 44, lineHeight: 1.1,
      font: "display", weight: 800, color: "ink", text: "Заголовок",
      align: "left", lines: ["Заголовок"],
    }];
    const [el] = specToElements(blocks, { theme });
    expect(el).toMatchObject({ id: "text-title", type: "text", x: 80, y: 100, w: 500 });
    expect(el.h).toBeCloseTo(44 * 1.1, 5);
    expect(el.props).toMatchObject({ fontSize: 44, autoFit: false, font: "display" });
  });

  it("затемнение превращается в плашку по низу слайда", () => {
    const [el] = specToElements([{ kind: "shade", from: 0.5, alpha: 0.6 }], { theme });
    expect(el.type).toBe("shape");
    expect(el.w).toBe(SLIDE_W);
    expect((el.props as { opacity: number }).opacity).toBe(0.6);
  });

  it("логотип пропускается без источника и рисуется с ним", () => {
    const blocks: SpecBlock[] = [{ kind: "logo", x: 10, y: 10, w: 100, h: 40 }];
    expect(specToElements(blocks, { theme })).toHaveLength(0);
    const [el] = specToElements(blocks, { theme, logoSrc: "logo.png" });
    expect(el).toMatchObject({ type: "logo", props: { src: "logo.png", fit: "contain" } });
  });

  it("порядок блоков задаёт порядок слоёв", () => {
    const els = specToElements([
      { kind: "rect", x: 0, y: 0, w: 10, h: 10, radius: 0, color: "panel" },
      { kind: "rect", x: 0, y: 0, w: 10, h: 10, radius: 0, color: "accent" },
    ], { theme });
    expect(els.map((e) => e.zIndex)).toEqual([0, 1]);
  });
});

describe("slidePageFromSpec", () => {
  it("страница исполняется общим рендером без ошибок", () => {
    const page = slidePageFromSpec("s1", [
      { kind: "image", index: 0, path: "a.jpg", x: 0, y: 0, w: 640, h: 720, radius: 0 },
      {
        kind: "text", x: 700, y: 80, w: 500, size: 24, lineHeight: 1.3, font: "body",
        weight: 400, color: "muted", text: "Подзаголовок", align: "left",
      },
    ], { theme, resolveImage: () => "https://cdn/a.jpg" });

    const ops = pageOps(page);
    expect(ops[0]).toMatchObject({ kind: "rect" });
    expect(ops.find((o) => o.kind === "image")).toMatchObject({ src: "https://cdn/a.jpg" });
    const text = ops.find((o) => o.kind === "text");
    expect(text).toMatchObject({ fontSize: 24, color: paintHex("muted", theme) });
  });
});
