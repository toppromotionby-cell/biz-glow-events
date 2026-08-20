// HTML-рендер промо-КП: используется и для live-превью в админке, и для страницы документа.
import { docColumnWidths, PRICE_LABEL } from "@/lib/documents/doc-layout";
import { logoImgStyle, logoWrapStyle, requisitesStyle } from "@/lib/documents/logo-layout";
import { fontCssVars, fontLinkTags, resolveDocFont } from "@/lib/documents/doc-font";
import { vatRateLabel } from "@/lib/documents/vat";

import { BRAND_ACCENT } from "@/lib/documents/brand";
import { autoFitScript, densityRootVars, DENSITY_PAGE_CSS } from "@/lib/documents/density";
import { BASE_PRINT_PRESET, printPageMarginCss } from "@/lib/documents/print-preset";
import { sheetCss } from "@/lib/documents/sheet";
import { softHyphenate } from "@/lib/documents/hyphenate";

import {
  computePromoTotals,
  formatMoney,
  groupBySection,
  hasSecondUnit,
  isServiceOnlyRow,
  formatNumber,
  rateUnitLabel,
  formatQty,
  formatTotalQty,
  lineTotal,
  promoNumberDisplay,
  type PromoItem,
  type PromoQuote,
  type PromoCheck,
} from "@/lib/promo-quote-model";

