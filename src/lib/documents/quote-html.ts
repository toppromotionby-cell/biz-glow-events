// Единый HTML-рендер коммерческого предложения.
// Browser-safe: используется и для live-превью в админке, и на сервере
// (HTML-версия документа). Шрифты и токены — как на сайте (Space Grotesk / Inter).
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { Quote, QuoteItem } from "@/lib/quotes-model";
import { computeTotals, amountToWords } from "@/lib/quotes-model";
import {
  applyPlaceholders,
  defaultBlocksForTemplate,
  evaluateBlockCondition,
  QUOTE_VAT_RATE,
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
  const o = quote.company_overrides ?? {};
  const pick = (k: keyof DocumentSettings & keyof typeof o) =>
    (o[k] && String(o[k]).trim()) || String(settings[k] ?? "");
  return {
    legal: pick("company_legal_name"),
    brand: pick("company_brand"),
    unp: pick("company_unp"),
    address: pick("company_address"),
    phone: pick("company_phone"),
    email: pick("company_email"),
    website: pick("company_website"),
    bank_name: pick("bank_name"),
    bank_bic: pick("bank_bic"),
    bank_account: pick("bank_account"),
    signer_name: pick("signer_name"),
    signer_title: pick("signer_title"),
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
  if (!quote.validity_days) return "";
  const d = new Date(quote.doc_date);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + quote.validity_days);
  return fmtDate(d.toISOString().slice(0, 10));
}

