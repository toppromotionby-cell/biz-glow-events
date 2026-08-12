import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { pickDisplayFont } from "@/lib/documents/pdf/ctx.server";
import { needsBodyFallback } from "@/lib/documents/doc-font";

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