/** esc + мягкие переносы: для видимого текста в ячейках. */
function escw(s: unknown): string {
  return softHyphenate(esc(s));
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nf(n: number): string {
  return new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function buildPromoQuoteBody(
  quote: PromoQuote,
  items: PromoItem[],
  opts: { editable?: boolean; companyLine?: string; checks?: PromoCheck[]; fontDefault?: unknown } = {},
): string {
  const editable = opts.editable === true;
  const docFont = resolveDocFont(quote.font_family, opts.fontDefault);
  // Инлайн-предупреждения превью: привязаны к индексу позиции, в печать не идут.
  const allChecks = opts.checks ?? [];
  const checksByIndex = new Map<number, PromoCheck[]>();
  for (const ch of allChecks) {
    if (ch.itemIndex == null) continue;
    if (!checksByIndex.has(ch.itemIndex)) checksByIndex.set(ch.itemIndex, []);
    checksByIndex.get(ch.itemIndex)!.push(ch);
  }
  const globalChecks = allChecks.filter((c) => c.itemIndex == null);
  const chkList = (list: PromoCheck[]) =>
    list.length
      ? `<div class="chk-list">${list
          .map(
            (ch) =>
              `<span class="chk chk-${ch.level}" title="${esc(ch.message)}"><span class="chk-ic">${
                ch.level === "error" ? "!" : "?"
              }</span>${esc(ch.message)}</span>`,
          )
          .join("")}</div>`
      : "";


  /** Метка редактируемой зоны — только для live-превью в админке. */
  const ed = (target: string, id?: string, label?: string) =>
    editable
      ? ` data-edit="${esc(target)}"${id != null ? ` data-edit-id="${esc(id)}"` : ""}${label ? ` data-edit-label="${esc(label)}"` : ""}`
      : "";
  const t = computePromoTotals(quote, items);
  const sections = groupBySection(items);
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(quote.accent_color) ? quote.accent_color : BRAND_ACCENT;

  // Вторая единица («час», «смена») показывается отдельными колонками — только
  // если она заполнена хотя бы у одной позиции. Иначе таблица как раньше.
  const dual = hasSecondUnit(items);

  const cols: Array<{ label: string; cls: string }> = [{ label: "Наименование", cls: "c-title" }];
  cols.push({ label: "Ед. изм.", cls: "c-unit" });
  if (quote.show_qty) cols.push({ label: "Кол-во", cls: "c-num" });
  if (dual) {
    cols.push({ label: "Ед. изм.", cls: "c-unit" });
    cols.push({ label: "Кол-во", cls: "c-num" });
  }
  if (quote.show_total_qty) cols.push({ label: "Всего", cls: "c-num" });
  cols.push({ label: PRICE_LABEL, cls: "c-money" });
  cols.push({ label: `Всего${t.vatMode === "add" ? ", без НДС" : t.vatMode === "included" ? ", с НДС" : ""}`, cls: "c-money" });
  if (quote.show_notes) cols.push({ label: "Примечания", cls: "c-note" });

  /** Сколько колонок занимает блок единиц/количеств («Ед. изм.» + «Кол-во» ×2). */
  const unitSpan = 1 + (quote.show_qty ? 1 : 0) + (dual ? 2 : 0);
  /** Объединённая ячейка «услуга» вместо пустых единиц и количеств. */
  const mergedUnitCell = (label: string) =>
    `<td class="c-unit"${unitSpan > 1 ? ` colspan="${unitSpan}"` : ""}>${esc(label)}</td>`;

  /** Ячейки «Ед. изм. … Всего» для служебных строк (управление, комиссия, НДС). */
  const midCells = (unit: string) =>
    (unit === "услуга"
      ? mergedUnitCell(unit)
      : `<td class="c-unit">${esc(unit)}</td>` +
        (quote.show_qty ? '<td class="c-num">—</td>' : "") +
        (dual ? '<td class="c-unit">—</td><td class="c-num">—</td>' : "")) +
    (quote.show_total_qty ? '<td class="c-num">—</td>' : "");


  const colCount = cols.length;
  // Ширины колонок берём из общего макета документа — те же доли, что в PDF.
  const colWidths = docColumnWidths(quote, items);

  const rowsHtml = sections
    .map((sec) => {
      const head = sec.name
        ? `<tr class="sec"${ed("section", sec.name, "Раздел")}><td colspan="${colCount}">${escw(sec.name)}</td></tr>`
        : "";
      const body = sec.items
        .map((it) => {
          const inc =
            quote.show_item_includes && it.includes.length
              ? `<ul class="c-inc">${it.includes
                  .map((x) => `<li>${escw(x.text)}${x.note ? ` — ${escw(x.note)}` : ""}</li>`)
                  .join("")}</ul>`
              : "";
          const rowChecks = checksByIndex.get(items.indexOf(it)) ?? [];
          const rowCls = rowChecks.some((c) => c.level === "error")
            ? " chk-row chk-row-error"
            : rowChecks.length
              ? " chk-row chk-row-warn"
              : "";
          const cells: string[] = [
            `<td class="c-title">${it.title.trim() ? esc(it.title) : '<span class="c-empty">Новая позиция</span>'}${inc}${chkList(rowChecks)}</td>`,
          ];
          if (isServiceOnlyRow(it)) {
            cells.push(mergedUnitCell(it.unit.trim() || "услуга"));
          } else {
            cells.push(`<td class="c-unit">${esc(it.unit)}</td>`);
            if (quote.show_qty)
              cells.push(`<td class="c-num">${esc(dual ? formatNumber(it.qty) : formatQty(it))}</td>`);
            if (dual) {
              const ru = rateUnitLabel(it);
              cells.push(`<td class="c-unit">${ru ? esc(ru) : "—"}</td>`);
              cells.push(`<td class="c-num">${ru ? esc(formatNumber(it.multiplier)) : "—"}</td>`);
            }
          }
          if (quote.show_total_qty) cells.push(`<td class="c-num">${esc(formatTotalQty(it))}</td>`);
          cells.push(`<td class="c-money">${it.price ? nf(it.price) : ""}</td>`);
          cells.push(`<td class="c-money">${lineTotal(it) ? nf(lineTotal(it)) : ""}</td>`);
          if (quote.show_notes) cells.push(`<td class="c-note">${esc(it.note)}</td>`);
          return `<tr class="${rowCls.trim()}"${ed("item", it.id, "Позиция")}>${cells.join("")}</tr>`;
        })

        .join("");
      // Подытог: подпись до колонки сумм, сумма — в колонке «Всего».
      const amountIdx = colCount - (quote.show_notes ? 2 : 1);
      const sub =
        quote.show_section_subtotals && sec.name && sec.items.length > 1
          ? `<tr class="sec-sub"><td colspan="${amountIdx}">Итого по разделу «${esc(sec.name)}»</td><td class="c-money">${nf(
              sec.items.reduce((s, it) => s + lineTotal(it), 0),
            )}</td>${quote.show_notes ? '<td class="c-note"></td>' : ""}</tr>`
          : "";

      return head + body + sub;

    })
    .join("");

  const extraRows: string[] = [];
  if (quote.management_enabled) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(quote.management_label)}</td>${midCells("услуга")}<td class="c-money"></td><td class="c-money">${nf(
        t.management,
      )}</td>${quote.show_notes ? '<td class="c-note"></td>' : ""}</tr>`,
    );
  }
  if (quote.commission_enabled) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(quote.commission_label)}</td>${midCells("—")}<td class="c-money"></td><td class="c-money">${nf(
        t.commission,
      )}</td>${quote.show_notes ? `<td class="c-note">${nf(quote.commission_rate).replace(",00", "")} %</td>` : ""}</tr>`,
    );
  }

  if (t.vatEnabled && quote.vat_as_line) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(
        t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
      )}</td>${midCells("—")}<td class="c-money"></td><td class="c-money">${nf(t.vat)}</td>${quote.show_notes ? '<td class="c-note"></td>' : ""}</tr>`,
    );
  }

  const totalsRows = [
    t.discount > 0
      ? `<tr class="total"><td class="lbl">Скидка${
          quote.discount_type === "percent" ? ` ${nf(quote.discount_value).replace(",00", "")}%` : ""
        }:</td><td class="val">− ${nf(t.discount)}</td></tr>`
      : "",
    `<tr class="total"><td class="lbl">${t.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего"}:</td><td class="val">${nf(t.net)}</td></tr>`,
    t.vatEnabled
      ? `<tr class="total"><td class="lbl">НДС ${vatRateLabel(t.vatRate)}%:</td><td class="val">${nf(t.vat)}</td></tr>`
      : "",
    `<tr class="total grand"><td class="lbl">Итого${t.vatEnabled ? ", с НДС" : ""}:</td><td class="val">${nf(
      t.totalWithVat,
    )} ${esc(quote.currency)}</td></tr>`,
  ].join("");

  const validUntilText = quote.valid_until
    ? new Date(`${quote.valid_until}T00:00:00`).toLocaleDateString("ru-RU")
    : "";

  const meta = [
    quote.project ? `<div><b>Проект:</b> ${esc(quote.project)}</div>` : "",
    quote.client_name ? `<div><b>Клиент:</b> ${esc(quote.client_name)}</div>` : "",
    quote.period ? `<div><b>Период:</b> ${esc(quote.period)}</div>` : "",
    quote.venue ? `<div><b>Место проведения:</b> ${esc(quote.venue)}</div>` : "",
    validUntilText ? `<div><b>Предложение действительно до:</b> ${esc(validUntilText)}</div>` : "",
    quote.contact_name || quote.contact_phone || quote.contact_email
      ? `<div><b>Контактное лицо:</b> ${esc(
          [quote.contact_name, quote.contact_role].filter(Boolean).join(", "),
        )}${quote.contact_phone ? `; ${esc(quote.contact_phone)}` : ""}${
          quote.contact_email ? `; ${esc(quote.contact_email)}` : ""
        }</div>`
      : "",
  ].join("");


  return `
<div class="promo-doc" style="--accent:${esc(accent)}; ${fontCssVars(docFont)}">
  <div class="head">
    <div class="meta"${ed("meta", undefined, "Шапка КП")}>${meta}</div>
    <div class="logos">
      ${
        quote.logo_url
          ? `<div class="logo-col" style="${logoWrapStyle(quote.logo_layout)}"><img style="${logoImgStyle(quote.logo_layout)}" src="${esc(quote.logo_url)}" alt="Логотип" />${
              opts.companyLine
                ? `<div class="req" style="${requisitesStyle(opts.companyLine)}">${esc(opts.companyLine)}</div>`
                : ""
            }</div>`
          : opts.companyLine
            ? `<div class="logo-col"><div class="req" style="${requisitesStyle(opts.companyLine)}">${esc(opts.companyLine)}</div></div>`
            : ""
      }

      ${quote.client_logo_url ? `<img src="${esc(quote.client_logo_url)}" alt="Логотип клиента" />` : ""}
    </div>
  </div>

  <div class="docnum">КП № ${esc(promoNumberDisplay(quote))}</div>
  <table class="doc-grid">
    <colgroup>${colWidths.map((c) => `<col style="width:${c.pct}%" />`).join("")}</colgroup>
    <thead><tr>${cols.map((c) => `<th class="${c.cls}">${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="${colCount}" class="empty">Позиции не добавлены</td></tr>`}${extraRows.join("")}</tbody>
  </table>
  <table class="totals"${ed("totals", undefined, "Итоги")}><tbody>${totalsRows}</tbody></table>
  ${chkList(globalChecks)}
  ${
    quote.footer_note
      ? `<div class="footer-note"${ed("footer", undefined, "Примечание")}>${esc(quote.footer_note).replaceAll("\n", "<br/>")}</div>`
      : editable
        ? `<div class="footer-note footer-note-empty"${ed("footer", undefined, "Примечание")}>Добавить примечание</div>`
        : ""
  }
</div>`.trim();
}

