// Проверяем формулы и расчёты в выгрузке КП/промо-КП в Excel и в импорте из Excel.
import { describe, expect, it } from "vitest";
import { buildQuoteWorkbook } from "@/lib/documents/quote-xlsx.browser";
import { buildPromoWorkbook } from "@/lib/documents/promo-xlsx.browser";
import { computeTotals, emptyQuoteItem, normalizeQuote, type Quote, type QuoteItem } from "@/lib/quotes-model";
import {
  computePromoTotals, normalizePromoItem, normalizePromoQuote, type PromoItem, type PromoQuote,
} from "@/lib/promo-quote-model";
import { matchField, parseNumber, rowsFromMatrix } from "@/lib/documents/quote-xlsx-import.browser";

type Cell = { value?: unknown; text?: string };

function cellsOf(ws: any): { row: number; col: number; value: any }[] {
  const out: { row: number; col: number; value: any }[] = [];
  ws.eachRow({ includeEmpty: false }, (row: any, rn: number) => {
    row.eachCell({ includeEmpty: false }, (cell: Cell, cn: number) => {
      out.push({ row: rn, col: cn, value: cell.value });
    });
  });
  return out;
}

const isFormula = (v: any): v is { formula: string; result: number } =>
  Boolean(v && typeof v === "object" && typeof v.formula === "string");

function labelledTotal(ws: any, label: string) {
  const cells = cellsOf(ws);
  const labelCell = cells.find((c) => typeof c.value === "string" && c.value.startsWith(label));
  if (!labelCell) return null;
  return cells.find((c) => c.row === labelCell.row && c.col > labelCell.col)?.value ?? null;
}

function makeQuote(patch: Partial<Quote> = {}): Quote {
  return normalizeQuote({
    id: "q1",
    quote_number: "12/08/2026-01",
    doc_date: "2026-08-12",
    title: "Корпоратив",
    status: "draft",
    discount_type: "none",
    discount_value: 0,
    delivery_cost: 0,
    prepayment_percent: 0,
    vat_mode: "none",
    vat_rate: 20,
    ...patch,
  } as Record<string, unknown>);
}

function makeItems(quoteId: string): QuoteItem[] {
  return [
    emptyQuoteItem(quoteId, 0, { title: "Сцена", section: "Техника", qty: 2, price: 500, cost: 300, unit: "шт." }),
    emptyQuoteItem(quoteId, 1, { title: "Звук", section: "Техника", qty: 1, price: 1200, cost: 700, unit: "компл." }),
    emptyQuoteItem(quoteId, 2, { title: "Ведущий", section: "Артисты", qty: 3, price: 400, cost: 250, unit: "час" }),
  ];
}

