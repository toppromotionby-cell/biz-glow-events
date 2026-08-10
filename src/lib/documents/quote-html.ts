// Единый HTML-рендер коммерческого предложения.
// Browser-safe: используется и для live-превью в админке, и на сервере
// (HTML-версия документа). Шрифты и токены — как на сайте (Space Grotesk / Inter).
import { resolveCompany } from "@/lib/documents/company";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { logoImgStyle, logoWrapStyle } from "@/lib/documents/logo-layout";
import { BRAND_ACCENT, docCssVars } from "@/lib/documents/brand";
import { printPageMarginCss, resolvePrintPreset } from "@/lib/documents/print-preset";
import { autoFitScript, densityRootVars, DENSITY_PAGE_CSS } from "@/lib/documents/density";


import type { Quote, QuoteItem, QuoteCheck, QuoteCheckScope } from "@/lib/quotes-model";
import { computeTotals, amountToWords } from "@/lib/quotes-model";
import { vatRateLabel } from "@/lib/documents/vat";
import {
  applyPlaceholders,
  defaultBlocksForTemplate,
  evaluateBlockCondition,
  type NumericMap,
  type PlaceholderMap,
  type QuoteBlock,
  type QuoteConditionContext,
} from "@/lib/quote-blocks";


function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(n: number): string {
  return `${new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} BYN`;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function lines(text: string): string {
  return String(text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");
}

function paragraphs(text: string): string {
  return String(text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

export function quoteCompany(quote: Quote, settings: DocumentSettings) {
  const c = resolveCompany(quote.company_overrides, settings);
  return {
    legal: c.company_legal_name,
    brand: c.company_brand,
    unp: c.company_unp,
    address: c.company_address,
    phone: c.company_phone,
    email: c.company_email,
    website: c.company_website,
    bank_name: c.bank_name,
    bank_bic: c.bank_bic,
    bank_account: c.bank_account,
    signer_name: c.signer_name,
    signer_title: c.signer_title,
    signer_basis: c.signer_basis,
  };
}

export function quoteNumberDisplay(quote: Quote): string {
  const n = (quote.quote_number ?? "").trim();
  return n ? n.replaceAll("/", ".") : quote.id.slice(0, 8).toUpperCase();
}

export function quoteFileName(quote: Quote): string {
  const owner = (quote.client_company || quote.client_name || "").trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 48);
  return `КП №${quoteNumberDisplay(quote)}${owner ? ` ${owner}` : ""}.pdf`;
}

export function quoteValidUntil(quote: Quote): string {
  const manual = (quote.valid_until_override ?? "").trim();
  if (manual) return fmtDate(manual);
  if (!quote.validity_days) return "";
  const d = new Date(quote.doc_date);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + quote.validity_days);
  return fmtDate(d.toISOString().slice(0, 10));
}

/** Числовые значения для формул {{= ... }}. */
export function buildNumericValues(quote: Quote, items: QuoteItem[]): NumericMap {
  const t = computeTotals(quote, items);
  return {
    subtotal: t.subtotal,
    discount: t.discount,
    delivery: t.delivery,
    total: t.total,
    prepayment: t.prepayment,
    advance: t.prepayment,
    balance: t.balance,
    net: t.net,
    vat_rate: t.vatRate,
    vat_amount: t.vat,
    total_with_vat: t.total,
    items_count: items.length,
    items_qty: items.reduce((s, it) => s + Number(it.qty || 0), 0),
  };
}

/** Значения плейсхолдеров {{...}} для настраиваемых блоков. */
export function buildPlaceholderValues(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
): PlaceholderMap {
  const c = quoteCompany(quote, settings);
  const t = computeTotals(quote, items);
  const n = buildNumericValues(quote, items);
  return {
    client_name: quote.client_name || "",
    client_company: quote.client_company || "",
    client_unp: quote.client_unp || "",
    client_phone: quote.client_phone || "",
    client_email: quote.client_email || "",
    event_date: fmtDate(quote.event_date),
    event_time: [quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — "),
    venue: quote.venue || "",
    guests: quote.guests_count != null ? String(quote.guests_count) : "",
    event_format: quote.event_format || "",
    setup_note: quote.setup_note || "",
    subtotal: money(t.subtotal),
    discount: money(t.discount),
    delivery: money(t.delivery),
    total: money(t.total),
    total_words: amountToWords(t.total),
    prepayment: money(t.prepayment),
    advance: money(t.prepayment),
    balance: money(t.balance),
    net: money(t.net),
    vat_rate: String(t.vatRate),
    vat_amount: money(n.vat_amount ?? 0),
    total_with_vat: money(n.total_with_vat ?? 0),
    items_count: String(items.length),
    items_qty: String(n.items_qty ?? 0),
    quote_number: quoteNumberDisplay(quote),
    doc_date: fmtDate(quote.doc_date),
    valid_until: quoteValidUntil(quote),
    quote_title: quote.title || "",
    company_legal: c.legal,
    company_brand: c.brand,
    company_unp: c.unp,
    company_address: c.address,
    company_phone: c.phone,
    company_email: c.email,
    company_website: c.website,
    bank_name: c.bank_name,
    bank_bic: c.bank_bic,
    bank_account: c.bank_account,
    signer_name: c.signer_name,
    signer_title: c.signer_title,
  };
}

/** Контекст для условных блоков: какие данные фактически заполнены. */
export function buildConditionContext(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
): Partial<QuoteConditionContext> {
  const t = computeTotals(quote, items);
  const c = quoteCompany(quote, settings);
  return {
    always: true,
    has_items: items.length > 0,
    has_discount: t.discount > 0,
    has_delivery: t.delivery > 0,
    has_prepayment: t.prepayment > 0,
    has_requisites: Boolean((c.bank_account || "").trim() || (c.unp || "").trim()),
    has_event_date: Boolean(quote.event_date),
    has_venue: Boolean((quote.venue || "").trim()),
    has_client_company: Boolean((quote.client_company || "").trim()),
  };
}

/**
 * Эффективный список блоков документа: учитывает шаблон, ручной тумблер
 * и условия автопоказа (блок скрывается, если по данным он пустой).
 */
export function effectiveBlocks(
  quote: Quote,
  items: QuoteItem[] = [],
  settings?: DocumentSettings,
): QuoteBlock[] {
  const list = quote.blocks?.length ? quote.blocks : defaultBlocksForTemplate(quote.template ?? "classic");
  const ctx = settings ? buildConditionContext(quote, items, settings) : { always: true };
  const map = settings ? buildPlaceholderValues(quote, items, settings) : {};
  const numbers = buildNumericValues(quote, items);
  return list.filter((b) => {
    if (!b.enabled) return false;
    const hasContent = Boolean(blockText(b, quote, map, numbers).trim());
    return evaluateBlockCondition(b.condition, ctx, hasContent);
  });
}

/** Содержимое блока с учётом плейсхолдеров и запасного текста из quote.texts. */
export function blockText(
  block: QuoteBlock,
  quote: Quote,
  map: PlaceholderMap,
  numbers: NumericMap = {},
): string {
  const fallback: Partial<Record<QuoteBlock["type"], string>> = {
    cover: quote.texts.intro,
    included: quote.texts.included,
    excluded: quote.texts.excluded,
    timeline: quote.texts.timeline,
    terms: quote.texts.terms,
  };
  const raw = (block.content?.trim() ? block.content : (fallback[block.type] ?? "")) || "";
  return applyPlaceholders(raw, map, numbers);
}


function templateVars(template: string): string {
  if (template === "minimal") {
    return `--cover-bg:#fff; --cover-border:var(--line); --card-bg:#fff; --radius:8px;`;
  }
  if (template === "premium") {
    return `--cover-bg:linear-gradient(135deg,#101828,#1f2937); --cover-border:transparent; --card-bg:var(--surface); --radius:16px;`;
  }
  return `--cover-bg:linear-gradient(135deg,color-mix(in srgb,var(--accent) 14%,#fff),#fff); --cover-border:color-mix(in srgb,var(--accent) 30%,#fff); --card-bg:var(--surface); --radius:14px;`;
}

/** Опции рендера: editable включает подсветку блоков и двойной клик в live-превью. */
export type QuoteHtmlOptions = {
  editable?: boolean;
  /** Проверки документа — показываются прямо в превью рядом с проблемными местами. */
  checks?: QuoteCheck[];
};

export function buildQuoteHtmlDoc(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
  opts: QuoteHtmlOptions = {},
): string {
  const editable = opts.editable === true;
  /** Метка редактируемой зоны — попадает в HTML только в режиме редактирования. */
  const ed = (target: string, id?: string, label?: string) =>
    editable
      ? ` data-edit="${esc(target)}"${id != null ? ` data-edit-id="${esc(id)}"` : ""}${label ? ` data-edit-label="${esc(label)}"` : ""}`
      : "";

  // ==== Инлайн-предупреждения превью ====
  const allChecks = (opts.checks ?? []).filter((c) => c.level === "error" || c.level === "warn");
  const checksByItem = new Map<string, QuoteCheck[]>();
  const scopeChecks = (scope: QuoteCheckScope) => allChecks.filter((c) => c.scope === scope && !c.refId);
  for (const ch of allChecks) {
    if (ch.scope === "item" && ch.refId) {
      if (!checksByItem.has(ch.refId)) checksByItem.set(ch.refId, []);
      checksByItem.get(ch.refId)!.push(ch);
    }
  }
  /** Значок с текстом причины. Не печатается. */
  const chkList = (list: QuoteCheck[], cls = "") =>
    list.length
      ? `<div class="chk-list ${cls}">${list
          .map(
            (ch) =>
              `<span class="chk chk-${ch.level}" title="${esc(ch.message)}"><span class="chk-ic">${
                ch.level === "error" ? "!" : "?"
              }</span>${esc(ch.message)}</span>`,
          )
          .join("")}</div>`
      : "";

  const c = quoteCompany(quote, settings);
  const accent = (quote.design.accent_color || settings.accent_color || BRAND_ACCENT).trim();
  const t = computeTotals(quote, items);
  const num = quoteNumberDisplay(quote);
  const validUntil = quoteValidUntil(quote);
  const template = quote.template ?? "classic";
  // Пресет печати: поля, межстрочный интервал, плотность — те же, что в PDF.
  const print = resolvePrintPreset(
    template,
    (settings as { quote_print_presets?: unknown }).quote_print_presets as never,
    quote.design as unknown as Record<string, unknown>,
  );
  /** Кегли из docCssVars: масштаб пресета + плотность (--fk, как в PDF). */
  const scaledVars = (css: string) =>
    css.replace(
      /(--fs-[a-z-]+):([\d.]+)px/g,
      (_m, k: string, v: string) =>
        `${k}:calc(${Math.round(Number(v) * print.fontScale * 100) / 100}px * var(--fk))`,
    );

  const map = buildPlaceholderValues(quote, items, settings);
  const numbers = buildNumericValues(quote, items);

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const sections = new Map<string, QuoteItem[]>();
  for (const it of sorted) {
    const key = (it.section || "").trim();
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(it);
  }

  const vatRow =
    t.vatEnabled && quote.vat_as_line
      ? `<tr class="section-row"><td></td><td>${esc(t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`)}</td><td class="qty"></td><td class="num"></td><td class="num">${money(t.vat)}</td></tr>`
      : "";
  const vatFootNote = t.vatEnabled
    ? `В том числе НДС ${vatRateLabel(t.vatRate)}% — ${money(t.vat)}`
    : quote.vat_note || settings.vat_note;

  const showIncludes = quote.design?.show_item_includes !== false;
  const showSubtotals = quote.design?.show_section_subtotals !== false;

  const tableBody = [...sections.entries()]
    .map(([section, rows]) => {
      const head = section ? `<tr class="section-row"${ed("section", section, "Раздел")}><td colspan="5">${esc(section)}</td></tr>` : "";
      const body = rows
        .map((it, i) => {
          const rowChecks = checksByItem.get(it.id) ?? [];
          const rowCls = rowChecks.some((c) => c.level === "error")
            ? " class=\"chk-row chk-row-error\""
            : rowChecks.length
              ? " class=\"chk-row chk-row-warn\""
              : "";
          return `<tr${rowCls}${ed("item", it.id, "Позиция")}>
        <td class="idx">${i + 1}</td>
        <td>
          <div class="it-title">${esc(it.title)}</div>
          ${it.description ? `<div class="it-desc">${esc(it.description)}</div>` : ""}
          ${
            showIncludes && it.includes?.length
              ? `<ul class="it-inc">${it.includes
                  .map((inc) => `<li>${esc(inc.text)}${inc.note ? ` — ${esc(inc.note)}` : ""}</li>`)
                  .join("")}</ul>`
              : ""
          }
          ${chkList(rowChecks)}
        </td>
        <td class="qty">${esc(it.qty)}${it.unit ? `<span class="unit">${esc(it.unit)}</span>` : ""}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num strong">${money(it.price * it.qty)}</td>
      </tr>`;
        })
        .join("");

      const subtotal =
        showSubtotals && section && rows.length > 1
          ? `<tr class="section-sub"><td colspan="4">Итого по разделу «${esc(section)}»</td><td class="num strong">${money(
              rows.reduce((s, it) => s + it.price * it.qty, 0),
            )}</td></tr>`
          : "";
      return head + body + subtotal;
    })
    .join("");


  const eventRows: Array<[string, string]> = [
    ["Дата мероприятия", fmtDate(quote.event_date)],
    ["Время", [quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — ")],
    ["Площадка", quote.venue],
    ["Гостей", quote.guests_count != null ? String(quote.guests_count) : ""],
    ["Формат", quote.event_format],
    ["Монтаж / демонтаж", quote.setup_note],
  ].filter(([, v]) => !!v) as Array<[string, string]>;

  const heading = (b: QuoteBlock) => `<h2 class="section">${esc(b.title || "")}</h2>`;

  const renderBlockInner = (b: QuoteBlock): string => {
    const text = blockText(b, quote, map, numbers);
    switch (b.type) {
      case "cover":
        return `<div class="cover ${template === "premium" ? "cover-dark" : ""}">
          <h1>${esc(applyPlaceholders(quote.title || "Предложение по организации мероприятия", map, numbers))}</h1>
          ${text ? `<p>${esc(text)}</p>` : ""}
        </div>
        ${chkList(scopeChecks("doc"))}`;

      case "client":
        return `${heading(b)}<div class="card">
          <div class="label">Заказчик</div>
          <div class="name">${esc(quote.client_company || quote.client_name || "—")}</div>
          ${[
            quote.client_company && quote.client_name ? `Контакт: ${quote.client_name}` : "",
            quote.client_unp ? `УНП ${quote.client_unp}` : "",
            quote.client_phone,
            quote.client_email,
            quote.client_address,
          ]
            .filter(Boolean)
            .map((l) => `<div class="line">${esc(l)}</div>`)
            .join("")}
          ${chkList(scopeChecks("client"))}
        </div>`;
      case "event":
        return `${heading(b)}<div class="card">
          <table class="info-table">
            ${eventRows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("") || `<tr><td class="k">Детали</td><td>уточняются</td></tr>`}
          </table>
          ${quote.event_notes ? `<div class="line" style="margin-top:8px;white-space:pre-line;">${esc(quote.event_notes)}</div>` : ""}
        </div>`;
      case "items":
        return `${heading(b)}<table>
          <thead><tr><th></th><th>Позиция</th><th class="qty">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
          <tbody>${tableBody || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:22px;">Позиции не добавлены</td></tr>`}${vatRow}</tbody>
        </table>
        ${chkList(scopeChecks("item"))}`;
      case "totals":
        return `<div class="totals">
          <div class="row"><span>Стоимость позиций${t.vatEnabled ? " (без НДС)" : ""}</span><span>${money(t.subtotal)}</span></div>
          ${t.discount ? `<div class="row"><span>Скидка</span><span>−${money(t.discount)}</span></div>` : ""}
          ${t.delivery ? `<div class="row"><span>Доставка и логистика</span><span>${money(t.delivery)}</span></div>` : ""}
          ${t.vatEnabled ? `${t.discount || t.delivery ? `<div class="row"><span>Сумма без НДС</span><span>${money(t.net)}</span></div>` : ""}<div class="row"><span>НДС ${vatRateLabel(t.vatRate)}%</span><span>${money(t.vat)}</span></div>` : ""}
          <div class="row total"><span>${t.vatEnabled ? "Итого с НДС" : "Итого"}</span><span>${money(t.total)}</span></div>
          ${t.prepayment ? `<div class="row"><span>Предоплата</span><span>${money(t.prepayment)}</span></div><div class="row"><span>Остаток</span><span>${money(t.balance)}</span></div>` : ""}
        </div>
        ${chkList(scopeChecks("totals"), "chk-right")}
        <div class="words">${esc(amountToWords(t.total))}. ${esc(vatFootNote)}</div>`;

      case "included":
      case "excluded":
        return text ? `${heading(b)}<ul>${lines(text)}</ul>` : "";
      case "timeline":
      case "terms":
      case "text":
        return text ? `${heading(b)}${paragraphs(text)}` : "";
      case "requisites":
        return `${heading(b)}<div class="card">
          <div class="name">${esc(c.legal)}</div>
          ${[
            c.unp ? `УНП ${c.unp}` : "",
            c.address,
            c.bank_account ? `р/с ${c.bank_account}` : "",
            c.bank_name,
            c.bank_bic ? `БИК ${c.bank_bic}` : "",
            [c.phone, c.email, c.website].filter(Boolean).join(" · "),
          ]
            .filter(Boolean)
            .map((l) => `<div class="line">${esc(l)}</div>`)
            .join("")}
        </div>`;
      case "signature":
        return `<div class="sign">
          <div>
            <div class="who">Исполнитель</div>
            <div>${esc(c.legal)}</div>
            ${quote.signature_url ? `<img src="${esc(quote.signature_url)}" alt="" />` : ""}
            ${quote.design.show_stamp && quote.stamp_url ? `<img src="${esc(quote.stamp_url)}" alt="" />` : ""}
            <div class="sign-line">${esc(c.signer_name)}${c.signer_title ? `, ${esc(c.signer_title)}` : ""}</div>
          </div>
          <div>
            <div class="who">Заказчик</div>
            <div>${esc(quote.client_company || quote.client_name || "")}</div>
            <div class="sign-line">${esc(quote.client_name || "")}</div>
          </div>
        </div>`;
      default:
        return "";
    }
  };

  /** Зоны редактирования: тип блока -> цель диалога в админке. */
  const BLOCK_EDIT_TARGET: Partial<Record<QuoteBlock["type"], { target: string; label: string; useId?: boolean }>> = {
    cover: { target: "cover", label: "Заголовок и вступление" },
    client: { target: "client", label: "Заказчик" },
    event: { target: "event", label: "Мероприятие" },
    totals: { target: "totals", label: "Итоги и оплата" },
    requisites: { target: "company", label: "Реквизиты" },
    signature: { target: "company", label: "Реквизиты" },
    included: { target: "block", label: "Текстовый блок", useId: true },
    excluded: { target: "block", label: "Текстовый блок", useId: true },
    timeline: { target: "block", label: "Текстовый блок", useId: true },
    terms: { target: "block", label: "Текстовый блок", useId: true },
    text: { target: "block", label: "Текстовый блок", useId: true },
  };

  const renderBlock = (b: QuoteBlock): string => {
    const inner = renderBlockInner(b);
    const blockChecks = allChecks.filter((c) => c.scope === "block" && c.refId === b.id);
    // Замечания к блоку показываем даже у пустого блока — иначе проблему в превью не видно.
    const html = inner.trim() || blockChecks.length ? `${inner}${chkList(blockChecks)}` : inner;
    if (!editable || !html.trim()) return html;
    const cfg = BLOCK_EDIT_TARGET[b.type];
    if (!cfg) return html;
    return `<div${ed(cfg.target, cfg.useId ? b.id : undefined, cfg.label)}>${html}</div>`;
  };


  // Тумблеры оформления по-прежнему работают как «жёсткое» выключение блока.
  const hidden = new Set<string>();
  if (!quote.design.show_cover) hidden.add("cover");
  if (!quote.design.show_requisites) hidden.add("requisites");
  if (!quote.design.show_signature) hidden.add("signature");

  const bodyHtml = effectiveBlocks(quote, items, settings)
    .filter((b) => !hidden.has(b.type))
    .map(renderBlock)
    .join("\n");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>КП №${esc(num)} — ${esc(c.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
<style>
  :root { ${densityRootVars()}; ${scaledVars(docCssVars(esc(accent)))}; ${templateVars(template)}
    --gap-k:calc(${print.blockGap} * var(--dk)); --row-k:calc(${print.rowGap} * var(--dk)); --lh:${print.lineHeight}; }
  @page { size: A4; margin: ${printPageMarginCss(print)}; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f3f4f6; color:var(--ink); font-family:"Inter",system-ui,sans-serif; font-size:var(--fs-body); line-height:var(--lh); }
  .sheet { max-width: 820px; margin: 0 auto; background:#fff; padding: calc(18px * var(--gap-k)) 22px calc(22px * var(--gap-k)); }
  h1,h2,h3 { font-family:"Space Grotesk",system-ui,sans-serif; letter-spacing:-0.02em; margin:0; }
  .bar { height:3px; background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 45%,#fff)); border-radius:3px; }
  .head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:10px 0 8px; border-bottom:1px solid var(--line); }
  .brand { font-family:"Space Grotesk",system-ui,sans-serif; font-size:var(--fs-brand); font-weight:700; }
  .brand-sub { color:var(--muted); font-size:var(--fs-small); margin-top:2px; }
  .logo { height:30px; width:auto; display:block; margin-bottom:4px; }
  .doc-kind { text-transform:uppercase; letter-spacing:.14em; font-size:var(--fs-doc-kind); font-weight:600; color:var(--accent); }
  .doc-num { font-family:"Space Grotesk",system-ui,sans-serif; font-size:var(--fs-doc-num); font-weight:700; }
  .doc-date { color:var(--muted); font-size:var(--fs-doc-date); }
  .right { text-align:right; }
  .cover { margin:10px 0 4px; padding:10px 12px; border-radius:var(--radius); background:var(--cover-bg); border:1px solid var(--cover-border); }
  .cover h1 { font-size:var(--fs-cover); }
  .cover p { margin:5px 0 0; color:var(--body); }
  .cover.cover-dark, .cover.cover-dark h1 { color:#fff; }
  .cover.cover-dark p { color:#d1d5db; }
  h2.section { font-size:var(--fs-section); text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin:calc(12px * var(--gap-k)) 0 calc(5px * var(--gap-k)); break-after:avoid; page-break-after:avoid; }
  .card { border:1px solid var(--line); background:var(--card-bg); border-radius:var(--radius); padding:8px 10px; break-inside:avoid; page-break-inside:avoid; }
  .card .label { text-transform:uppercase; font-size:var(--fs-card-label); letter-spacing:.12em; color:var(--accent); font-weight:600; }
  .card .name { font-family:"Space Grotesk",system-ui,sans-serif; font-weight:600; font-size:var(--fs-card-title); margin:2px 0 3px; }
  .card .line { color:var(--muted); font-size:var(--fs-small); }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  thead th { background:color-mix(in srgb,var(--accent) 12%,#fff); font-size:var(--fs-doc-kind); text-transform:uppercase; letter-spacing:.08em; text-align:left; padding:calc(5px * var(--row-k)) 6px; }
  tbody td { padding:calc(5px * var(--row-k)) 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  tbody tr { break-inside:avoid; page-break-inside:avoid; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.qty, th.qty { text-align:center; vertical-align:middle; white-space:nowrap; font-variant-numeric:tabular-nums; width:var(--qty-col); }
  td.qty .unit { display:block; margin-top:1px; }
  td.idx { color:var(--muted); width:22px; }
  .it-title { font-weight:600; }
  .it-desc { color:var(--muted); font-size:var(--fs-small); margin-top:1px; white-space:pre-line; }
  .it-inc { margin:2px 0 0 12px; padding:0; color:var(--muted); font-size:var(--fs-small); }
  .it-inc li { margin:0; }
  .section-sub td { font-size:var(--fs-small); color:var(--muted); background:var(--surface); }

  .unit { color:var(--muted); font-size:var(--fs-micro); }
  .strong { font-weight:600; }
  .section-row td { background:#fff; font-family:"Space Grotesk",system-ui,sans-serif; font-weight:600; font-size:var(--fs-body); padding-top:9px; border-bottom:1px solid var(--line); }
  .totals { margin-top:9px; margin-left:auto; width:min(330px,100%); border:1px solid color-mix(in srgb,var(--accent) 40%,#fff); border-radius:var(--radius); overflow:hidden; break-inside:avoid; page-break-inside:avoid; }
  .totals .row { display:flex; justify-content:space-between; padding:4px 10px; font-size:var(--fs-body); }
  .totals .row.total { background:color-mix(in srgb,var(--accent) 14%,#fff); font-weight:700; font-size:var(--fs-total); font-family:"Space Grotesk",system-ui,sans-serif; }
  .words { margin-top:5px; color:var(--muted); font-size:var(--fs-small); font-style:italic; }
  .info-table td { padding:2px 0; border:0; }
  .info-table td.k { color:var(--muted); width:160px; }
  ul { margin:4px 0; padding-left:16px; }
  li { margin:1px 0; }
  p { margin:4px 0; }
  .sign { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
  .sign .who { text-transform:uppercase; font-size:var(--fs-card-label); letter-spacing:.12em; color:var(--accent); font-weight:600; }
  .sign-line { margin-top:26px; border-top:1px solid var(--line); padding-top:3px; color:var(--muted); font-size:var(--fs-small); }
  .sign img { max-height:46px; display:block; margin-top:4px; }
  .footer { margin-top:12px; padding-top:7px; border-top:1px solid var(--line); color:var(--muted); font-size:var(--fs-footer); }
  /* Инлайн-предупреждения превью: не попадают в печать и PDF */
  .chk-list { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
  .chk-list.chk-right { justify-content:flex-end; }
  .chk { display:inline-flex; align-items:center; gap:4px; font-size:var(--fs-micro); line-height:1.25; padding:2px 6px; border-radius:999px; border:1px solid; }
  .chk-ic { display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; border-radius:50%; font-weight:700; font-size:9px; color:#fff; }
  .chk-error { color:#991b1b; background:#fef2f2; border-color:#fecaca; }
  .chk-error .chk-ic { background:#dc2626; }
  .chk-warn { color:#92400e; background:#fffbeb; border-color:#fde68a; }
  .chk-warn .chk-ic { background:#d97706; }
  tr.chk-row-error td { background:#fef2f2; }
  tr.chk-row-warn td { background:#fffbeb; }
  @media print { .chk-list { display:none !important; } tr.chk-row td { background:transparent !important; } }
  @media print { body { background:#fff; } .sheet { max-width:none; padding:0; } }
  ${
    editable
      ? `
  [data-edit] { position:relative; cursor:pointer; border-radius:6px; transition:box-shadow .12s ease, background .12s ease; }
  [data-edit]:hover { box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 55%,#fff); background:color-mix(in srgb,var(--accent) 5%,#fff); }
  tr[data-edit]:hover > td { background:color-mix(in srgb,var(--accent) 7%,#fff); }
  .edit-hint { position:fixed; z-index:9; left:0; top:0; padding:2px 8px; border-radius:999px; background:var(--accent); color:#fff; font-size:11px; font-family:"Inter",system-ui,sans-serif; pointer-events:none; opacity:0; transition:opacity .1s ease; white-space:nowrap; }
  .edit-hint.on { opacity:1; }
  @media print { [data-edit]:hover { box-shadow:none; background:none; } .edit-hint { display:none; } }`
      : ""
  }
</style></head>
<body${editable ? ' class="editable"' : ""}><div class="sheet">
  <div class="bar"></div>
  <div class="head">
    <div style="text-align:${quote.logo_layout?.align === "center" ? "center" : quote.logo_layout?.align === "right" ? "right" : "left"}"${ed("company", undefined, "Реквизиты и логотип")}>
      ${quote.design.show_logo && (quote.logo_url || settings.logo_url) ? `<div style="${logoWrapStyle(quote.logo_layout)}"><img class="logo" style="${logoImgStyle(quote.logo_layout)}" src="${esc(quote.logo_url || settings.logo_url)}" alt="" /></div>` : ""}
      ${quote.design.show_logo && (quote.logo_url || settings.logo_url) ? "" : `<div class="brand">${esc(c.brand)}</div>`}
      <div class="brand-sub">${esc(c.legal)}${c.unp ? ` · УНП ${esc(c.unp)}` : ""}<br/>${esc(c.address)}</div>
    </div>

    <div class="right"${ed("header", undefined, "Номер и даты")}>
      <div class="doc-kind">Коммерческое предложение</div>
      <div class="doc-num">№ ${esc(num)}</div>
      <div class="doc-date">от ${esc(fmtDate(quote.doc_date))}</div>
      ${validUntil ? `<div class="doc-date">действительно до ${esc(validUntil)}</div>` : ""}
    </div>
  </div>

  ${bodyHtml}

  <div class="footer"${ed("footer", undefined, "Подвал документа")}>
    ${esc(applyPlaceholders(quote.texts.footer || settings.quote_footer, map, numbers))}
    <div style="margin-top:4px;">${esc(c.legal)} · ${esc(c.phone)} · ${esc(c.email)} · ${esc(c.website)}</div>
  </div>
</div>${
    editable
      ? `<div class="edit-hint" id="edit-hint">Двойной клик — редактировать</div>
<script>
(function(){
  var hint = document.getElementById('edit-hint');
  var current = null;
  document.addEventListener('mouseover', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-edit]') : null;
    if (el === current) return;
    current = el;
    if (!el) { hint.classList.remove('on'); return; }
    var r = el.getBoundingClientRect();
    hint.textContent = (el.getAttribute('data-edit-label') || 'Блок') + ' · двойной клик';
    hint.style.left = Math.max(6, r.left) + 'px';
    hint.style.top = Math.max(6, r.top - 20) + 'px';
    hint.classList.add('on');
  });
  document.addEventListener('mouseleave', function(){ hint.classList.remove('on'); });
  document.addEventListener('dblclick', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-edit]') : null;
    if (!el) return;
    e.preventDefault();
    parent.postMessage({ source: 'doc-preview', type: 'doc-edit', target: el.getAttribute('data-edit'), id: el.getAttribute('data-edit-id') || null }, '*');
  });
})();
<\/script>`
      : ""
  }</body></html>`;
}
