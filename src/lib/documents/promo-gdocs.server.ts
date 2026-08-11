// Промо-КП в Google Документах: та же вёрстка, что в HTML-превью и PDF —
// логотип, реквизиты, мета-блок, таблица с акцентной шапкой и разделами,
// блок итогов и примечание. Документ также читается обратно.
import {
  batchUpdate,
  createDoc,
  clearDoc,
  getDoc,
  type GDocElement,
} from "@/lib/documents/gdocs-gateway.server";
import { buildDocLayout, docMoney } from "@/lib/documents/doc-layout";
import { hexToRgb01 } from "@/lib/documents/brand";
import { resolveDocFont } from "@/lib/documents/doc-font";
import type { PromoItem, PromoQuote } from "@/lib/promo-quote-model";

export type PromoDocOptions = { companyLine?: string };

const PAGE_MARGIN_PT = 36;
const CONTENT_WIDTH_PT = 595.28 - PAGE_MARGIN_PT * 2;

const rgb = (hex: string) => {
  const c = hexToRgb01(hex);
  return { color: { rgbColor: { red: c.r, green: c.g, blue: c.b } } };
};

const ALIGN: Record<string, string> = { left: "START", center: "CENTER", right: "END" };

export async function createPromoDoc(title: string) {
  return createDoc(title);
}

