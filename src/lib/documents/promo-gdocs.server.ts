// Экспорт промо-КП в Google Документы: тот же состав и порядок блоков, что и в
// живом превью (шапка, мета, таблица позиций, итоги, подвал). Колонки «Ед. 2» и
// «Кол-во 2» появляются только если вторая единица заполнена хотя бы у одной позиции.
import {
  batchUpdate,
  clearDoc,
  createDoc,
  getDoc,
  type GDocElement,
} from "@/lib/documents/gdocs-gateway.server";
import {
  computePromoTotals,
  formatNumber,
  groupBySection,
  hasSecondUnit,
  lineQty,
  lineTotal,
  promoNumberDisplay,
  rateUnitLabel,
  soleRateUnit,
  type PromoItem,
  type PromoQuote,
} from "@/lib/promo-quote-model";

const nf = (v: number) => v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type PromoDocOptions = { companyLine?: string; fontFamily?: string };

/** Строки таблицы: первая — заголовок, дальше разделы и позиции. */
function buildGrid(quote: PromoQuote, items: PromoItem[]) {
  const t = computePromoTotals(quote, items);
  const dual = hasSecondUnit(items);
  const rateUnit = soleRateUnit(items);

  const header = ["Наименование", "Ед. изм."];
  if (quote.show_qty) header.push("Кол-во");
  if (dual) header.push("Ед. 2", "Кол-во 2");
  if (quote.show_total_qty) header.push("Всего");
  header.push(rateUnit ? `Цена за ${rateUnit}` : "Цена за ед.");
  header.push(`Всего${t.vatMode === "add" ? ", без НДС" : t.vatMode === "included" ? ", с НДС" : ""}`);
  if (quote.show_notes) header.push("Примечания");

  const width = header.length;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = [header];
  const boldRows: number[] = [0];

  for (const sec of groupBySection(items)) {
    if (sec.name) {
      const r = blank();
      r[0] = sec.name;
      boldRows.push(rows.length);
      rows.push(r);
    }
    for (const it of sec.items) {
      const cells: string[] = [it.title.trim() || "Новая позиция", it.unit];
      if (quote.show_qty) cells.push(formatNumber(it.qty));
      if (dual) {
        const ru = rateUnitLabel(it);
        cells.push(ru || "—", ru ? formatNumber(it.multiplier) : "—");
      }
      if (quote.show_total_qty) cells.push(formatNumber(lineQty(it)));
      cells.push(it.price ? nf(it.price) : "");
      cells.push(lineTotal(it) ? nf(lineTotal(it)) : "");
      if (quote.show_notes) cells.push(it.note);
      rows.push(cells);
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      const r = blank();
      r[0] = `Итого по разделу «${sec.name}»`;
      r[width - (quote.show_notes ? 2 : 1)] = nf(sec.items.reduce((s, it) => s + lineTotal(it), 0));
      boldRows.push(rows.length);
      rows.push(r);
    }
  }

  if (quote.management_enabled) {
    const r = blank();
    r[0] = quote.management_label;
    r[1] = "услуга";
    r[width - (quote.show_notes ? 2 : 1)] = nf(t.management);
    rows.push(r);
  }
  if (quote.commission_enabled) {
    const r = blank();
    r[0] = quote.commission_label;
    r[width - (quote.show_notes ? 2 : 1)] = nf(t.commission);
    rows.push(r);
  }

  return { rows, boldRows, totals: t, width };
}

function headerText(quote: PromoQuote, opts: PromoDocOptions): string {
  const lines: string[] = [];
  if (opts.companyLine) lines.push(opts.companyLine);
  lines.push(`Коммерческое предложение № ${promoNumberDisplay(quote)}`);
  if (quote.project) lines.push(`Проект: ${quote.project}`);
  if (quote.client_name) lines.push(`Клиент: ${quote.client_name}`);
  if (quote.period) lines.push(`Период: ${quote.period}`);
  if (quote.venue) lines.push(`Место проведения: ${quote.venue}`);
  if (quote.valid_until)
    lines.push(
      `Предложение действительно до: ${new Date(`${quote.valid_until}T00:00:00`).toLocaleDateString("ru-RU")}`,
    );
  const contact = [quote.contact_name, quote.contact_role].filter(Boolean).join(", ");
  if (contact || quote.contact_phone || quote.contact_email)
    lines.push(
      `Контактное лицо: ${contact}${quote.contact_phone ? `; ${quote.contact_phone}` : ""}${
        quote.contact_email ? `; ${quote.contact_email}` : ""
      }`,
    );
  return lines.join("\n") + "\n";
}

