// HTML-рендер промо-КП: используется и для live-превью в админке, и для страницы документа.
import { logoImgStyle, logoWrapStyle } from "@/lib/documents/logo-layout";
import { vatRateLabel } from "@/lib/documents/vat";

import { BRAND_ACCENT } from "@/lib/documents/brand";
import {
  computePromoTotals,
  formatMoney,
  groupBySection,
  lineQty,
  lineTotal,
  promoNumberDisplay,
  type PromoItem,
  type PromoQuote,
  type PromoCheck,
} from "@/lib/promo-quote-model";

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
  opts: { editable?: boolean; companyLine?: string; checks?: PromoCheck[] } = {},
): string {
  const editable = opts.editable === true;
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

  const cols: Array<{ label: string; cls: string }> = [{ label: "Наименование", cls: "c-title" }];
  cols.push({ label: "Ед. изм.", cls: "c-unit" });
  if (quote.show_qty) cols.push({ label: "Кол-во", cls: "c-num" });
  if (quote.show_total_qty) cols.push({ label: "Всего", cls: "c-num" });
  cols.push({ label: "Цена за ед.", cls: "c-money" });
  cols.push({ label: `Всего${t.vatMode === "add" ? ", без НДС" : t.vatMode === "included" ? ", с НДС" : ""}`, cls: "c-money" });
  if (quote.show_notes) cols.push({ label: "Примечания", cls: "c-note" });

  const colCount = cols.length;

  const rowsHtml = sections
    .map((sec) => {
      const head = sec.name
        ? `<tr class="sec"${ed("section", sec.name, "Раздел")}><td colspan="${colCount}">${esc(sec.name)}</td></tr>`
        : "";
      const body = sec.items
        .map((it) => {
          const inc =
            quote.show_item_includes && it.includes.length
              ? `<ul class="c-inc">${it.includes
                  .map((x) => `<li>${esc(x.text)}${x.note ? ` — ${esc(x.note)}` : ""}</li>`)
                  .join("")}</ul>`
              : "";
          const rowChecks = checksByIndex.get(items.indexOf(it)) ?? [];
          const rowCls = rowChecks.some((c) => c.level === "error")
            ? " chk-row chk-row-error"
            : rowChecks.length
              ? " chk-row chk-row-warn"
              : "";
          const cells: string[] = [
            `<td class="c-title">${esc(it.title)}${inc}${chkList(rowChecks)}</td>`,
            `<td class="c-unit">${esc(it.unit)}</td>`,
          ];
          if (quote.show_qty) cells.push(`<td class="c-num">${nf(it.qty).replace(",00", "")}</td>`);
          if (quote.show_total_qty) cells.push(`<td class="c-num">${nf(lineQty(it)).replace(",00", "")}</td>`);
          cells.push(`<td class="c-money">${it.price ? nf(it.price) : ""}</td>`);
          cells.push(`<td class="c-money">${lineTotal(it) ? nf(lineTotal(it)) : ""}</td>`);
          if (quote.show_notes) cells.push(`<td class="c-note">${esc(it.note)}</td>`);
          return `<tr class="${rowCls.trim()}"${ed("item", it.id, "Позиция")}>${cells.join("")}</tr>`;
        })

        .join("");
      const sub =
        quote.show_section_subtotals && sec.name && sec.items.length > 1
          ? `<tr class="sec-sub"><td colspan="${colCount - 1}">Итого по разделу «${esc(sec.name)}»</td><td class="c-money">${nf(
              sec.items.reduce((s, it) => s + lineTotal(it), 0),
            )}</td></tr>`
          : "";
      return head + body + sub;

    })
    .join("");

  const extraRows: string[] = [];
  if (quote.management_enabled) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(quote.management_label)}</td><td class="c-unit">услуга</td>${
        quote.show_qty ? '<td class="c-num">—</td>' : ""
      }${quote.show_total_qty ? '<td class="c-num">—</td>' : ""}<td class="c-money"></td><td class="c-money">${nf(
        t.management,
      )}</td>${quote.show_notes ? '<td class="c-note"></td>' : ""}</tr>`,
    );
  }
  if (quote.commission_enabled) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(quote.commission_label)}</td><td class="c-unit">—</td>${
        quote.show_qty ? '<td class="c-num">—</td>' : ""
      }${quote.show_total_qty ? '<td class="c-num">—</td>' : ""}<td class="c-money"></td><td class="c-money">${nf(
        t.commission,
      )}</td>${quote.show_notes ? `<td class="c-note">${nf(quote.commission_rate).replace(",00", "")} %</td>` : ""}</tr>`,
    );
  }

  if (t.vatEnabled && quote.vat_as_line) {
    extraRows.push(
      `<tr class="extra"><td class="c-title">${esc(
        t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
      )}</td><td class="c-unit">—</td>${quote.show_qty ? '<td class="c-num">—</td>' : ""}${
        quote.show_total_qty ? '<td class="c-num">—</td>' : ""
      }<td class="c-money"></td><td class="c-money">${nf(t.vat)}</td>${quote.show_notes ? '<td class="c-note"></td>' : ""}</tr>`,
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
<div class="promo-doc" style="--accent:${esc(accent)}">
  <div class="head">
    <div class="meta"${ed("meta", undefined, "Шапка КП")}>${meta}</div>
    <div class="logos">
      ${
        quote.logo_url
          ? `<div class="logo-col" style="${logoWrapStyle(quote.logo_layout)}"><img style="${logoImgStyle(quote.logo_layout)}" src="${esc(quote.logo_url)}" alt="Логотип" />${
              opts.companyLine ? `<div class="req">${esc(opts.companyLine)}</div>` : ""
            }</div>`
          : opts.companyLine
            ? `<div class="logo-col"><div class="req">${esc(opts.companyLine)}</div></div>`
            : ""
      }
      ${quote.client_logo_url ? `<img src="${esc(quote.client_logo_url)}" alt="Логотип клиента" />` : ""}
    </div>
  </div>

  <div class="docnum">КП № ${esc(promoNumberDisplay(quote))}</div>
  <table class="grid">
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
.promo-doc { font-family: Inter, "Helvetica Neue", Arial, sans-serif; color: #16161a; font-size: 12px; }
.promo-doc .head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
.promo-doc .meta div { border: 1px solid #d8d8dd; padding: 5px 8px; margin-bottom: -1px; background: #f6f6f7; max-width: 460px; }
.promo-doc .logos { display: flex; gap: 16px; align-items: flex-start; }
.promo-doc .logos img { max-height: 64px; max-width: 240px; object-fit: contain; }
.promo-doc .logo-col { display: block; }
.promo-doc .logo-col .req { margin-top: 4px; max-width: 260px; font-size: 10px; line-height: 1.35; color: #5a5a63; }

.promo-doc .docnum { margin: 16px 0 8px; font-weight: 700; font-size: 13px; }
.promo-doc table { width: 100%; border-collapse: collapse; }
.promo-doc .grid th { background: var(--accent); color: #16161a; font-weight: 700; text-align: center; border: 1px solid #b9b9bf; padding: 6px 6px; }
.promo-doc .grid td { border: 1px solid #d8d8dd; padding: 5px 6px; vertical-align: top; }
.promo-doc .grid tr.sec td { background: #e7e7ea; font-weight: 600; }
.promo-doc .grid tr.sec-sub td { background: #f4f4f6; font-weight: 600; text-align: right; }
.promo-doc .c-inc { margin: 3px 0 0; padding-left: 14px; font-size: 11px; color: #5a5a63; }
.promo-doc .grid tr.extra td { background: #fbfbfc; font-style: italic; }
.promo-doc .c-title { width: 26%; }
.promo-doc .c-unit { width: 9%; text-align: center; }
.promo-doc .c-num { width: 6%; text-align: center; }
.promo-doc .c-money { width: 10%; text-align: right; white-space: nowrap; }
.promo-doc .c-note { width: 33%; color: #45454d; }
.promo-doc .empty { text-align: center; color: #86868f; padding: 16px; }
.promo-doc .totals { margin-top: 10px; width: 320px; margin-left: auto; }
.promo-doc .totals td { border: 1px solid #b9b9bf; padding: 6px 8px; }
.promo-doc .totals .lbl { font-weight: 700; background: var(--accent); text-align: right; }
.promo-doc .totals .val { text-align: right; white-space: nowrap; background: #fff8ea; }
.promo-doc .totals .grand td { font-size: 13px; }
.promo-doc .footer-note { margin-top: 16px; color: #45454d; font-size: 11px; }
.promo-doc .footer-note-empty { color: #9a9aa2; font-style: italic; }
@media print { .promo-doc .footer-note-empty { display: none; } }
.promo-doc .chk-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.promo-doc .chk { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; line-height: 1.25; padding: 2px 6px; border-radius: 999px; border: 1px solid; }
.promo-doc .chk-ic { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; border-radius: 50%; font-weight: 700; font-size: 9px; color: #fff; }
.promo-doc .chk-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
.promo-doc .chk-error .chk-ic { background: #dc2626; }
.promo-doc .chk-warn { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.promo-doc .chk-warn .chk-ic { background: #d97706; }
.promo-doc tr.chk-row-error td { background: #fef2f2; }
.promo-doc tr.chk-row-warn td { background: #fffbeb; }
@media print { .promo-doc .chk-list { display: none !important; } .promo-doc tr.chk-row td { background: transparent !important; } }
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
<style>
  body { margin: 0; padding: 28px; background: #f2f2f4; }
  .sheet { background: #fff; max-width: 1120px; margin: 0 auto; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  ${PROMO_DOC_CSS}
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; max-width: none; padding: 0; } }
</style></head>
<body><div class="sheet">${buildPromoQuoteBody(quote, items, { companyLine })}</div>
<!-- Итого: ${formatMoney(t.totalWithVat, quote.currency)} -->
</body></html>`;
}
