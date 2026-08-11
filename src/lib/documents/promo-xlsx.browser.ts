// Экспорт промо-КП в XLSX с живыми формулами (ExcelJS, только в браузере).
// Загружается динамически по клику — библиотека не попадает в основной бандл.
import { downloadBlob } from "@/lib/download";
import { PRICE_LABEL } from "@/lib/documents/doc-layout";
import {
  computePromoTotals,
  groupBySection,
  hasSecondUnit,
  rateUnitLabel,
  isServiceOnlyRow,
  lineQty,
  lineTotal,
  promoFileName,
  promoNumberDisplay,
  type PromoItem,
  type PromoQuote,
} from "@/lib/promo-quote-model";

const NUM_FMT = "# ##0,00;-# ##0,00;-";

function argb(hex: string, fallback = "FFF5A623"): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `FF${m[1].toUpperCase()}` : fallback;
}

/** Собирает книгу промо-КП с живыми формулами (без скачивания) — используется и в тестах. */
export async function buildPromoWorkbook(quote: PromoQuote, items: PromoItem[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Event Hub";
  wb.created = new Date();
  const ws = wb.addWorksheet(`КП ${promoNumberDisplay(quote)}`.slice(0, 30));

  const accent = argb(quote.accent_color);
  const t = computePromoTotals(quote, items);

  // ==== колонки ====
  // Вторая единица («час», «смена») — отдельные колонки, только если она заполнена.
  const dual = hasSecondUnit(items);
  type ColKey = "title" | "unit" | "qty" | "unit2" | "qty2" | "total_qty" | "price" | "sum" | "note";
  const cols: Array<{ key: ColKey; header: string; width: number }> = [
    { key: "title", header: "Наименование", width: 46 },
    { key: "unit", header: "Ед. изм.", width: 14 },
  ];
  if (quote.show_qty) cols.push({ key: "qty", header: "Кол-во", width: 9 });
  if (dual) {
    cols.push({ key: "unit2", header: "Ед. изм.", width: 10 });
    cols.push({ key: "qty2", header: "Кол-во", width: 10 });
  }
  if (quote.show_total_qty) cols.push({ key: "total_qty", header: "Всего", width: 9 });
  cols.push({ key: "price", header: PRICE_LABEL, width: 16 });
  cols.push({ key: "sum", header: `Всего${quote.vat_enabled ? ", без НДС" : ""}`, width: 16 });
  if (quote.show_notes) cols.push({ key: "note", header: "Примечания", width: 72 });
  ws.columns = cols.map((c) => ({ width: c.width }));

  const colLetter = (key: ColKey): string => {
    const idx = cols.findIndex((c) => c.key === key);
    return idx < 0 ? "A" : String.fromCharCode(65 + idx);
  };
  const lastCol = String.fromCharCode(65 + cols.length - 1);

  // ==== шапка документа ====
  const headLines = [
    quote.project ? `Проект: ${quote.project}` : "",
    quote.client_name ? `Клиент: ${quote.client_name}` : "",
    quote.period ? `Период: ${quote.period}` : "",
    quote.venue ? `Место проведения: ${quote.venue}` : "",
    [quote.contact_name, quote.contact_role].filter(Boolean).length ||
    quote.contact_phone ||
    quote.contact_email
      ? `Контактное лицо: ${[quote.contact_name, quote.contact_role].filter(Boolean).join(", ")}${
          quote.contact_phone ? `; ${quote.contact_phone}` : ""
        }${quote.contact_email ? ` ${quote.contact_email}` : ""}`
      : "",
  ].filter(Boolean);

  headLines.forEach((line) => {
    const row = ws.addRow([line]);
    ws.mergeCells(`A${row.number}:C${row.number}`);
    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F4" } };
    row.getCell(1).border = {
      top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
    };
  });
  ws.addRow([`КП № ${promoNumberDisplay(quote)}`]).font = { bold: true };
  ws.addRow([]);

  // ==== таблица ====
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
  const commissionRows: number[] = [];

  for (const sec of groupBySection(items)) {
    if (sec.name) {
      const r = ws.addRow([sec.name]);
      ws.mergeCells(`A${r.number}:${lastCol}${r.number}`);
      r.getCell(1).font = { bold: true };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E7EA" } };
    }
    for (const it of sec.items) {
      const incText =
        quote.show_item_includes && it.includes.length
          ? "\n" + it.includes.map((x) => `• ${x.text}${x.note ? ` — ${x.note}` : ""}`).join("\n")
          : "";
      const values: Record<ColKey, unknown> = {
        title: `${it.title}${incText}`,
        unit: it.unit,
        qty: it.qty,
        unit2: rateUnitLabel(it),
        qty2: rateUnitLabel(it) ? it.multiplier : "",
        total_qty: lineQty(it),
        price: it.price,
        sum: null,
        note: it.note,
      };
      const row = ws.addRow(cols.map((c) => values[c.key] ?? ""));
      const rn = row.number;
      // живая формула суммы строки
      const qtyRef = quote.show_total_qty
        ? `${colLetter("total_qty")}${rn}`
        : quote.show_qty
          ? dual && rateUnitLabel(it)
            ? `${colLetter("qty")}${rn}*${colLetter("qty2")}${rn}`
            : `${colLetter("qty")}${rn}`
          : null;
      // Строка-услуга: ячейки единиц/количеств объединяются, количество не участвует
      const serviceRow = isServiceOnlyRow(it);
      const sumCell = row.getCell(cols.findIndex((c) => c.key === "sum") + 1);
      sumCell.value = serviceRow
        ? { formula: `${colLetter("price")}${rn}`, result: it.price }
        : qtyRef
        ? { formula: `${qtyRef}*${colLetter("price")}${rn}`, result: it.qty * it.multiplier * it.price }
        : { formula: `${colLetter("price")}${rn}`, result: it.price };
      sumRows.push(rn);
      if (!it.exclude_from_commission) commissionRows.push(rn);

      row.eachCell((cell, colNumber) => {
        const key = cols[colNumber - 1]?.key;
        const centered = key !== "title" && key !== "note";
        cell.alignment = {
          vertical: "middle",
          horizontal: centered ? "center" : "left",
          wrapText: true,
        };
      });
      if (quote.show_qty) row.getCell(cols.findIndex((c) => c.key === "qty") + 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (quote.show_total_qty) {
        const tq = row.getCell(cols.findIndex((c) => c.key === "total_qty") + 1);
        tq.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        if (dual && rateUnitLabel(it))
          tq.value = {
            formula: `${colLetter("qty")}${rn}*${colLetter("qty2")}${rn}`,
            result: lineQty(it),
          };
      }
      if (dual) row.getCell(cols.findIndex((c) => c.key === "qty2") + 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (serviceRow) {
        const lastMergeKey: ColKey = dual ? "qty2" : quote.show_qty ? "qty" : "unit";
        if (lastMergeKey !== "unit") {
          ws.mergeCells(`${colLetter("unit")}${rn}:${colLetter(lastMergeKey)}${rn}`);
          const c = row.getCell(cols.findIndex((cc) => cc.key === "unit") + 1);
          c.value = it.unit || "услуга";
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
      }
      row.getCell(cols.findIndex((c) => c.key === "price") + 1).numFmt = NUM_FMT;
      sumCell.numFmt = NUM_FMT;
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      const r = ws.addRow(cols.map((c) => (c.key === "title" ? `Итого по разделу «${sec.name}»` : "")));
      const cell = r.getCell(cols.findIndex((c) => c.key === "sum") + 1);
      cell.value = sec.items.reduce((acc, it) => acc + lineTotal(it), 0);
      cell.numFmt = NUM_FMT;
      r.font = { bold: true };
    }
  }

  const sumCol = colLetter("sum");
  const sumRangeFormula = (rows: number[]) =>
    rows.length ? rows.map((r) => `${sumCol}${r}`).join("+") : "0";

  // Менеджмент и комиссия
  const extraRowNums: number[] = [];
  if (quote.management_enabled) {
    const row = ws.addRow(cols.map((c) => (c.key === "title" ? quote.management_label : c.key === "unit" ? "услуга" : "")));
    row.getCell(cols.findIndex((c) => c.key === "sum") + 1).value = t.management;
    row.getCell(cols.findIndex((c) => c.key === "sum") + 1).numFmt = NUM_FMT;
    extraRowNums.push(row.number);
  }
  if (quote.commission_enabled) {
    const row = ws.addRow(
      cols.map((c) =>
        c.key === "title" ? quote.commission_label : c.key === "note" ? `${quote.commission_rate}%` : "",
      ),
    );
    const cell = row.getCell(cols.findIndex((c) => c.key === "sum") + 1);
    cell.value = {
      formula: `(${sumRangeFormula(commissionRows)})*${quote.commission_rate / 100}`,
      result: t.commission,
    };
    cell.numFmt = NUM_FMT;
    extraRowNums.push(row.number);
  }

  // границы для всей таблицы
  const firstDataRow = headerRow.number + 1;
  const lastDataRow = ws.rowCount;
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" },
      };
    });
  }

  // ==== итоги ====
  const totalsStart = ws.rowCount + 1;
  const allSumRows = [...sumRows, ...extraRowNums];
  const labelColIdx = Math.max(cols.findIndex((c) => c.key === "price"), 0) + 1;
  const valueColIdx = cols.findIndex((c) => c.key === "sum") + 1;

  const addTotal = (label: string, formula: string, result: number, bold = false) => {
    const row = ws.addRow([]);
    const lc = row.getCell(labelColIdx);
    lc.value = label;
    lc.font = { bold: true };
    lc.alignment = { horizontal: "right" };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    const vc = row.getCell(valueColIdx);
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

  const grossRow = addTotal(
    t.discount > 0 ? "Сумма:" : `Всего${quote.vat_enabled ? ", без НДС" : ""}:`,
    sumRangeFormula(allSumRows),
    t.gross,
  );
  let subtotalRow = grossRow;
  if (t.discount > 0) {
    const discountRow = addTotal(
      quote.discount_type === "percent" ? `Скидка ${quote.discount_value}%:` : "Скидка:",
      quote.discount_type === "percent"
        ? `-${sumCol}${grossRow}*${quote.discount_value / 100}`
        : `-${t.discount}`,
      -t.discount,
    );
    subtotalRow = addTotal(
      `Всего${quote.vat_enabled ? ", без НДС" : ""}:`,
      `${sumCol}${grossRow}+${sumCol}${discountRow}`,
      t.subtotal,
    );
  }

  let vatRow = 0;
  if (quote.vat_enabled) {
    vatRow = addTotal(`НДС ${quote.vat_rate}%:`, `${sumCol}${subtotalRow}*${quote.vat_rate / 100}`, t.vat);
  }
  addTotal(
    `Итого${quote.vat_enabled ? ", с НДС" : ""}:`,
    vatRow ? `${sumCol}${subtotalRow}+${sumCol}${vatRow}` : `${sumCol}${subtotalRow}`,
    t.totalWithVat,
    true,
  );
  void totalsStart;

  if (quote.footer_note) {
    ws.addRow([]);
    const r = ws.addRow([quote.footer_note]);
    ws.mergeCells(`A${r.number}:${lastCol}${r.number}`);
    r.getCell(1).alignment = { wrapText: true };
  }

  return wb;
}

export async function exportPromoQuoteXlsx(quote: PromoQuote, items: PromoItem[]): Promise<void> {
  const wb = await buildPromoWorkbook(quote, items);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, promoFileName(quote, "xlsx"));
}