describe("выгрузка КП в Excel", () => {
  it("сумма строки — живая формула кол-во × цена с верным результатом", async () => {
    const quote = makeQuote();
    const items = makeItems(quote.id);
    const wb = await buildQuoteWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const formulas = cellsOf(ws).filter((c) => isFormula(c.value) && /^C\d+\*D\d+$/.test(c.value.formula));
    expect(formulas).toHaveLength(items.length);

    formulas.forEach((c) => {
      const m = /^C(\d+)\*D(\d+)$/.exec((c.value as any).formula)!;
      // Формула ссылается на свою же строку
      expect(m[1]).toBe(String(c.row));
      expect(m[2]).toBe(String(c.row));
      const qty = cellsOf(ws).find((x) => x.row === c.row && x.col === 3)!.value;
      const price = cellsOf(ws).find((x) => x.row === c.row && x.col === 4)!.value;
      expect((c.value as any).result).toBeCloseTo(Number(qty) * Number(price), 2);
    });
  });

  it("итоговая сумма складывает все строки состава и совпадает с computeTotals", async () => {
    const quote = makeQuote();
    const items = makeItems(quote.id);
    const t = computeTotals(quote, items);
    const wb = await buildQuoteWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const subtotal = labelledTotal(ws, "Сумма:");
    expect(isFormula(subtotal)).toBe(true);
    const parts = (subtotal as any).formula.split("+");
    expect(parts).toHaveLength(items.length);
    expect((subtotal as any).result).toBeCloseTo(t.subtotal, 2);
    expect(t.subtotal).toBeCloseTo(2 * 500 + 1200 + 3 * 400, 2);

    const total = labelledTotal(ws, "Итого к оплате:");
    expect((total as any).result).toBeCloseTo(t.total, 2);
  });

  it("скидка в процентах даёт формулу от строки «Сумма» и корректный итог", async () => {
    const quote = makeQuote({ discount_type: "percent", discount_value: 10 } as Partial<Quote>);
    const items = makeItems(quote.id);
    const t = computeTotals(quote, items);
    const wb = await buildQuoteWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const discount = labelledTotal(ws, "Скидка 10%");
    expect(isFormula(discount)).toBe(true);
    expect((discount as any).formula).toMatch(/^-E\d+\*0\.1$/);
    expect((discount as any).result).toBeCloseTo(-t.discount, 2);

    const after = labelledTotal(ws, "Итого после скидки:");
    expect((after as any).formula).toMatch(/^E\d+\+E\d+$/);
    expect((after as any).result).toBeCloseTo(t.subtotal - t.discount, 2);
  });

  it("НДС сверху отражается отдельной строкой и входит в итог", async () => {
    const quote = makeQuote({ vat_mode: "add", vat_rate: 20 } as Partial<Quote>);
    const items = makeItems(quote.id);
    const t = computeTotals(quote, items);
    const wb = await buildQuoteWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const vat = labelledTotal(ws, "НДС 20%");
    expect((vat as any).result).toBeCloseTo(t.vat, 2);
    const total = labelledTotal(ws, "Итого к оплате:");
    expect((total as any).result).toBeCloseTo(t.total, 2);
    expect(t.total).toBeCloseTo(t.subtotal + t.vat, 2);
  });
});

function makePromo(patch: Record<string, unknown> = {}): PromoQuote {
  return normalizePromoQuote({
    id: "p1",
    doc_number: "7",
    accent_color: "#F5A623",
    show_qty: true,
    show_total_qty: true,
    commission_enabled: true,
    commission_rate: 10,
    vat_mode: "none",
    discount_type: "none",
    ...patch,
  });
}

function makePromoItems(): PromoItem[] {
  return [
    { title: "Аниматор", qty: 2, multiplier: 3, price: 100, cost: 50, section: "Программа" },
    { title: "Реквизит", qty: 1, multiplier: 1, price: 500, cost: 200, section: "Программа", exclude_from_commission: true },
  ].map((r, i) => normalizePromoItem({ ...r, id: `i${i}`, sort_order: i, rate_qty: r.multiplier }));
}

describe("выгрузка промо-КП в Excel", () => {
  it("сумма строки учитывает множитель (кол-во × множитель × цена)", async () => {
    const quote = makePromo();
    const items = makePromoItems();
    const wb = await buildPromoWorkbook(quote, items);
    const ws = wb.worksheets[0];

    // Строка «Реквизит» — услуга с кол-вом 1: её ячейки единиц объединены,
    // поэтому сумма ссылается только на цену.
    const rowFormulas = cellsOf(ws).filter((c) => isFormula(c.value) && /^D\d+\*E\d+$/.test(c.value.formula));
    expect(rowFormulas).toHaveLength(1);
    expect((rowFormulas[0].value as any).result).toBeCloseTo(2 * 3 * 100, 2);
    const serviceFormula = cellsOf(ws).filter((c) => isFormula(c.value) && /^E\d+$/.test(c.value.formula));
    expect((serviceFormula[0].value as any).result).toBeCloseTo(500, 2);
  });

  it("комиссия считается только по позициям, не исключённым из комиссии", async () => {
    const quote = makePromo();
    const items = makePromoItems();
    const t = computePromoTotals(quote, items);
    const wb = await buildPromoWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const commission = cellsOf(ws).find((c) => isFormula(c.value) && c.value.formula.includes("*0.1"));
    expect(commission).toBeTruthy();
    // в базе комиссии — одна строка из двух
    expect((commission!.value as any).formula.split("+")).toHaveLength(1);
    expect((commission!.value as any).result).toBeCloseTo(t.commission, 2);
    expect(t.commissionBase).toBeCloseTo(600, 2);
    expect(t.commission).toBeCloseTo(60, 2);
  });

  it("позиции «не в итог» и справочные не попадают в расчёт итога", async () => {
    const quote = makePromo();
    const items = [
      ...makePromoItems(),
      normalizePromoItem({ id: "opt", title: "Опция", qty: 1, rate_qty: 1, price: 1000, included: false, sort_order: 2 }),
      normalizePromoItem({ id: "inf", title: "Инфо", qty: 1, rate_qty: 1, price: 999, is_info: true, sort_order: 3 }),
    ];
    const t = computePromoTotals(quote, items);
    expect(t.itemsSum).toBeCloseTo(600 + 500, 2);
    expect(t.optionsSum).toBeCloseTo(1000, 2);

    const wb = await buildPromoWorkbook(quote, items);
    const total = labelledTotal(wb.worksheets[0], "Итого:");
    expect((total as any).result).toBeCloseTo(t.totalWithVat, 2);
  });

  it("НДС и итог с НДС считаются формулами от промежуточной суммы", async () => {
    const quote = makePromo({ vat_mode: "add", vat_rate: 20 });
    const items = makePromoItems();
    const t = computePromoTotals(quote, items);
    const wb = await buildPromoWorkbook(quote, items);
    const ws = wb.worksheets[0];

    const vat = labelledTotal(ws, "НДС 20%");
    expect((vat as any).formula).toMatch(/^F\d+\*0\.2$/);
    expect((vat as any).result).toBeCloseTo(t.vat, 2);
    const total = labelledTotal(ws, "Итого, с НДС:");
    expect((total as any).result).toBeCloseTo(t.totalWithVat, 2);
  });
});

