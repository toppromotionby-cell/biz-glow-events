import { describe, expect, it } from "vitest";
import { slideTheme } from "@/lib/presentations/design";
import { PRESENTATION_TEMPLATES, TEMPLATE_LABELS } from "@/lib/presentations/model";

const ACCENT = "#ff7500";

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("шаблоны презентаций", () => {
  it("у каждого шаблона есть название и полный набор токенов", () => {
    for (const t of PRESENTATION_TEMPLATES) {
      expect(TEMPLATE_LABELS[t]).toBeTruthy();
      const th = slideTheme(t, ACCENT);
      for (const key of ["bg", "panel", "ink", "muted", "accent", "line", "onAccent"] as const) {
        expect(th[key], `${t}.${key}`).toBeTruthy();
      }
      expect(th.bgStops.length).toBeGreaterThan(0);
    }
  });

  it("градиентные шаблоны отдают несколько стопов и CSS-градиент", () => {
    for (const t of ["night", "sunset", "emerald", "glow"] as const) {
      const th = slideTheme(t, ACCENT);
      expect(th.bgStops.length).toBeGreaterThanOrEqual(3);
      expect(th.bg).toContain("linear-gradient");
    }
  });

  it("текст читается на каждом стопе фона", () => {
    for (const t of PRESENTATION_TEMPLATES) {
      const th = slideTheme(t, ACCENT);
      if (!/^#[0-9a-f]{6}$/i.test(th.ink)) continue;
      for (const stop of th.bgStops) {
        if (!/^#[0-9a-f]{6}$/i.test(stop)) continue;
        expect(contrast(th.ink, stop), `${t} / ${stop}`).toBeGreaterThan(4.5);
      }
    }
  });
});