/** Перерисовывает документ Google Docs текущим содержимым промо-КП. */
export async function renderPromoToDoc(
  documentId: string,
  quote: PromoQuote,
  items: PromoItem[],
  opts: PromoDocOptions = {},
): Promise<void> {
  const layout = buildDocLayout(quote, items, { companyLine: opts.companyLine });
  const font = resolveDocFont(quote.font_family) === "ubuntu" ? "Ubuntu" : "Inter";
  const cols = layout.columns;
  const width = cols.length;

  await clearDoc(documentId);

  // 1) Поля страницы — как в печатном пресете.
  await batchUpdate(documentId, [
    {
      updateDocumentStyle: {
        documentStyle: {
          marginTop: { magnitude: PAGE_MARGIN_PT, unit: "PT" },
          marginBottom: { magnitude: PAGE_MARGIN_PT, unit: "PT" },
          marginLeft: { magnitude: PAGE_MARGIN_PT, unit: "PT" },
          marginRight: { magnitude: PAGE_MARGIN_PT, unit: "PT" },
        },
        fields: "marginTop,marginBottom,marginLeft,marginRight",
      },
    },
  ]);

  // 2) Шапка: строка реквизитов, номер КП, мета-поля.
  const headLines: Array<{ text: string; size: number; bold: boolean }> = [];
  if (layout.companyLine) headLines.push({ text: layout.companyLine, size: 8.5, bold: false });
  headLines.push({ text: layout.docTitle, size: 14, bold: true });
  for (const m of layout.meta) headLines.push({ text: m, size: 9, bold: false });

  const headText = `\n${headLines.map((l) => l.text).join("\n")}\n`;
  await batchUpdate(documentId, [{ insertText: { location: { index: 1 }, text: headText } }]);

  const styleReqs: unknown[] = [];
  let cursor = 2; // после первого перевода строки (там будет логотип)
  for (const l of headLines) {
    styleReqs.push({
      updateTextStyle: {
        range: { startIndex: cursor, endIndex: cursor + l.text.length },
        textStyle: {
          bold: l.bold,
          fontSize: { magnitude: l.size, unit: "PT" },
          weightedFontFamily: { fontFamily: font },
        },
        fields: "bold,fontSize,weightedFontFamily",
      },
    });
    cursor += l.text.length + 1;
  }
  await batchUpdate(documentId, styleReqs);

  // 3) Логотипы в первой строке документа.
  const logos = layout.logos;
  for (const uri of [...logos].reverse()) {
    try {
      await batchUpdate(documentId, [
        {
          insertInlineImage: {
            location: { index: 1 },
            uri,
            objectSize: { height: { magnitude: 46, unit: "PT" } },
          },
        },
      ]);
    } catch (e) {
      console.warn("[gdocs] логотип не вставлен:", (e as Error).message);
    }
  }

  // 4) Таблица позиций.
  const grid: string[][] = [cols.map((c) => c.label)];
  /** Длина основного наименования в ячейке (для отдельного стиля состава). */
  const titleHead: number[] = [0];
  for (const r of layout.rows) {
    const title = r.cells.title ?? "";
    titleHead.push(title.length);
    grid.push(
      cols.map((c) =>
        c.key === "title" && r.includes.length ? `${title}\n${r.includes.join("\n")}` : (r.cells[c.key] ?? ""),
      ),
    );
  }
  if (!layout.rows.some((r) => r.kind === "item")) {
    titleHead.push(layout.emptyLabel.length);
    grid.push(cols.map((c, i) => (i === 0 ? layout.emptyLabel : "")));
  }

  await batchUpdate(documentId, [
    { insertTable: { rows: grid.length, columns: width, endOfSegmentLocation: { segmentId: "" } } },
  ]);

  const afterInsert = await getDoc(documentId);
  const table = lastTable(afterInsert.body?.content ?? []);
  if (!table?.table?.tableRows) throw new Error("Не удалось создать таблицу в документе");
  const tableStart = table.startIndex ?? 1;
  const cellStarts = table.table.tableRows.map((r) => (r.tableCells ?? []).map((c) => c.startIndex ?? 0));

  const fill: unknown[] = [];
  for (let r = grid.length - 1; r >= 0; r -= 1) {
    for (let c = width - 1; c >= 0; c -= 1) {
      const text = grid[r]?.[c] ?? "";
      const at = cellStarts[r]?.[c];
      if (!text || at == null) continue;
      fill.push({ insertText: { location: { index: at + 1 }, text } });
    }
  }
  await batchUpdate(documentId, fill);

  // 5) Оформление таблицы: ширины, заливки, выравнивание, кегль.
  const styling: unknown[] = [];
  cols.forEach((c, i) => {
    styling.push({
      updateTableColumnProperties: {
        tableStartLocation: { index: tableStart },
        columnIndices: [i],
        tableColumnProperties: {
          widthType: "FIXED_WIDTH",
          width: { magnitude: Math.round(c.width * CONTENT_WIDTH_PT * 10) / 10, unit: "PT" },
        },
        fields: "widthType,width",
      },
    });
  });

  const rowBg = (rowIndex: number, hex: string) =>
    styling.push({
      updateTableCellStyle: {
        tableRange: {
          tableCellLocation: { tableStartLocation: { index: tableStart }, rowIndex, columnIndex: 0 },
          rowSpan: 1,
          columnSpan: width,
        },
        tableCellStyle: { backgroundColor: rgb(hex) },
        fields: "backgroundColor",
      },
    });

  rowBg(0, layout.accent);
  layout.rows.forEach((r, i) => {
    if (r.kind === "section") rowBg(i + 1, "#e7e7ea");
    else if (r.kind === "subtotal") rowBg(i + 1, "#f4f4f6");
    else if (r.kind === "extra") rowBg(i + 1, "#fbfbfc");
  });

  const fresh = await getDoc(documentId);
  const freshTable = lastTable(fresh.body?.content ?? []);
  const freshRows = freshTable?.table?.tableRows ?? [];
  freshRows.forEach((row, rIdx) => {
    (row.tableCells ?? []).forEach((cell, cIdx) => {
      const col = cols[cIdx];
      if (!col) return;
      const start = cell.startIndex ?? 0;
      const end = cell.endIndex ?? start + 1;
      if (end <= start + 1) return;
      const layoutRow = rIdx === 0 ? null : layout.rows[rIdx - 1];
      const bold = rIdx === 0 || layoutRow?.kind === "section" || layoutRow?.kind === "subtotal";
      styling.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          paragraphStyle: {
            alignment: rIdx === 0 ? "CENTER" : ALIGN[col.align],
            spaceAbove: { magnitude: 1, unit: "PT" },
            spaceBelow: { magnitude: 1, unit: "PT" },
          },
          fields: "alignment,spaceAbove,spaceBelow",
        },
      });
      styling.push({
        updateTextStyle: {
          range: { startIndex: start + 1, endIndex: end - 1 },
          textStyle: {
            bold,
            italic: layoutRow?.kind === "extra",
            fontSize: { magnitude: 8.5, unit: "PT" },
            weightedFontFamily: { fontFamily: font },
          },
          fields: "bold,italic,fontSize,weightedFontFamily",
        },
      });
      // Состав позиции — мельче и серым, как в превью.
      const inc = col.key === "title" ? (layoutRow?.includes ?? []) : [];
      if (inc.length) {
        const incStart = start + 1 + (titleHead[rIdx] ?? 0);
        if (incStart < end - 1) {
          styling.push({
            updateTextStyle: {
              range: { startIndex: incStart, endIndex: end - 1 },
              textStyle: {
                bold: false,
                italic: false,
                fontSize: { magnitude: 7.5, unit: "PT" },
                foregroundColor: rgb("#6b6b73"),
                weightedFontFamily: { fontFamily: font },
              },
              fields: "bold,italic,fontSize,foregroundColor,weightedFontFamily",
            },
          });
        }
      }
    });
  });
  await batchUpdate(documentId, styling);

  // 6) Итоги и примечание после таблицы.
  const totalsLines = layout.totals.map(
    (t) => `${t.label}: ${t.sign === "minus" ? "− " : ""}${docMoney(t.value)}${t.grand ? ` ${quote.currency}` : ""}`,
  );
  const totalsText = `\n${totalsLines.join("\n")}\n`;
  const noteText = layout.footerNote ? `\n${layout.footerNote}\n` : "";
  await batchUpdate(documentId, [
    { insertText: { endOfSegmentLocation: { segmentId: "" }, text: totalsText + noteText } },
  ]);

  const withTail = await getDoc(documentId);
  const content = withTail.body?.content ?? [];
  const docEnd = content.length ? (content[content.length - 1]!.endIndex ?? 2) : 2;
  const tailStart = Math.max(1, docEnd - (totalsText.length + noteText.length));
  const totalsEnd = Math.max(tailStart + 1, tailStart + totalsText.length - 1);
  const tail: unknown[] = [
    {
      updateParagraphStyle: {
        range: { startIndex: tailStart, endIndex: totalsEnd },
        paragraphStyle: { alignment: "END" },
        fields: "alignment",
      },
    },
    {
      updateTextStyle: {
        range: { startIndex: tailStart, endIndex: totalsEnd },
        textStyle: {
          fontSize: { magnitude: 9.5, unit: "PT" },
          bold: true,
          weightedFontFamily: { fontFamily: font },
        },
        fields: "fontSize,bold,weightedFontFamily",
      },
    },
  ];
  if (noteText) {
    const noteStart = tailStart + totalsText.length;
    const noteEnd = Math.max(noteStart + 1, docEnd - 1);
    tail.push(
      {
        updateParagraphStyle: {
          range: { startIndex: noteStart, endIndex: noteEnd },
          paragraphStyle: { alignment: "START" },
          fields: "alignment",
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: noteStart, endIndex: noteEnd },
          textStyle: {
            fontSize: { magnitude: 8.5, unit: "PT" },
            bold: false,
            italic: true,
            foregroundColor: rgb("#6b6b73"),
            weightedFontFamily: { fontFamily: font },
          },
          fields: "fontSize,bold,italic,foregroundColor,weightedFontFamily",
        },
      },
    );
  }
  await batchUpdate(documentId, tail);
}