export const PROMO_DOC_CSS = `
.promo-doc { font-family: var(--font-body, Inter, "Helvetica Neue", Arial, sans-serif); color: #16161a; font-size: 12px; }
.promo-doc .head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
.promo-doc .meta div { border: 1px solid #d8d8dd; padding: 5px 8px; margin-bottom: -1px; background: #f6f6f7; max-width: 460px; }
.promo-doc .logos { display: flex; gap: 16px; align-items: flex-start; }
.promo-doc .logos img { max-height: 72px; max-width: 100%; object-fit: contain; }
.promo-doc .logo-col { display: block; }
.promo-doc .logo-col .req { margin-top: 4px; font-size: 10px; line-height: 1.35; color: #5a5a63; }

.promo-doc .docnum { font-family: var(--font-display, inherit); margin: 16px 0 8px; font-weight: 700; font-size: 13px; }
.promo-doc table { width: 100%; border-collapse: collapse; }
/* Изоляция от глобальных утилит приложения (Tailwind .grid и т.п.): таблица
   документа должна оставаться настоящей таблицей, иначе colgroup/thead
   перестают задавать ширины и шапка «съезжает» относительно строк. */
.promo-doc table { display: table !important; }
.promo-doc colgroup { display: table-column-group !important; }
.promo-doc col { display: table-column !important; }
.promo-doc thead { display: table-header-group !important; }
.promo-doc tbody { display: table-row-group !important; }
.promo-doc tr { display: table-row !important; }
.promo-doc th, .promo-doc td { display: table-cell !important; }
.promo-doc .doc-grid th { background: var(--accent); color: #16161a; font-weight: 700; text-align: center; border: 1px solid #b9b9bf; padding: 6px 6px; }
.promo-doc .doc-grid td { border: 1px solid #d8d8dd; padding: 5px 6px; vertical-align: middle; }
.promo-doc .doc-grid tr.sec td { background: #e7e7ea; font-weight: 600; }
.promo-doc .doc-grid tr.sec-sub td { background: #f4f4f6; font-weight: 600; text-align: right; }
.promo-doc .c-inc { margin: 3px 0 0; padding-left: 14px; font-size: 11px; color: #5a5a63; }
.promo-doc .doc-grid tr.extra td { background: #fbfbfc; font-style: italic; }
.promo-doc table.doc-grid { table-layout: fixed; }
.promo-doc .doc-grid th, .promo-doc .doc-grid td { hyphens: manual; -webkit-hyphens: manual; overflow-wrap: break-word; word-break: normal; min-width: 0; }
.promo-doc .c-title { text-align: left; }
.promo-doc .c-unit { text-align: center; }
.promo-doc .c-num { text-align: center; font-variant-numeric: tabular-nums; }
.promo-doc .c-money { text-align: center; font-variant-numeric: tabular-nums; }
.promo-doc .c-note { text-align: left; color: #45454d; }
.promo-doc .empty { text-align: center; color: #86868f; padding: 16px; }
.promo-doc .totals { margin-top: 10px; width: 320px; margin-left: auto; }
.promo-doc .totals td { border: 1px solid #b9b9bf; padding: 6px 8px; }
.promo-doc .totals .lbl { font-weight: 700; background: var(--accent); text-align: right; }
.promo-doc .totals .val { text-align: right; white-space: nowrap; background: #fff8ea; }
.promo-doc .totals .grand td { font-size: 13px; }
.promo-doc .footer-note { margin-top: 16px; color: #45454d; font-size: 11px; }
.promo-doc .footer-note-empty { color: #9a9aa2; font-style: italic; }
@media print { .promo-doc .footer-note-empty { display: none; } }
.promo-doc .c-empty { color: #9ca3af; font-style: italic; }
.promo-doc .chk-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.promo-doc .chk { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; line-height: 1.25; padding: 2px 6px; border-radius: 999px; border: 1px solid; }
.promo-doc .chk-ic { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; border-radius: 50%; font-weight: 700; font-size: 9px; color: #fff; }
.promo-doc .chk-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
.promo-doc .chk-error .chk-ic { background: #dc2626; }
.promo-doc .chk-warn { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.promo-doc .chk-warn .chk-ic { background: #d97706; }
.promo-doc tr.chk-row-error td { background: #fef2f2; }
.promo-doc tr.chk-row-warn td { background: #fffbeb; }
@media print { .promo-doc .chk-list { display: none !important; } .promo-doc tr.chk-row td { background: transparent !important; } .promo-doc .c-empty { display: none; } }

[data-edit] { cursor: pointer; }
.promo-doc [data-edit]:hover { outline: 2px solid var(--accent); outline-offset: -2px; }
@media print { .promo-doc [data-edit]:hover { outline: none; } .promo-doc { font-size: 11px; } }
`;

export function buildPromoQuoteHtmlDoc(quote: PromoQuote, items: PromoItem[], companyLine?: string): string {
  const t = computePromoTotals(quote, items);
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>КП ${esc(promoNumberDisplay(quote))} — ${esc(quote.client_name)}</title>
${fontLinkTags(resolveDocFont(quote.font_family))}
<style>
  :root { ${densityRootVars()}; }
  @page { size: A4; margin: ${printPageMarginCss(BASE_PRINT_PRESET)}; }
  body { margin: 0; }
  ${sheetCss(BASE_PRINT_PRESET)}

  ${PROMO_DOC_CSS}

  ${DENSITY_PAGE_CSS}
</style></head>
<body><div class="sheet">${buildPromoQuoteBody(quote, items, { companyLine })}</div>
<!-- Итого: ${formatMoney(t.totalWithVat, quote.currency)} -->
${autoFitScript({ ...BASE_PRINT_PRESET, maxPages: 2 }, { zoomMode: true })}
</body></html>`;
}
