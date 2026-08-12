// Спек статичных слайдов — общий источник для превью и PDF.
import { describe, expect, it } from "vitest";
import { normalizeSlide } from "@/lib/presentations/model";
import { typeScale, SLIDE_H } from "@/lib/presentations/design";
import { contactRows, staticSlideSpec } from "@/lib/presentations/slide-spec";

const company = {
  company_phone: "+375 29 000-00-00",
  company_email: "a@b.by",
  company_website: "event-hub.by",
  company_address: "Минск",
} as never;

const slide = (type: string, over: Record<string, unknown> = {}) =>
  normalizeSlide({ type, title: "Заголовок", subtitle: "Подзаголовок", ...over }, 0);

const ts = typeScale("normal");

describe("staticSlideSpec", () => {
  it("титул: логотип, заголовок, акцентная линия, контакты и дата", () => {
    const blocks = staticSlideSpec({
      slide: slide("title"),
      ts,
      company,
      presentationTitle: "Презентация",
      brandName: "Топ Промоушн",
      heroLogo: { w: 320, h: 76 },
      dateLabel: "12.08.2026",
    });
    expect(blocks.some((b) => b.kind === "logo")).toBe(true);
    expect(blocks.some((b) => b.kind === "circle")).toBe(true);
    expect(blocks.filter((b) => b.kind === "rect")).toHaveLength(1);
    const texts = blocks.filter((b) => b.kind === "text");
    expect(texts.some((b) => b.kind === "text" && b.text === "12.08.2026")).toBe(true);
    expect(texts.some((b) => b.kind === "text" && b.id === "title")).toBe(true);
  });

  it("контакты: по карточке на каждую заполненную строку", () => {
    const blocks = staticSlideSpec({
      slide: slide("contacts"),
      ts,
      company,
      presentationTitle: "П",
      brandName: "Б",
      heroLogo: null,
      dateLabel: "",
    });
    const cards = blocks.filter((b) => b.kind === "rect");
    expect(cards).toHaveLength(contactRows(company).length);
  });

  it("блоки центрируются по вертикали и не выходят за холст", () => {
    for (const type of ["title", "section", "contacts"]) {
      const blocks = staticSlideSpec({
        slide: slide(type),
        ts,
        company,
        presentationTitle: "П",
        brandName: "Б",
        heroLogo: null,
        dateLabel: "",
      });
      for (const b of blocks) {
        if (b.kind === "circle" || b.kind === "shade") continue;
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThan(SLIDE_H);
      }
    }
  });
});
