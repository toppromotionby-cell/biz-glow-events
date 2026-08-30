// HTML-превью корпоративного документа (A4). Тот же источник блоков, что и PDF,
// поэтому превью и файл совпадают по составу и порядку.
import type { CompanyProfile } from "@/lib/documents/company-profile";
import { fontStacks } from "@/lib/documents/doc-font";
import type { PwBlank, PwBlock, PwDocument } from "@/lib/paperwork/model";
import { fittedBlank } from "./fit-page";
import { blockTotals, formatMoney, lineTotal } from "@/lib/paperwork/totals";
import { logoImgStyle, logoWrapStyle, requisitesStyle } from "@/lib/documents/logo-layout";
import { colgroupHtml, lineItemColFractions, tableColFractions } from "@/lib/paperwork/table-cols";
import { resolveSignature, signatureMediaHtml, SIGN_MEDIA_CSS } from "@/lib/documents/signature";


const esc = (s: string): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (s: string): string => esc(s).replace(/\n/g, "<br/>");

/** Строки реквизитов НАШЕЙ компании (данные клиента в шапку не попадают). */
export function companyRequisiteLines(company: CompanyProfile | null): string[] {
  if (!company) return [];
  const lines: string[] = [];
  if (company.company_legal_name) lines.push(company.company_legal_name);
  if (company.company_unp) lines.push(`УНП ${company.company_unp}`);
  if (company.company_address) lines.push(company.company_address);
  const contacts = [company.company_phone, company.company_email, company.company_website]
    .filter(Boolean)
    .join(" · ");
  if (contacts) lines.push(contacts);
  return lines;
}

/** Логотип клиента берётся из переменной документа `client_logo` (URL). */
export function clientLogoUrlFrom(values: Record<string, string> | undefined | null): string | null {
  const raw = String(values?.client_logo ?? values?.client_logo_url ?? "").trim();
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function headerHtml(company: CompanyProfile | null, blank: PwBlank, clientLogo: string | null): string {
  if (blank.headerLayout === "none") return "";
  const align =
    blank.headerLayout === "logo-center" ? "center" : blank.headerLayout === "logo-right" ? "right" : "left";
  const layout = { ...blank.logoLayout, align } as PwBlank["logoLayout"];
  const logo = company?.logo_url
    ? `<img src="${esc(company.logo_url)}" alt="" class="logo" style="${logoImgStyle(layout)}"/>`
    : `<div class="brand">${esc(company?.company_brand || company?.company_legal_name || "")}</div>`;
  const lines = blank.headerRequisites ? companyRequisiteLines(company) : [];
  const req = lines.length
    ? `<div class="req" style="${requisitesStyle(lines.join(" "), 9)}">
        <div class="req-name">${esc(lines[0])}</div>
        ${lines.slice(1).map((l) => `<div>${esc(l)}</div>`).join("")}
      </div>`
    : "";
  const client =
    blank.clientLogo && clientLogo
      ? `<div class="hd-client"><img src="${esc(clientLogo)}" alt="" class="logo-client"/></div>`
      : "";
  return `<header class="hd${align === "center" ? " hd-center" : ""}">
    <div class="hd-main" style="${logoWrapStyle(layout)}">${logo}${req}</div>
    ${client}
  </header>`;
}

function blockHtml(b: PwBlock, company: CompanyProfile | null): string {
  const align = b.align === "justify" ? "justify" : b.align;
  switch (b.type) {
    case "heading":
      return `<h2 class="h" style="text-align:${align}">${nl2br(b.text)}</h2>`;
    case "recipient":
      return `<div class="recipient" style="text-align:${align}">${nl2br(b.text)}</div>`;
    case "note":
      return `<div class="note" style="text-align:${align}">${nl2br(b.text)}</div>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag} class="list">${b.items.map((i) => `<li>${nl2br(i)}</li>`).join("")}</${tag}>`;
    }
    case "table": {
      const head = b.header.length
        ? `<thead><tr>${b.header.map((h) => `<th>${nl2br(h)}</th>`).join("")}</tr></thead>`
        : "";
      const body = b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${nl2br(c)}</td>`).join("")}</tr>`)
        .join("");
      const cg = colgroupHtml(tableColFractions(b.header, b.rows));
      return `<table class="tbl">${cg}${head}<tbody>${body}</tbody></table>`;
    }

    case "signature": {
      // Подпись и печать берём из карточки компании — как в PDF и DOCX.
      const media = signatureMediaHtml(
        resolveSignature({
          companySignatureUrl: company?.signature_url ?? null,
          companyStampUrl: company?.stamp_url ?? null,
          showSignature: b.withSignature,
          showStamp: b.withStamp,
        }),
      );
      return `<div class="sign">
        <div class="sign-title">${nl2br(b.signerTitle)}</div>
        <div class="sign-line-wrap">${media}<div class="sign-line"></div></div>
        <div class="sign-name">${nl2br(b.signerName)}</div>
      </div>`;
    }
    case "spacer":
      return `<div style="height:${Math.round(b.size)}px"></div>`;
    case "lineitems": {
      const t = blockTotals(b);
      const rows = b.lines
        .map(
          (l, i) => `<tr><td>${i + 1}</td><td>${nl2br(l.name)}</td><td class="num">${esc(
            String(l.qty),
          )}</td><td>${esc(l.unit)}</td><td class="num">${formatMoney(l.price)}</td><td class="num">${formatMoney(
            lineTotal(l),
          )}</td></tr>`,
        )
        .join("");
      const vatRow = b.vatPct
        ? `<tr><td colspan="5" class="num">НДС ${b.vatPct}%</td><td class="num">${formatMoney(t.vat)}</td></tr>`
        : "";
      const words = b.totalWords
        ? `<div class="words">Сумма прописью: ${esc(t.words)}</div>`
        : "";
      const cg = colgroupHtml(
        lineItemColFractions(
          b.lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unit: l.unit,
            price: formatMoney(l.price),
            total: formatMoney(lineTotal(l)),
          })),
        ),
      );
      return `<table class="tbl items">${cg}<thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Цена</th><th>Сумма</th></tr></thead>

        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="5" class="num">Итого без НДС</td><td class="num">${formatMoney(t.net)}</td></tr>
          ${vatRow}
          <tr class="grand"><td colspan="5" class="num">Всего к оплате, ${esc(t.currency)}</td><td class="num">${formatMoney(t.gross)}</td></tr>
        </tfoot></table>${words}`;
    }
    case "parties":
      return `<div class="parties">
        <div><div class="pt">${esc(b.leftTitle)}</div><div class="pv">${nl2br(b.leftText)}</div></div>
        <div><div class="pt">${esc(b.rightTitle)}</div><div class="pv">${nl2br(b.rightText)}</div></div>
      </div>`;
    default:
      return `<p class="p${b.indent ? " ind" : ""}" style="text-align:${align}">${nl2br(b.text)}</p>`;
  }
}