function lastTable(content: GDocElement[]) {
  for (let i = content.length - 1; i >= 0; i -= 1) if (content[i]?.table) return content[i]!;
  return null;
}

/** Текст ячейки документа. */
function cellText(cell: unknown): string {
  const c = cell as { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
  return (c.content ?? [])
    .flatMap((el) => el.paragraph?.elements ?? [])
    .map((e) => e.textRun?.content ?? "")
    .join("")
    .replace(/\u000b/g, " ")
    .trim();
}

export type PromoDocParsedRow = {
  section: string;
  title: string;
  unit: string;
  qty: number;
  multiplier: number;
  price: number;
  note: string;
  rate_unit: string;
};

const toNum = (v: string) => {
  const n = Number(String(v).replace(/[\s\u00a0]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Читает таблицу документа обратно: позиции, разделы, значения. */
export async function readPromoDocRows(documentId: string): Promise<PromoDocParsedRow[]> {
  const doc = await getDoc(documentId);
  const table = lastTable(doc.body?.content ?? []);
  const rows = (table?.table?.tableRows ?? []) as Array<{ tableCells?: unknown[] }>;
  if (!rows.length) return [];

  const header = (rows[0]!.tableCells ?? []).map((c) => cellText(c));
  const idx = (label: string) => header.findIndex((h) => h.toLowerCase().startsWith(label.toLowerCase()));
  // Заголовки второй единицы теперь такие же («Ед. изм.» / «Кол-во»), поэтому
  // колонки различаем по порядку вхождения, а не по тексту.
  const all = (label: string) =>
    header.reduce<number[]>((acc, h, i) => {
      if (h.toLowerCase().startsWith(label.toLowerCase())) acc.push(i);
      return acc;
    }, []);
  const units = all("Ед. изм");
  const qtys = all("Кол-во");
  const iTitle = Math.max(0, idx("Наименование"));
  const iUnit = units[0] ?? -1;
  const iQty = qtys[0] ?? -1;
  const iRateUnit = units[1] ?? -1;
  const iMul = qtys[1] ?? -1;
  const iPrice = idx("Цена");
  const iNote = idx("Примеч");

  const out: PromoDocParsedRow[] = [];
  let section = "";
  for (let r = 1; r < rows.length; r += 1) {
    const cells = (rows[r]!.tableCells ?? []).map((c) => cellText(c));
    // Состав позиции — отдельные абзацы в той же ячейке, берём только наименование.
    const title = (cells[iTitle] ?? "").split("\n")[0]!.trim();
    if (!title || title === "Позиции не добавлены") continue;
    const filled = cells.filter(Boolean).length;
    if (filled === 1) {
      // Одинокая ячейка — строка раздела.
      if (!title.startsWith("Итого по разделу")) section = title;
      continue;
    }
    if (title.startsWith("Итого по разделу")) continue;
    const dash = (v: string) => (v.trim() === "—" ? "" : v);
    const priceStr = iPrice >= 0 ? dash(cells[iPrice] ?? "") : "";
    const qtyStr = iQty >= 0 ? dash(cells[iQty] ?? "") : "";
    if (!priceStr && !qtyStr) continue; // служебные строки (управление, комиссия, НДС)
    out.push({
      section,
      title,
      unit: (iUnit >= 0 ? dash(cells[iUnit] ?? "") : "") || "услуга",
      qty: toNum(qtyStr),
      multiplier: iMul >= 0 ? toNum(dash(cells[iMul] ?? "")) || 1 : 1,
      price: toNum(priceStr),
      note: (iNote >= 0 ? dash(cells[iNote] ?? "") : "") ?? "",
      rate_unit: iRateUnit >= 0 ? dash(cells[iRateUnit] ?? "").trim() : "",
    });
  }
  return out;
}
