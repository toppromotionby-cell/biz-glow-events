// Внутренняя выгрузка расчёта себестоимости и маржи в XLSX (только в браузере).
// Формулы живые: выручка, себестоимость и маржа пересчитываются в Excel.
import type { Economics } from "@/lib/documents/economics";

const MONEY = "#,##0.00;(#,##0.00);-";
const PCT = "0.0%";

export async function exportEconomicsXlsx(docTitle: string, econ: Economics): Promise<void> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Расчёт");
  ws.properties.defaultRowHeight = 18;
  ws.columns = [
    { header: "Позиция", key: "title", width: 46 },
    { header: "Кол-во", key: "qty", width: 12 },
    { header: "Цена", key: "price", width: 14 },
    { header: "Себест./ед.", key: "unitCost", width: 14 },
    { header: "Выручка", key: "revenue", width: 14 },
    { header: "Себестоимость", key: "cost", width: 16 },
    { header: "Маржа", key: "margin", width: 14 },
    { header: "Маржа, %", key: "marginPct", width: 12 },
  ];

  const title = ws.addRow([docTitle]);
  title.font = { name: "Arial", size: 13, bold: true };
  ws.mergeCells(title.number, 1, title.number, 8);
  const note = ws.addRow(["Внутренний расчёт. Не передаётся клиенту."]);
  note.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF808080" } };
  ws.addRow([]);

  const head = ws.addRow(ws.columns.map((c) => String(c.header)));
  head.font = { name: "Arial", bold: true };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    c.border = { bottom: { style: "thin" } };
  });

  const dataRows: number[] = [];
  for (const section of econ.sections) {
    const sec = ws.addRow([section.name]);
    sec.font = { name: "Arial", bold: true };
    sec.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
    const first = ws.rowCount + 1;

    for (const r of section.rows) {
      const row = ws.addRow([
        r.title || "Без названия",
        r.qty,
        r.price,
        r.unitCost,
        null,
        null,
        null,
        null,
      ]);
      const n = row.number;
      row.getCell(5).value = { formula: `B${n}*C${n}` };
      row.getCell(6).value = { formula: `B${n}*D${n}` };
      row.getCell(7).value = { formula: `E${n}-F${n}` };
      row.getCell(8).value = { formula: `IF(E${n}=0,0,G${n}/E${n})` };
      row.font = { name: "Arial" };
      [3, 4, 5, 6, 7].forEach((i) => (row.getCell(i).numFmt = MONEY));
      row.getCell(8).numFmt = PCT;
      if (!r.excluded) dataRows.push(n);
    }

    const last = ws.rowCount;
    if (last >= first) {
      const sub = ws.addRow(["Итого по разделу"]);
      const n = sub.number;
      sub.getCell(5).value = { formula: `SUM(E${first}:E${last})` };
      sub.getCell(6).value = { formula: `SUM(F${first}:F${last})` };
      sub.getCell(7).value = { formula: `E${n}-F${n}` };
      sub.getCell(8).value = { formula: `IF(E${n}=0,0,G${n}/E${n})` };
      sub.font = { name: "Arial", bold: true };
      [5, 6, 7].forEach((i) => (sub.getCell(i).numFmt = MONEY));
      sub.getCell(8).numFmt = PCT;
    }
    ws.addRow([]);
  }

  const sum = (col: string) => dataRows.map((n) => `${col}${n}`).join(",") || "0";
  const total = ws.addRow(["ИТОГО"]);
  const t = total.number;
  total.getCell(5).value = { formula: `SUM(${sum("E")})` };
  total.getCell(6).value = { formula: `SUM(${sum("F")})` };
  total.getCell(7).value = { formula: `E${t}-F${t}` };
  total.getCell(8).value = { formula: `IF(E${t}=0,0,G${t}/E${t})` };
  total.font = { name: "Arial", bold: true };
  [5, 6, 7].forEach((i) => (total.getCell(i).numFmt = MONEY));
  total.getCell(8).numFmt = PCT;

  const net = ws.addRow(["Выручка по итогу документа", null, null, null, econ.netRevenue]);
  const nrow = net.number;
  net.getCell(6).value = { formula: `F${t}` };
  net.getCell(7).value = { formula: `E${nrow}-F${nrow}` };
  net.getCell(8).value = { formula: `IF(E${nrow}=0,0,G${nrow}/E${nrow})` };
  net.font = { name: "Arial", bold: true };
  [5, 6, 7].forEach((i) => (net.getCell(i).numFmt = MONEY));
  net.getCell(8).numFmt = PCT;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${docTitle.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80)} — расчёт.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