export function paperworkHtml(opts: {
  doc: Pick<PwDocument, "title" | "doc_number" | "doc_date">;
  blocks: PwBlock[];
  company: CompanyProfile | null;
  blank: PwBlank;
  /** URL логотипа клиента (опционально). */
  clientLogoUrl?: string | null;
  /** Альбомный лист A4 (ведомости, штатное расписание, табель). */
  landscape?: boolean;
}): string {
  const { doc, blocks, company } = opts;
  // Кегль и поля берём уже подогнанными: тот же расчёт применяется в PDF и DOCX.
  const landscape = opts.landscape === true;
  const blank = fittedBlank(opts.blocks, opts.blank, landscape);
  const stacks = fontStacks(blank.font);
  const accent = blank.accentColor || "#FF7500";
  const dateLabel = (() => {
    const d = new Date(`${doc.doc_date}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? doc.doc_date
      : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  })();
  const meta = `<div class="meta"><span>${doc.doc_number ? `№ ${esc(doc.doc_number)}` : ""}</span><span>${esc(dateLabel)}</span></div>`;
  const footer = blank.footer
    ? `<footer class="ft">${esc(
        blank.footerText ||
          [company?.company_legal_name, company?.company_address, company?.company_phone]
            .filter(Boolean)
            .join(" · "),
      )}</footer>`
    : "";
  const bg = blank.backgroundUrl
    ? `<img class="bg" src="${esc(blank.backgroundUrl)}" alt="" style="opacity:${blank.backgroundOpacity}"/>`
    : "";

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
<title>${esc(doc.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@700&family=Ubuntu:wght@400;500;700&display=swap"/>
<style>
  :root { --accent:${accent}; }
  * { box-sizing:border-box; }
  body { margin:0; background:#eef0f4; font-family:${stacks.body}; color:#1c1f24; overflow-x:hidden; }
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin:0; }
  .sheet { position:relative; width:${landscape ? "297mm" : "210mm"}; max-width:${landscape ? "297mm" : "210mm"}; min-height:${landscape ? "210mm" : "297mm"}; margin:0 auto; background:#fff;
    padding:${blank.marginTopMm}mm ${blank.marginXMm}mm ${blank.marginBottomMm}mm;
    font-size:${blank.fontSizePt}pt; line-height:1.45; overflow-wrap:anywhere; }
  .sheet img, .sheet table { max-width:100%; }

  .bar { position:absolute; left:0; right:0; top:0; height:5px; background:var(--accent); }
  .bg { position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); width:120mm; pointer-events:none; }
  .hd { display:flex; align-items:flex-start; justify-content:space-between; gap:14px;
    border-bottom:1px solid #e2e5ea; padding-bottom:10px; margin-bottom:16px; }
  .hd-main { flex:1 1 auto; min-width:0; }
  .hd-center { justify-content:center; }
  .hd-center .hd-main { text-align:center; }
  .hd-client { flex:0 0 auto; padding-left:12px; border-left:1px solid #e2e5ea; }
  .logo-client { max-height:16mm; max-width:40mm; object-fit:contain; display:block; }
  .logo { display:block; object-fit:contain; }
  .brand { font-family:${stacks.display}; font-size:16pt; font-weight:700; color:var(--accent); }
  .req { color:#5b6270; }
  .req-name { font-weight:600; color:#1c1f24; }
  .meta { display:flex; justify-content:space-between; font-size:9.5pt; color:#5b6270; margin-bottom:12px; }
  .h { font-family:${stacks.display}; font-size:13.5pt; font-weight:700; margin:14px 0 8px; }
  .p { margin:0 0 8px; }
  .p.ind { text-indent:8mm; }
  .recipient { margin:0 0 14px; font-size:10.5pt; white-space:pre-line; }
  .note { margin:10px 0; padding:8px 10px; background:#f6f7f9; border-left:3px solid var(--accent);
    font-size:9.5pt; color:#41474f; }
  .list { margin:0 0 10px; padding-left:7mm; }
  .list li { margin-bottom:4px; }
  .tbl { width:100%; table-layout:fixed; border-collapse:collapse; margin:10px 0; font-size:10pt; }
  .tbl th, .tbl td { border:1px solid #d7dbe2; padding:5px 7px; text-align:left; vertical-align:top;
    overflow-wrap:break-word; hyphens:manual; -webkit-hyphens:manual; }

  .tbl th { background:#f4f5f7; font-weight:600; }
  .tbl .num { text-align:right; white-space:nowrap; }
  .tbl tfoot td { font-weight:600; background:#fafbfc; }
  .tbl tfoot .grand td { background:#f4f5f7; font-size:10.5pt; }
  .words { font-size:9.5pt; color:#41474f; margin:-4px 0 10px; }
  .parties { display:flex; gap:10mm; margin:12px 0; font-size:9.5pt; }
  .parties > div { flex:1; }
  .pt { font-weight:600; margin-bottom:4px; }
  .pv { white-space:pre-line; color:#41474f; }
  .sign { margin-top:22px; display:flex; align-items:flex-end; gap:10px; font-size:10.5pt; }
  .sign-title { min-width:45mm; }
  .sign-line-wrap { position:relative; flex:1; max-width:55mm; }
  .sign-line { border-bottom:1px solid #9aa1ac; height:1px; }
  ${SIGN_MEDIA_CSS}
  .sign-line-wrap .sign-media { position:absolute; left:0; right:0; bottom:0; height:0; }
  .sign-name { min-width:45mm; text-align:right; }
  .ft { margin-top:24px; padding-top:8px; border-top:1px solid #e2e5ea; font-size:8.5pt; color:#7a828f; text-align:center; }
  @media print { body { background:#fff; } .sheet { margin:0; } }
</style></head>
<body><div class="sheet">${blank.accentBar ? '<div class="bar"></div>' : ""}${bg}
${headerHtml(company, blank, opts.clientLogoUrl ?? null)}
${meta}
${blocks.map((b) => blockHtml(b, company)).join("\n")}
${footer}
</div></body></html>`;
}