function footerText(quote: PromoQuote, t: ReturnType<typeof computePromoTotals>): string {
  const lines: string[] = [];
  if (t.discount > 0) lines.push(`Скидка: − ${nf(t.discount)}`);
  lines.push(`${t.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего"}: ${nf(t.net)}`);
  if (t.vatEnabled) lines.push(`НДС ${t.vatRate}%: ${nf(t.vat)}`);
  lines.push(`Итого${t.vatEnabled ? ", с НДС" : ""}: ${nf(t.totalWithVat)} ${quote.currency}`);
  if (quote.footer_note) lines.push("", quote.footer_note);
  return "\n" + lines.join("\n") + "\n";
}

function lastTable(content: GDocElement[]) {
  for (let i = content.length - 1; i >= 0; i -= 1) if (content[i]?.table) return content[i]!;
  return null;
}

/** Перезаписывает документ Google Docs текущим содержимым промо-КП. */
export async function renderPromoToDoc(
  documentId: string,
  quote: PromoQuote,
  items: PromoItem[],
  opts: PromoDocOptions = {},
): Promise<void> {
  const font = opts.fontFamily || "Ubuntu";
  const { rows, boldRows, totals, width } = buildGrid(quote, items);

  await clearDoc(documentId);

  // 1) Шапка и мета.
  const head = headerText(quote, opts);
  await batchUpdate(documentId, [{ insertText: { location: { index: 1 }, text: head } }]);

  // 2) Пустая таблица нужного размера в конце документа.
  await batchUpdate(documentId, [
    { insertTable: { rows: rows.length, columns: width, endOfSegmentLocation: { segmentId: "" } } },
  ]);

  // 3) Заполняем ячейки с конца — тогда индексы предыдущих ячеек не смещаются.
  const doc = await getDoc(documentId);
  const table = lastTable(doc.body?.content ?? []);
  if (!table?.table?.tableRows) throw new Error("Не удалось создать таблицу в документе");
  const cellStarts = table.table.tableRows.map((r) => (r.tableCells ?? []).map((c) => c.startIndex ?? 0));

  const fill: unknown[] = [];
  for (let r = rows.length - 1; r >= 0; r -= 1) {
    for (let c = width - 1; c >= 0; c -= 1) {
      const text = rows[r]?.[c] ?? "";
      const at = cellStarts[r]?.[c];
      if (!text || at == null) continue;
      fill.push({ insertText: { location: { index: at + 1 }, text } });
      if (boldRows.includes(r))
        fill.push({
          updateTextStyle: {
            range: { startIndex: at + 1, endIndex: at + 1 + text.length },
            textStyle: { bold: true },
            fields: "bold",
          },
        });
    }
  }
  await batchUpdate(documentId, fill);

  // 4) Итоги и подвал после таблицы.
  await batchUpdate(documentId, [
    {
      insertText: {
        endOfSegmentLocation: { segmentId: "" },
        text: footerText(quote, totals),
      },
    },
  ]);

  // 5) Единый шрифт и компактный кегль на весь документ — как в превью.
  const fresh = await getDoc(documentId);
  const content = fresh.body?.content ?? [];
  const end = content.length ? (content[content.length - 1]!.endIndex ?? 2) : 2;
  if (end > 2)
    await batchUpdate(documentId, [
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: end - 1 },
          textStyle: {
            weightedFontFamily: { fontFamily: font },
            fontSize: { magnitude: 9, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
    ]);
}

export async function createPromoDoc(title: string) {
  return createDoc(title);
}
