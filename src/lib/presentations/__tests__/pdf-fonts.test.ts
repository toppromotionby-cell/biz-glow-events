import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { pickDisplayFont } from "@/lib/documents/pdf/ctx.server";
import {
  DOC_FONTS,
  DOC_FONT_DOCX_NAME,
  DOC_FONT_LABELS,
  fontHref,
  fontStacks,
  needsBodyFallback,
  normalizeDocFont,
  normalizeDocFontChoice,
} from "@/lib/documents/doc-font";

const RU = "3-6 августа 2026 г.";

describe("подбор заголовочного шрифта", () => {
  it("для кириллицы в фирменном наборе используется основной жирный", async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const set = pdfFontSet("brand");
    const bold = await pdf.embedFont(set.bold, { subset: true });
    const display = await pdf.embedFont(set.display, { subset: true });
    const fonts = { bold, display, displayCyrillic: set.displayCyrillic };

    expect(set.displayCyrillic).toBe(false);
    expect(pickDisplayFont(RU, fonts)).toBe(bold);
    expect(pickDisplayFont("Vision 2026", fonts)).toBe(display);
    // Выбранный шрифт умеет кодировать кириллицу — «квадратиков» не будет.
    expect(() => pickDisplayFont(RU, fonts).widthOfTextAtSize(RU, 24)).not.toThrow();
  });

  it("в наборе Ubuntu display остаётся display", async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const set = pdfFontSet("ubuntu");
    const bold = await pdf.embedFont(set.bold, { subset: true });
    const display = await pdf.embedFont(set.display, { subset: true });
    expect(set.displayCyrillic).toBe(true);
    expect(pickDisplayFont(RU, { bold, display, displayCyrillic: true })).toBe(display);
  });

  it("превью использует то же правило подмены", () => {
    expect(needsBodyFallback("brand", RU)).toBe(true);
    expect(needsBodyFallback("brand", "Vision 2026")).toBe(false);
    expect(needsBodyFallback("ubuntu", RU)).toBe(false);
  });
});

describe("каталог шрифтов документов", () => {
  it("каждый шрифт встраивается в PDF и умеет кириллицу", async () => {
    for (const font of DOC_FONTS) {
      const pdf = await PDFDocument.create();
      pdf.registerFontkit(fontkit);
      const set = pdfFontSet(font);
      for (const bytes of [set.regular, set.bold, set.display]) {
        const embedded = await pdf.embedFont(bytes, { subset: true });
        // Кириллица, тире, кавычки, знак номера, рубль/евро — всё должно кодироваться.
        expect(() => embedded.widthOfTextAtSize('№ 12 — «Оборудование», 1 200 € / 3 ч.', 12)).not.toThrow();
      }
      // Display у не-brand наборов содержит кириллицу.
      expect(set.displayCyrillic).toBe(font !== "brand");
    }
  });

  it("у каждого шрифта есть подпись, CSS-стек и ссылка на веб-шрифт", () => {
    for (const font of DOC_FONTS) {
      expect(DOC_FONT_LABELS[font]).toBeTruthy();
      expect(fontStacks(font).body).toContain(",");
      expect(fontHref(font)).toMatch(/^https:\/\/fonts\.googleapis\.com/);
      expect(DOC_FONT_DOCX_NAME[font]).toBeTruthy();
    }
  });

  it("Calibri и Times отдают в DOCX настоящие имена Microsoft", () => {
    expect(DOC_FONT_DOCX_NAME.calibri).toBe("Calibri");
    expect(DOC_FONT_DOCX_NAME.times).toBe("Times New Roman");
    // А в CSS есть открытые метрические аналоги как запасной вариант.
    expect(fontStacks("calibri").body).toContain("Carlito");
    expect(fontStacks("times").body).toContain("Tinos");
  });

  it("нормализация отбрасывает неизвестные значения", () => {
    expect(normalizeDocFont("roboto")).toBe("roboto");
    expect(normalizeDocFont("comic-sans")).toBe("brand");
    expect(normalizeDocFontChoice("times")).toBe("times");
    expect(normalizeDocFontChoice("nope")).toBe("inherit");
  });
});