/** Числовые значения для формул {{= ... }}. */
export function buildNumericValues(quote: Quote, items: QuoteItem[]): NumericMap {
  const t = computeTotals(quote, items);
  const vat = (t.total * QUOTE_VAT_RATE) / 100;
  return {
    subtotal: t.subtotal,
    discount: t.discount,
    delivery: t.delivery,
    total: t.total,
    prepayment: t.prepayment,
    advance: t.prepayment,
    balance: t.balance,
    vat_rate: QUOTE_VAT_RATE,
    vat_amount: vat,
    total_with_vat: t.total + vat,
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
    vat_rate: String(QUOTE_VAT_RATE),
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

export function buildQuoteHtmlDoc(quote: Quote, items: QuoteItem[], settings: DocumentSettings): string {
  const c = quoteCompany(quote, settings);
  const accent = (quote.design.accent_color || settings.accent_color || "#e0a13f").trim();
  const t = computeTotals(quote, items);
  const num = quoteNumberDisplay(quote);
  const validUntil = quoteValidUntil(quote);
  const template = quote.template ?? "classic";
  const map = buildPlaceholderValues(quote, items, settings);
  const numbers = buildNumericValues(quote, items);

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const sections = new Map<string, QuoteItem[]>();
  for (const it of sorted) {
    const key = (it.section || "").trim();
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(it);
  }

  const tableBody = [...sections.entries()]
    .map(([section, rows]) => {
      const head = section ? `<tr class="section-row"><td colspan="5">${esc(section)}</td></tr>` : "";
      const body = rows
        .map(
          (it, i) => `<tr>
        <td class="idx">${i + 1}</td>
        <td>
          <div class="it-title">${esc(it.title)}</div>
          ${it.description ? `<div class="it-desc">${esc(it.description)}</div>` : ""}
        </td>
        <td class="num">${esc(it.qty)}${it.unit ? ` <span class="unit">${esc(it.unit)}</span>` : ""}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num strong">${money(it.price * it.qty)}</td>
      </tr>`,
        )
        .join("");
      return head + body;
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

  const renderBlock = (b: QuoteBlock): string => {
    const text = blockText(b, quote, map, numbers);
    switch (b.type) {
      case "cover":
        return `<div class="cover ${template === "premium" ? "cover-dark" : ""}">
          <h1>${esc(applyPlaceholders(quote.title || "Предложение по организации мероприятия", map, numbers))}</h1>
          ${text ? `<p>${esc(text)}</p>` : ""}
        </div>`;
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
          <thead><tr><th></th><th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
          <tbody>${tableBody || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:22px;">Позиции не добавлены</td></tr>`}</tbody>
        </table>`;
      case "totals":
        return `<div class="totals">
          <div class="row"><span>Стоимость позиций</span><span>${money(t.subtotal)}</span></div>
          ${t.discount ? `<div class="row"><span>Скидка</span><span>−${money(t.discount)}</span></div>` : ""}
          ${t.delivery ? `<div class="row"><span>Доставка и логистика</span><span>${money(t.delivery)}</span></div>` : ""}
          <div class="row total"><span>Итого</span><span>${money(t.total)}</span></div>
          ${t.prepayment ? `<div class="row"><span>Предоплата</span><span>${money(t.prepayment)}</span></div><div class="row"><span>Остаток</span><span>${money(t.balance)}</span></div>` : ""}
        </div>
        <div class="words">${esc(amountToWords(t.total))}. ${esc(quote.vat_note || settings.vat_note)}</div>`;
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
  :root { --accent: ${esc(accent)}; --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --surface:#fafafa; ${templateVars(template)} }
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f3f4f6; color:var(--ink); font-family:"Inter",system-ui,sans-serif; font-size:12px; line-height:1.55; }
  .sheet { max-width: 820px; margin: 0 auto; background:#fff; padding: 28px 32px 36px; }
  h1,h2,h3 { font-family:"Space Grotesk",system-ui,sans-serif; letter-spacing:-0.02em; margin:0; }
  .bar { height:4px; background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 45%,#fff)); border-radius:3px; }
  .head { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; padding:16px 0 14px; border-bottom:1px solid var(--line); }
  .brand { font-family:"Space Grotesk",system-ui,sans-serif; font-size:22px; font-weight:700; }
  .brand-sub { color:var(--muted); font-size:11px; margin-top:2px; }
  .logo { height:40px; width:auto; display:block; margin-bottom:6px; }
  .doc-kind { text-transform:uppercase; letter-spacing:.14em; font-size:9.5px; font-weight:600; color:var(--accent); }
  .doc-num { font-family:"Space Grotesk",system-ui,sans-serif; font-size:18px; font-weight:700; }
  .doc-date { color:var(--muted); font-size:11px; }
  .right { text-align:right; }
  .cover { margin:18px 0 6px; padding:18px 20px; border-radius:var(--radius); background:var(--cover-bg); border:1px solid var(--cover-border); }
  .cover h1 { font-size:24px; }
  .cover p { margin:8px 0 0; color:#374151; }
  .cover.cover-dark, .cover.cover-dark h1 { color:#fff; }
  .cover.cover-dark p { color:#d1d5db; }
  h2.section { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin:22px 0 8px; }
  .card { border:1px solid var(--line); background:var(--card-bg); border-radius:var(--radius); padding:12px 14px; }
  .card .label { text-transform:uppercase; font-size:8.5px; letter-spacing:.12em; color:var(--accent); font-weight:600; }
  .card .name { font-family:"Space Grotesk",system-ui,sans-serif; font-weight:600; font-size:13px; margin:4px 0 4px; }
  .card .line { color:var(--muted); font-size:11px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  thead th { background:color-mix(in srgb,var(--accent) 12%,#fff); font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; text-align:left; padding:8px; }
  tbody td { padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.idx { color:var(--muted); width:26px; }
  .it-title { font-weight:600; }
  .it-desc { color:var(--muted); font-size:11px; margin-top:2px; white-space:pre-line; }
  .unit { color:var(--muted); font-size:10px; }
  .strong { font-weight:600; }
  .section-row td { background:#fff; font-family:"Space Grotesk",system-ui,sans-serif; font-weight:600; font-size:12px; padding-top:14px; border-bottom:1px solid var(--line); }
  .totals { margin-top:14px; margin-left:auto; width:min(360px,100%); border:1px solid color-mix(in srgb,var(--accent) 40%,#fff); border-radius:var(--radius); overflow:hidden; }
  .totals .row { display:flex; justify-content:space-between; padding:7px 14px; font-size:12px; }
  .totals .row.total { background:color-mix(in srgb,var(--accent) 14%,#fff); font-weight:700; font-size:15px; font-family:"Space Grotesk",system-ui,sans-serif; }
  .words { margin-top:8px; color:var(--muted); font-size:11px; font-style:italic; }
  .info-table td { padding:4px 0; border:0; }
  .info-table td.k { color:var(--muted); width:180px; }
  ul { margin:6px 0; padding-left:18px; }
  li { margin:2px 0; }
  p { margin:6px 0; }
  .sign { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:26px; }
  .sign .who { text-transform:uppercase; font-size:8.5px; letter-spacing:.12em; color:var(--accent); font-weight:600; }
  .sign-line { margin-top:44px; border-top:1px solid var(--line); padding-top:4px; color:var(--muted); font-size:11px; }
  .sign img { max-height:60px; display:block; margin-top:6px; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid var(--line); color:var(--muted); font-size:10.5px; }
  @media print { body { background:#fff; } .sheet { max-width:none; padding:0; } }
</style></head>
<body><div class="sheet">
  <div class="bar"></div>
  <div class="head">
    <div>
      ${quote.design.show_logo && (quote.logo_url || settings.logo_url) ? `<img class="logo" src="${esc(quote.logo_url || settings.logo_url)}" alt="" />` : ""}
      <div class="brand">${esc(c.brand)}</div>
      <div class="brand-sub">${esc(c.legal)}${c.unp ? ` · УНП ${esc(c.unp)}` : ""}<br/>${esc(c.address)}</div>
    </div>
    <div class="right">
      <div class="doc-kind">Коммерческое предложение</div>
      <div class="doc-num">№ ${esc(num)}</div>
      <div class="doc-date">от ${esc(fmtDate(quote.doc_date))}</div>
      ${validUntil ? `<div class="doc-date">действительно до ${esc(validUntil)}</div>` : ""}
    </div>
  </div>

  ${bodyHtml}

  <div class="footer">
    ${esc(applyPlaceholders(quote.texts.footer || settings.quote_footer, map, numbers))}
    <div style="margin-top:4px;">${esc(c.legal)} · ${esc(c.phone)} · ${esc(c.email)} · ${esc(c.website)}</div>
  </div>
</div></body></html>`;
}
