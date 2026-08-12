// Регрессия: свой фон слайда даёт читаемые токены текста и не ломает шаблоны.
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_PRESETS, contrastRatio, isDarkBackground, slideTheme,
} from "@/lib/presentations/design";
import {
  normalizeSlideBackground, normalizeTemplate, type SlideBackground,
} from "@/lib/presentations/model";

const ACCENT = "#FF7500";

describe("фон слайда", () => {
  it("тёмный шаблон — чёрный фон", () => {
    expect(slideTheme("dark", ACCENT).bg).toBe("#000000");
  });

  it("нормализация отбрасывает мусор", () => {
    expect(normalizeSlideBackground({ mode: "solid", stops: ["nope"] }).mode).toBe("template");
    expect(normalizeSlideBackground({ mode: "solid", stops: ["#ABCDEF"] })).toEqual({
      mode: "solid", stops: ["#abcdef"], angle: 135,
    });
    expect(normalizeSlideBackground(null).mode).toBe("template");
  });

  it("неизвестный шаблон не роняет, а даёт дефолт", () => {
    expect(normalizeTemplate("emerald")).toBe("emerald");
    expect(normalizeTemplate("supernova")).toBe("light");
  });

  it("текст читаем на любом пресете фона", () => {
    for (const p of BACKGROUND_PRESETS) {
      const bg: SlideBackground = {
        mode: p.stops.length > 1 ? "gradient" : "solid",
        stops: p.stops,
        angle: p.angle,
      };
      const t = slideTheme("light", ACCENT, bg);
      for (const stop of p.stops) {
        expect(contrastRatio(t.ink, stop)).toBeGreaterThan(4.5);
        expect(contrastRatio(t.accent, stop)).toBeGreaterThan(2.5);
      }
      expect(t.ink).toBe(isDarkBackground(p.stops) ? "#ffffff" : "#111827");
    }
  });

  it("градиент собирается в CSS, сплошной цвет — плоский", () => {
    const grad = slideTheme("light", ACCENT, { mode: "gradient", stops: ["#000000", "#333333"], angle: 90 });
    expect(grad.bg).toBe("linear-gradient(90deg, #000000, #333333)");
    const solid = slideTheme("light", ACCENT, { mode: "solid", stops: ["#123456"], angle: 135 });
    expect(solid.bg).toBe("#123456");
  });
});