describe("импорт КП из Excel", () => {
  it("распознаёт заголовки в любом написании", () => {
    expect(matchField("Наименование")).toBe("title");
    expect(matchField(" КОЛ-ВО ")).toBe("qty");
    expect(matchField("Цена за ед.")).toBe("price");
    expect(matchField("Себестоимость")).toBe("cost");
    expect(matchField("Что-то своё")).toBeNull();
  });

  it("разбирает числа с пробелами, запятой и валютой", () => {
    expect(parseNumber("1 250,50")).toBeCloseTo(1250.5, 2);
    expect(parseNumber("1 200 BYN")).toBe(1200);
    expect(parseNumber({ result: 42 })).toBe(42);
    expect(parseNumber("—")).toBe(0);
  });

  it("читает позиции, подхватывает разделы и пропускает строки итогов", () => {
    const matrix: unknown[][] = [
      ["КП №12"],
      [],
      ["Раздел", "Наименование", "Ед.", "Кол-во", "Цена", "Себестоимость"],
      ["Техника", "Сцена", "шт.", 2, 500, 300],
      ["", "Звук", "компл.", "1", "1 200", "700"],
      ["Артисты"],
      ["", "Ведущий", "час", 3, 400, 250],
      ["", "Итого", "", "", 3100, ""],
    ];
    const res = rowsFromMatrix(matrix);
    expect(res.headerRow).toBe(3);
    expect(res.rows).toHaveLength(3);
    expect(res.rows[1]).toMatchObject({ title: "Звук", qty: 1, price: 1200, cost: 700, section: "Техника" });
    expect(res.rows[2].section).toBe("Артисты");

    const sum = res.rows.reduce((s, r) => s + r.qty * r.price, 0);
    expect(sum).toBeCloseTo(2 * 500 + 1200 + 3 * 400, 2);
  });

  it("импортированные позиции дают тот же итог, что и computeTotals", () => {
    const res = rowsFromMatrix([
      ["Наименование", "Кол-во", "Цена"],
      ["Свет", 4, 250],
      ["Дым", 2, 125],
    ]);
    const quote = makeQuote({ discount_type: "percent", discount_value: 10 } as Partial<Quote>);
    const items = res.rows.map((r, i) =>
      emptyQuoteItem(quote.id, i, { title: r.title, qty: r.qty, price: r.price, unit: r.unit }),
    );
    const t = computeTotals(quote, items);
    expect(t.subtotal).toBeCloseTo(1250, 2);
    expect(t.discount).toBeCloseTo(125, 2);
    expect(t.total).toBeCloseTo(1125, 2);
  });

  it("сообщает об ошибке, если заголовок не найден", () => {
    expect(() => rowsFromMatrix([["что-то"], ["ещё"]])).toThrow(/заголовк/i);
  });
});
