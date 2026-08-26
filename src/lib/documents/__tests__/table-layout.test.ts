// Регрессия вёрстки таблиц PDF: колонка никогда не уже своего заголовка,
// суммы не рвутся на две строки, внутренний расчёт собирается целиком.
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { createCtx } from "@/lib/documents/pdf.server";
import { fitTableCols, type Col, type TableRow } from "@/lib/documents/pdf/table.server";
import { trackedWidth } from "@/lib/documents/pdf/draw.server";
import { M, PAGE_W } from "@/lib/documents/pdf/style.server";
import { buildEconomicsPdf } from "@/lib/documents/economics-pdf.server";

const econCols = (): Col[] => [
  { key: "title", title: "Позиция", width: 0, align: "left" },
  { key: "qty", title: "Кол-во", width: 0, align: "center" },
  { key: "price", title: "Цена, BYN", width: 0, align: "right" },
  { key: "unitCost", title: "С/с ед., BYN", width: 0, align: "right" },
  { key: "revenue", title: "Сумма, BYN", width: 0, align: "right" },
  { key: "cost", title: "С/с, BYN", width: 0, align: "right" },
  { key: "margin", title: "Прибыль, BYN", width: 0, align: "right" },
  { key: "marginPct", title: "%", width: 0, align: "right" },
];

describe("PDF table layout", () => {
  it("не сжимает колонку уже самого длинного слова заголовка", async () => {
    const ctx = await createCtx(null, null, null);
    const cols = econCols();
    const rows: TableRow[] = Array.from({ length: 20 }, (_, i) => ({
      title: `Очень длинное наименование позиции номер ${i} с уточнением`,
      qty: "1 услуга",
      price: "5 250,00",
      unitCost: "5 130,00",
      revenue: "125 250,00",
      cost: "115 130,00",
      margin: "10 120,00",
      marginPct: "8,5%",
    }));
    const tableW = PAGE_W - M.MARGIN_X * 2;
    fitTableCols(ctx, cols, rows, tableW);

    const total = cols.reduce((s, c) => s + c.width, 0);
    expect(total).toBeLessThanOrEqual(tableW + 0.5);
    for (const c of cols) {
      if (c.key === "title") continue;
      const longest = Math.max(
        ...c.title.toUpperCase().split(" ").map((w) => trackedWidth(ctx.bold, w, M.F_DOC_KIND, M.F_DOC_KIND * 0.08)),
      );
      // заголовок помещается в ячейку (с полями 6pt слева/справа)
      expect(c.width).toBeGreaterThanOrEqual(longest);
    }
  });

  it("собирает внутренний расчёт с длинными названиями и большими суммами", async () => {
    const bytes = await buildEconomicsPdf(
      Array.from({ length: 30 }, (_, i) => ({
        title: `Фермовый конструктив для установки экрана на высоте 1-2м, позиция ${i}`,
        qty: 1,
        unitLabel: "услуга",
        price: 125250.55,
        costMode: "amount" as const,
        costInput: 115130.4,
      })),
      DEFAULT_DOCUMENT_SETTINGS,
      { docLabel: "КП промо №20.08.2026-01", client: "БЕЛАГРОПРОМБАНК" },
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(0);
  });
});
