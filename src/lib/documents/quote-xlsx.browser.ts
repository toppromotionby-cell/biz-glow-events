// Экспорт КП в XLSX с живыми формулами (ExcelJS, только в браузере).
// Загружается динамически по клику — библиотека не попадает в основной бандл.
import { downloadBlob } from "@/lib/download";
import { computeTotals, listSections, type Quote, type QuoteItem } from "@/lib/quotes-model";
import { quoteNumberDisplay } from "@/lib/documents/quote-html";

const NUM_FMT = "# ##0,00;-# ##0,00;-";

function argb(hex: string | null | undefined, fallback = "FFF5A623"): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex ?? "").trim());
  return m ? `FF${m[1].toUpperCase()}` : fallback;
}

/** Собирает книгу с живыми формулами (без скачивания) — используется и в тестах. */
export async function buildQuoteWorkbook(quote: Quote, items: QuoteItem[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Event Hub";
  wb.created = new Date();
  const ws = wb.addWorksheet(`КП ${quoteNumberDisplay(quote)}`.slice(0, 30));

  const accent = argb(quote.design?.accent_color);
  const t = computeTotals(quote, items);

  const cols = [
    { key: "title", header: "Наименование", width: 48 },
    { key: "unit", header: "Ед. изм.", width: 12 },
    { key: "qty", header: "Кол-во", width: 10 },
    { key: "price", header: "Цена за ед.", width: 14 },
    { key: "sum", header: "Сумма", width: 16 },
  ] as const;
  ws.columns = cols.map((c) => ({ width: c.width }));
  const idx = (key: (typeof cols)[number]["key"]) => cols.findIndex((c) => c.key === key) + 1;
  const letter = (key: (typeof cols)[number]["key"]) => String.fromCharCode(64 + idx(key));
  const lastCol = String.fromCharCode(64 + cols.length);

  // ==== шапка ====
  const head = [
    quote.title ? `Проект: ${quote.title}` : "",
    quote.client_company || quote.client_name
      ? `Клиент: ${[quote.client_company, quote.client_name].filter(Boolean).join(", ")}`
      : "",
    quote.event_date ? `Дата мероприятия: ${quote.event_date}` : "",
    quote.venue ? `Место проведения: ${quote.venue}` : "",
  ].filter(Boolean);
  head.forEach((line) => {
    const row = ws.addRow([line]);
    ws.mergeCells(`A${row.number}:C${row.number}`);
    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F4" } };
  });
  ws.addRow([`КП № ${quoteNumberDisplay(quote)} от ${quote.doc_date}`]).font = { bold: true };
  ws.addRow([]);

  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    cell.border = {
      top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
    };
  });

  const sumRows: number[] = [];
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  for (const section of listSections(sorted)) {
    const secItems = sorted.filter((it) => (it.section?.trim() || "") === section);
    if (section) {
      const r = ws.addRow([section]);
      ws.mergeCells(`A${r.number}:${lastCol}${r.number}`);
      r.getCell(1).font = { bold: true };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E7EA" } };
    }
    for (const it of secItems) {
      const inc = it.includes.length
        ? "\n" + it.includes.map((x) => `• ${x.text}${x.note ? ` — ${x.note}` : ""}`).join("\n")
        : "";
      const row = ws.addRow([`${it.title}${inc}`, it.unit, it.qty, it.price, null]);
      const rn = row.number;
      const sumCell = row.getCell(idx("sum"));
      sumCell.value = { formula: `${letter("qty")}${rn}*${letter("price")}${rn}`, result: it.qty * it.price };
      sumCell.numFmt = NUM_FMT;
      row.getCell(idx("price")).numFmt = NUM_FMT;
      row.getCell(idx("qty")).alignment = { horizontal: "center" };
      row.eachCell((cell) => {
        cell.alignment = { ...(cell.alignment ?? {}), vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" },
        };
      });
      sumRows.push(rn);
    }
  }

  const sumCol = letter("sum");
  const sumFormula = sumRows.length ? sumRows.map((r) => `${sumCol}${r}`).join("+") : "0";

  const addTotal = (label: string, formula: string, result: number, bold = false) => {
    const row = ws.addRow([]);
    const lc = row.getCell(idx("price"));
    lc.value = label;
    lc.font = { bold: true };
    lc.alignment = { horizontal: "right", wrapText: true };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    const vc = row.getCell(idx("sum"));
    vc.value = { formula, result };
    vc.numFmt = NUM_FMT;
    vc.font = { bold };
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8EA" } };
    [lc, vc].forEach((c) => {
      c.border = {
        top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
      };
    });
    return row.number;
  };

  const subtotalRow = addTotal("Сумма:", sumFormula, t.subtotal);
  let baseRow = subtotalRow;
  if (t.discount > 0) {
    const dRow = addTotal(
      quote.discount_type === "percent" ? `Скидка ${quote.discount_value}%:` : "Скидка:",
      quote.discount_type === "percent"
        ? `-${sumCol}${subtotalRow}*${quote.discount_value / 100}`
        : `-${t.discount}`,
      -t.discount,
    );
    baseRow = addTotal("Итого после скидки:", `${sumCol}${subtotalRow}+${sumCol}${dRow}`, t.subtotal - t.discount);
  }
  if (t.delivery > 0) {
    const delRow = addTotal("Доставка:", `${t.delivery}`, t.delivery);
    baseRow = addTotal("Всего:", `${sumCol}${baseRow}+${sumCol}${delRow}`, t.subtotal - t.discount + t.delivery);
  }
  if (t.vatEnabled) {
    addTotal(`НДС ${t.vatRate}%${t.vatMode === "included" ? " (в т.ч.)" : ""}:`, `${t.vat}`, t.vat);
  }
  addTotal("Итого к оплате:", `${t.total}`, t.total, true);
  if (t.prepayment > 0) {
    addTotal("Предоплата:", `${t.prepayment}`, t.prepayment);
    addTotal("Остаток:", `${t.balance}`, t.balance);
  }

  return wb;
}

export async function exportQuoteXlsx(quote: Quote, items: QuoteItem[]): Promise<void> {
  const wb = await buildQuoteWorkbook(quote, items);
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `КП №${quoteNumberDisplay(quote)}.xlsx`,
  );
}
