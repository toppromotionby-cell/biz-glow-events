// Единый HTML-рендер коммерческого предложения.
// Browser-safe: используется и для live-превью в админке, и на сервере
// (HTML-версия документа). Шрифты и токены — как на сайте (Space Grotesk / Inter).
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { Quote, QuoteItem } from "@/lib/quotes-model";
import { computeTotals, amountToWords } from "@/lib/quotes-model";
import {
  applyPlaceholders,
  defaultBlocksForTemplate,
  type PlaceholderMap,
  type QuoteBlock,
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

/** Значения плейсхолдеров {{...}} для настраиваемых блоков. */
export function buildPlaceholderValues(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
): PlaceholderMap {
  const c = quoteCompany(quote, settings);
  const t = computeTotals(quote, items);
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
    balance: money(t.balance),
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

/** Эффективный список блоков документа (учитывает шаблон и включённость). */
export function effectiveBlocks(quote: Quote): QuoteBlock[] {
  const list = quote.blocks?.length ? quote.blocks : defaultBlocksForTemplate(quote.template ?? "classic");
  return list.filter((b) => b.enabled);
}

/** Содержимое блока с учётом плейсхолдеров и запасного текста из quote.texts. */
export function blockText(block: QuoteBlock, quote: Quote, map: PlaceholderMap): string {
  const fallback: Partial<Record<QuoteBlock["type"], string>> = {
    cover: quote.texts.intro,
    included: quote.texts.included,
    excluded: quote.texts.excluded,
    timeline: quote.texts.timeline,
    terms: quote.texts.terms,
  };
  const raw = (block.content?.trim() ? block.content : (fallback[block.type] ?? "")) || "";
  return applyPlaceholders(raw, map);
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
  const validUntil = (() => {
    if (!quote.validity_days) return "";
    const d = new Date(quote.doc_date);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + quote.validity_days);
    return fmtDate(d.toISOString().slice(0, 10));
  })();

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const sections = new Map<string, QuoteItem[]>();
  for (const it of sorted) {
    const key = (it.section || "").trim();
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(it);
  }

  const tableBody = [...sections.entries()]
    .map(([section, rows]) => {
      const head = section
        ? `<tr class="section-row"><td colspan="5">${esc(section)}</td></tr>`
        : "";
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
    [
      "Время",
      [quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — "),
    ],
    ["Площадка", quote.venue],
    ["Гостей", quote.guests_count != null ? String(quote.guests_count) : ""],
    ["Формат", quote.event_format],
    ["Монтаж / демонтаж", quote.setup_note],
  ].filter(([, v]) => !!v) as Array<[string, string]>;

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>КП №${esc(num)} — ${esc(c.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
<style>
  :root { --accent: ${esc(accent)}; --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --surface:#fafafa; }
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
  .cover { margin:18px 0 6px; padding:18px 20px; border-radius:14px; background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 14%,#fff),#fff); border:1px solid color-mix(in srgb,var(--accent) 30%,#fff); }
  .cover h1 { font-size:24px; }
  .cover p { margin:8px 0 0; color:#374151; }
  h2.section { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin:22px 0 8px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid var(--line); background:var(--surface); border-radius:12px; padding:12px 14px; }
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
  .totals { margin-top:14px; margin-left:auto; width:min(360px,100%); border:1px solid color-mix(in srgb,var(--accent) 40%,#fff); border-radius:12px; overflow:hidden; }
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

  ${quote.design.show_cover ? `<div class="cover">
      <h1>${esc(quote.title || "Предложение по организации мероприятия")}</h1>
      ${quote.texts.intro ? `<p>${esc(quote.texts.intro)}</p>` : ""}
    </div>` : ""}

  <h2 class="section">Заказчик и мероприятие</h2>
  <div class="grid-2">
    <div class="card">
      <div class="label">Заказчик</div>
      <div class="name">${esc(quote.client_company || quote.client_name || "—")}</div>
      ${[quote.client_company && quote.client_name ? `Контакт: ${quote.client_name}` : "", quote.client_unp ? `УНП ${quote.client_unp}` : "", quote.client_phone, quote.client_email, quote.client_address]
        .filter(Boolean)
        .map((l) => `<div class="line">${esc(l)}</div>`)
        .join("")}
    </div>
    <div class="card">
      <div class="label">Мероприятие</div>
      <table class="info-table">
        ${eventRows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("") || `<tr><td class="k">Детали</td><td>уточняются</td></tr>`}
      </table>
    </div>
  </div>
  ${quote.event_notes ? `<p style="color:#374151;white-space:pre-line;margin-top:10px;">${esc(quote.event_notes)}</p>` : ""}

  <h2 class="section">Состав предложения</h2>
  <table>
    <thead><tr><th></th><th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
    <tbody>${tableBody || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:22px;">Позиции не добавлены</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Стоимость позиций</span><span>${money(t.subtotal)}</span></div>
    ${t.discount ? `<div class="row"><span>Скидка</span><span>−${money(t.discount)}</span></div>` : ""}
    ${t.delivery ? `<div class="row"><span>Доставка и логистика</span><span>${money(t.delivery)}</span></div>` : ""}
    <div class="row total"><span>Итого</span><span>${money(t.total)}</span></div>
    ${t.prepayment ? `<div class="row"><span>Предоплата</span><span>${money(t.prepayment)}</span></div><div class="row"><span>Остаток</span><span>${money(t.balance)}</span></div>` : ""}
  </div>
  <div class="words">${esc(amountToWords(t.total))}. ${esc(quote.vat_note || settings.vat_note)}</div>

  ${quote.texts.included ? `<h2 class="section">Что входит</h2><ul>${lines(quote.texts.included)}</ul>` : ""}
  ${quote.texts.excluded ? `<h2 class="section">Не входит</h2><ul>${lines(quote.texts.excluded)}</ul>` : ""}
  ${quote.texts.timeline ? `<h2 class="section">Сроки и логистика</h2>${paragraphs(quote.texts.timeline)}` : ""}
  ${quote.texts.terms ? `<h2 class="section">Условия</h2>${paragraphs(quote.texts.terms)}` : ""}

  ${quote.design.show_requisites ? `<h2 class="section">Реквизиты исполнителя</h2>
  <div class="card">
    <div class="name">${esc(c.legal)}</div>
    ${[c.unp ? `УНП ${c.unp}` : "", c.address, c.bank_account ? `р/с ${c.bank_account}` : "", c.bank_name, c.bank_bic ? `БИК ${c.bank_bic}` : "", [c.phone, c.email, c.website].filter(Boolean).join(" · ")]
      .filter(Boolean)
      .map((l) => `<div class="line">${esc(l)}</div>`)
      .join("")}
  </div>` : ""}

  ${quote.design.show_signature ? `<div class="sign">
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
  </div>` : ""}

  <div class="footer">
    ${esc(quote.texts.footer || settings.quote_footer)}
    <div style="margin-top:4px;">${esc(c.legal)} · ${esc(c.phone)} · ${esc(c.email)} · ${esc(c.website)}</div>
  </div>
</div></body></html>`;
}
