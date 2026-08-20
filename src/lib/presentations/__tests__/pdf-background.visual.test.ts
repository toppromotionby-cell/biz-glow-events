// Визуальная регрессия PDF: фон слайда рисуется теми же цветами, что и превью.
// Читаем реальные операторы заливки из сжатых потоков готового PDF —
// так тест ловит расхождения градиентов и цветовых схем без растеризации.
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildPresentationPdf, type ResolvedSlide } from "@/lib/presentations/pdf.server";
import {
  blankSlide, type Presentation, type PresentationTemplate, type SlideBackground,
} from "@/lib/presentations/model";
import { PRESENTATION_TEMPLATES } from "@/lib/presentations/model";
import { slideTheme, templatePalette } from "@/lib/presentations/design";

const ACCENT = "#FF7500";

function presentation(template: PresentationTemplate): Presentation {
  return {
    id: "p1",
    title: "Фон",
    company_id: null,
    quote_id: null,
    status: "draft",
    template,
    logo_url: null,
    client_logo_url: null,
    logo_layout: "auto",
    font_family: "inherit",
    public_token: "tok",
    share_enabled: false,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

function slide(background: SlideBackground | null): ResolvedSlide {
  const base = blankSlide("text", 0);
  return {
    ...base,
    content: {
      ...base.content,
      showImage: false,
      ...(background ? { background } : {}),
    },
    resolved_image_url: null,
    resolved_images: [],
  };
}

/** Все `r g b rg` операторы страницы в порядке отрисовки. */
async function fills(p: Presentation, s: ResolvedSlide): Promise<string[]> {
  const bytes = await buildPresentationPdf(p, [s], null, null, null);
  const buf = Buffer.from(bytes);
  let text = "";
  let i = 0;
  for (;;) {
    const at = buf.indexOf("stream", i);
    if (at < 0) break;
    let start = at + "stream".length;
    if (buf[start] === 0x0d) start += 1;
    if (buf[start] === 0x0a) start += 1;
    const end = buf.indexOf("endstream", start);
    if (end < 0) break;
    try {
      text += `${zlib.inflateSync(buf.subarray(start, end)).toString("latin1")}\n`;
    } catch {
      // не сжатый/не контентный поток — пропускаем
    }
    i = end + "endstream".length;
  }
  return text.match(/[\d.]+ [\d.]+ [\d.]+ rg/g) ?? [];
}

function toHex(op: string): string {
  const ch = op
    .replace(" rg", "")
    .split(" ")
    .map((v) => Math.round(Number(v) * 255));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function close(a: string, b: string, tol = 4): boolean {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return [0, 1, 2].every((i) => Math.abs(ch(a, i) - ch(b, i)) <= tol);
}

describe("PDF: фон слайда", () => {
  it("сплошной фон заливается ровно одним прямоугольником заданного цвета", async () => {
    const ops = await fills(presentation("light"), slide({ mode: "solid", stops: ["#123456"], angle: 135 }));
    expect(toHex(ops[0])).toBe("#123456");
    // Второй оператор — уже текст/плашка, а не второй тон фона.
    expect(toHex(ops[1])).not.toBe("#123456");
  });

  it("градиент рисуется 96 полосами от первого стопа к второму", async () => {
    const bg: SlideBackground = { mode: "gradient", stops: ["#102030", "#405060"], angle: 135 };
    const ops = await fills(presentation("light"), slide(bg));
    expect(ops.length).toBeGreaterThanOrEqual(96);
    expect(toHex(ops[0])).toBe("#102030");
    expect(close(toHex(ops[95]), "#405060")).toBe(true);
    // Монотонность: полосы идут без скачков назад.
    const reds = ops.slice(0, 96).map((o) => Number(o.split(" ")[0]));
    for (let i = 1; i < reds.length; i += 1) expect(reds[i]).toBeGreaterThanOrEqual(reds[i - 1] - 1e-6);
  });

  it("каждый шаблон печатает свой фон — как в превью", async () => {
    for (const template of PRESENTATION_TEMPLATES) {
      const ops = await fills(presentation(template), slide(null));
      const palette = templatePalette(template, ACCENT);
      expect(close(toHex(ops[0]), palette.stops[0])).toBe(true);
    }
  });

  it("тёмный шаблон — чистый чёрный фон и светлый текст", async () => {
    const ops = await fills(presentation("dark"), slide(null));
    expect(toHex(ops[0])).toBe("#000000");
    const theme = slideTheme("dark", ACCENT);
    expect(theme.ink.toLowerCase()).toBe("#ffffff");
  });

  it("переопределение фона перебивает шаблон", async () => {
    const ops = await fills(
      presentation("dark"),
      slide({ mode: "solid", stops: ["#f5f5f5"], angle: 135 }),
    );
    expect(toHex(ops[0])).toBe("#f5f5f5");
  });
});
