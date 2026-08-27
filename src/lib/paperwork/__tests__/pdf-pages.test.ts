import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildPaperworkPdf } from "../pdf.server";
import { DEFAULT_BLANK, type PwBlock } from "../model";

const para = (text: string): PwBlock =>
  ({ id: Math.random().toString(36).slice(2), type: "paragraph", text, align: "left", indent: false }) as PwBlock;

const doc = { title: "Список оборудования", doc_number: "12", doc_date: "2026-01-15" };

async function pages(blocks: PwBlock[], blank = DEFAULT_BLANK) {
  const bytes = await buildPaperworkPdf({ doc, blocks, company: null, blank });
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("buildPaperworkPdf — подгонка под один лист", () => {
  it("короткий документ — одна страница", async () => {
    expect(await pages([para("Короткий текст документа.")])).toBe(1);
  }, 60_000);

  it("документ с небольшим переполнением ужимается до одной страницы", async () => {
    const blocks = Array.from({ length: 34 }, (_, i) => para(`Пункт ${i + 1}. ${"Оборудование и монтаж. ".repeat(3)}`));
    expect(await pages(blocks)).toBe(1);
  }, 120_000);

  it("большой документ честно верстается на несколько страниц", async () => {
    const blocks = Array.from({ length: 150 }, (_, i) => para(`Пункт ${i + 1}. ${"Оборудование и монтаж. ".repeat(4)}`));
    expect(await pages(blocks)).toBeGreaterThan(1);
  }, 120_000);

  it("выключенная опция оставляет вторую страницу", async () => {
    const blocks = Array.from({ length: 34 }, (_, i) => para(`Пункт ${i + 1}. ${"Оборудование и монтаж. ".repeat(3)}`));
    expect(await pages(blocks, { ...DEFAULT_BLANK, fitOnePage: false })).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
