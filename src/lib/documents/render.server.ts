// Общий рендер документов (КП, счёт, договор) для admin-роутов.
// Стиль документа = «сайт на бумаге»: акцентная полоса/градиент сверху,
// мягкие карточки, моно-цифры, опрятный print CSS.
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { BASE_PRINT_PRESET } from "@/lib/documents/print-preset";
import { sheetCss } from "@/lib/documents/sheet";


export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function money(n: number): string {
  return new Intl.NumberFormat("ru-BY", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 2,
  }).format(n);
}

type AdminLike = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
  };
};

export async function loadDocumentSettings(
  supabaseAdmin: AdminLike,
  companyId?: string | null,
): Promise<DocumentSettings> {
  let settings: DocumentSettings;
  try {
    const { data } = await supabaseAdmin
      .from("document_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (!data) settings = DEFAULT_DOCUMENT_SETTINGS;
    else {
      const row = data as Record<string, unknown>;
      settings = {
        ...(row as unknown as DocumentSettings),
        contract_sections: Array.isArray(row.contract_sections)
          ? (row.contract_sections as { title: string; paragraphs: string[] }[])
          : DEFAULT_DOCUMENT_SETTINGS.contract_sections,
      };
    }
  } catch {
    settings = DEFAULT_DOCUMENT_SETTINGS;
  }

  // Профиль компании документа (или основной), накладывается поверх настроек.
  try {
    const { applyCompanyProfile, normalizeCompanyProfile } = await import(
      "@/lib/documents/company-profile"
    );
    const query = supabaseAdmin.from("company_profiles").select("*");
    const { data } = companyId
      ? await query.eq("id", companyId).maybeSingle()
      : await query.eq("is_default", true).maybeSingle();
    if (data) {
      return applyCompanyProfile(settings, normalizeCompanyProfile(data as Record<string, unknown>));
    }
  } catch {
    /* профиль не обязателен — остаёмся на общих настройках */
  }
  return settings;
}


type ShellOpts = {
  title: string;
  kind: "Коммерческое предложение" | "Счёт-фактура" | "Договор" | "Акт оказанных услуг";
  number: string;
  date: string;
  settings: DocumentSettings;
  body: string;
};

// Базовый каркас: HEAD + общие стили + brand-шапка + контент + футер.
export function renderShell({ title, kind, number, date, settings, body }: ShellOpts): string {
  const accent = settings.accent_color || "#FF7500";
  const logo = settings.logo_url
    ? `<img src="${esc(settings.logo_url)}" alt="" style="height:36px;width:auto;display:block;" />`
    : "";

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  :root { --accent: ${esc(accent)}; }
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", "PT Sans", Roboto, sans-serif;
    color: #111827; margin: 0; font-size: 12px; line-height: 1.55; }
  ${sheetCss({ ...BASE_PRINT_PRESET, marginTopMm: 16, marginBottomMm: 16, marginXMm: 14 })}

  .accent-bar { height: 4px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff)); border-radius: 2px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 14px 0 12px; border-bottom: 1px solid #e5e7eb; }
  .brand-wrap { display: flex; align-items: center; gap: 12px; }
  .brand { font-size: 18px; font-weight: 700; letter-spacing: .2px; color: #111827; }
  .brand .sub { font-size: 10.5px; font-weight: 400; color: #6b7280; margin-top: 2px; }
  .meta { text-align: right; font-size: 11px; color: #6b7280; }
  .meta .kind { font-size: 13px; font-weight: 600; color: #111827; letter-spacing: .3px; text-transform: uppercase; }
  .meta .num { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace; color: var(--accent); font-weight: 600; margin-top: 4px; }
  h1, h2 { color: #111827; }
  h1.section { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; font-weight: 600; }
  h2.section { font-size: 13px; margin: 16px 0 6px; color: var(--accent); font-weight: 600; }
  .card { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; font-size: 10.5px; text-transform: uppercase; color: #475569; letter-spacing: .4px; }
  tbody tr:nth-child(even) td { background: #fcfcfd; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.qty, th.qty { text-align: center; vertical-align: middle; white-space: nowrap; font-variant-numeric: tabular-nums; width: 78px; }
  tfoot td { font-weight: 700; border-top: 2px solid var(--accent); color: #111827; }
  .summary { margin-top: 12px; padding: 12px 14px; background: color-mix(in srgb, var(--accent) 6%, #fff); border: 1px solid color-mix(in srgb, var(--accent) 18%, #e5e7eb); border-radius: 8px; }
  .summary .row { display: flex; justify-content: space-between; padding: 3px 0; font-variant-numeric: tabular-nums; }
  .summary .total { font-weight: 700; font-size: 15px; color: var(--accent); border-top: 1px solid color-mix(in srgb, var(--accent) 25%, #e5e7eb); margin-top: 6px; padding-top: 6px; }
  .sign { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 11px; }
  .sign h3 { font-size: 10.5px; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; letter-spacing: .5px; }
  .sign .line { border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 36px; color: #475569; }
  .footer { margin-top: 26px; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .notes { margin-top: 14px; font-size: 11.5px; color: #374151; white-space: pre-wrap; padding: 10px 12px; background: #fafafa; border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; }
  ol, ul { margin: 4px 0 4px 18px; padding: 0; }
  ol > li, ul > li { margin: 3px 0; }
  p { margin: 4px 0; text-align: justify; }
  .print-btn { position: fixed; top: 14px; right: 14px; padding: 9px 16px;
    background: var(--accent); color: #fff; border: 0; border-radius: 8px; cursor: pointer;
    font-size: 12.5px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,.18);
    text-decoration: none; display: inline-block; }
  .print-btn:hover { filter: brightness(1.05); }
  @media print { .print-btn { display: none; } body { font-size: 11.5px; } }
</style></head><body>
  <a class="print-btn" href="?format=pdf">Скачать PDF</a>
  <div class="sheet">
  <div class="accent-bar"></div>

  <div class="head">
    <div class="brand-wrap">
      ${logo}
      <div class="brand">
        ${esc(settings.company_brand)}
        <div class="sub">${esc(settings.company_legal_name)} · ${esc(settings.company_address)}</div>
      </div>
    </div>
    <div class="meta">
      <div class="kind">${esc(kind)}</div>
      <div class="num">№ ${esc(number)}</div>
      <div>от ${esc(date)}</div>
    </div>
  </div>
  ${body}
  <div class="footer">
    ${esc(settings.company_legal_name)} · ${esc(settings.company_phone)} · ${esc(settings.company_email)} · ${esc(settings.company_website)}
  </div>
</body></html>`;
}

export function partyCard(opts: {
  label: string;
  name: string;
  lines: (string | null | undefined)[];
}): string {
  const filtered = opts.lines.filter((x): x is string => !!x && x.trim() !== "");
  return `<div class="card">
    <h2 class="section" style="margin-top:0">${esc(opts.label)}</h2>
    <div style="font-weight:600;color:#111827;font-size:13px;margin-bottom:4px;">${esc(opts.name)}</div>
    ${filtered.map((l) => `<div style="color:#374151;">${esc(l)}</div>`).join("")}
  </div>`;
}
