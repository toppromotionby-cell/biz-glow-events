// Внутренний бланк «Себестоимость и маржа»: HTML для превью в редакторе,
// отдельного окна и серверного роута. Клиенту этот документ не отдаётся.
import { buildEconomics, marginTone, type EconInput, type Economics } from "@/lib/documents/economics";

export type EconSheetMeta = {
  /** «КП №2026/12» */
  docLabel: string;
  client?: string;
  date?: string;
  companyLine?: string;
  netLabel?: string;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pct = (v: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v || 0)}%`;

const TONE: Record<string, string> = { bad: "bad", warn: "warn", good: "good", none: "muted" };
const tone = (v: number, hasCost = true) => TONE[marginTone(v, hasCost)];

export const ECON_SHEET_CSS = `
.econ{font:400 13px/1.45 Inter,system-ui,sans-serif;color:#111827;}
.econ .plaque{display:flex;align-items:center;gap:8px;border:1px dashed #d97706;background:#fffbeb;color:#92400e;
  border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;margin-bottom:14px;}
.econ h1{font-size:19px;margin:0 0 2px;font-weight:700;}
.econ .sub{color:#6b7280;font-size:12px;margin-bottom:14px;}
.econ .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
.econ .card{border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;background:#fafafa;}
.econ .card b{display:block;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px;}
.econ .card span{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;}
.econ .card i{font-style:normal;font-size:11px;color:#6b7280;}
.econ table{width:100%;border-collapse:collapse;font-size:12px;}
.econ th{background:#f3f4f6;text-align:left;padding:6px 8px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;
  border-bottom:1px solid #e5e7eb;}
.econ td{padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
.econ .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.econ .sec td{background:#f8fafc;font-weight:700;}
.econ tfoot td{background:#f3f4f6;font-weight:700;border-top:2px solid #e5e7eb;}
.econ .good{color:#059669;} .econ .warn{color:#d97706;} .econ .bad{color:#dc2626;} .econ .muted{color:#9ca3af;}
.econ .off{opacity:.55;}
.econ .warnbox{margin-top:12px;border:1px solid #fcd34d;background:#fffbeb;color:#92400e;border-radius:8px;padding:8px 10px;font-size:12px;}
`;

/** Тело бланка (без обёртки html/head). */
export function buildEconomicsSheetBody(meta: EconSheetMeta, econ: Economics): string {
  const rows = econ.sections
    .map((s) => {
      const head = `<tr class="sec"><td>${esc(s.name)}</td><td colspan="3"></td>
        <td class="num">${money(s.revenue)}</td><td class="num">${money(s.cost)}</td>
        <td class="num ${tone(s.marginPct, s.cost > 0)}">${money(s.margin)}</td>
        <td class="num ${tone(s.marginPct, s.cost > 0)}">${pct(s.marginPct)}</td></tr>`;
      const body = s.rows
        .map(
          (r) => `<tr class="${r.excluded ? "off" : ""}">
        <td>${esc(r.title || "Без названия")}${r.excluded ? ' <span class="muted">(не в итоге)</span>' : ""}</td>
        <td class="num">${esc(r.qtyLabel)}</td>
        <td class="num">${money(r.price)}</td>
        <td class="num">${money(r.unitCost)}${r.costMode === "percent" ? ` <span class="muted">${pct(r.costInput)}</span>` : ""}</td>
        <td class="num">${money(r.revenue)}</td>
        <td class="num">${money(r.cost)}</td>
        <td class="num ${tone(r.marginPct, r.hasCost)}">${money(r.margin)}</td>
        <td class="num ${tone(r.marginPct, r.hasCost)}">${r.hasCost ? pct(r.marginPct) : "—"}</td></tr>`,
        )
        .join("");
      return head + body;
    })
    .join("");

  const subParts = [meta.client, meta.date, meta.companyLine].filter(Boolean).map(esc);

  return `<div class="econ">
  <div class="plaque">Внутренний документ — не для клиента</div>
  <h1>Себестоимость и маржа · ${esc(meta.docLabel)}</h1>
  <div class="sub">${subParts.join(" · ")}</div>
  <div class="cards">
    <div class="card"><span>Выручка (позиции)</span><b>${money(econ.revenue)} BYN</b></div>
    <div class="card"><span>Себестоимость</span><b>${money(econ.cost)} BYN</b><i>Наценка ${pct(econ.avgMarkupPct)}</i></div>
    <div class="card"><span>Маржа</span><b class="${tone(econ.marginPct, econ.hasAnyCost)}">${money(econ.margin)} BYN</b><i>${pct(econ.marginPct)}</i></div>
    <div class="card"><span>Прибыль по итогу</span><b class="${tone(econ.netMarginPct, econ.hasAnyCost)}">${money(econ.netMargin)} BYN</b><i>${esc(meta.netLabel ?? "После скидки и доставки")} · ${pct(econ.netMarginPct)}</i></div>
  </div>
  <table>
    <thead><tr>
      <th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Себест./ед.</th>
      <th class="num">Сумма в КП</th><th class="num">Себестоимость</th><th class="num">Прибыль</th><th class="num">%</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="8" class="muted" style="padding:22px;text-align:center">Позиции не добавлены</td></tr>`}</tbody>
    <tfoot><tr>
      <td>Итого</td><td colspan="3"></td>
      <td class="num">${money(econ.revenue)}</td><td class="num">${money(econ.cost)}</td>
      <td class="num ${tone(econ.marginPct, econ.hasAnyCost)}">${money(econ.margin)}</td>
      <td class="num ${tone(econ.marginPct, econ.hasAnyCost)}">${pct(econ.marginPct)}</td>
    </tr></tfoot>
  </table>
  ${econ.missingCount ? `<div class="warnbox">Себестоимость не заполнена у ${econ.missingCount} поз. — прибыль завышена.</div>` : ""}
</div>`;
}

/** Полный HTML-документ бланка (для отдельного окна и серверного роута). */
export function buildEconomicsSheetDoc(meta: EconSheetMeta, rows: EconInput[], netRevenue?: number): string {
  const econ = buildEconomics(rows, { netRevenue });
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Внутренний расчёт · ${esc(meta.docLabel)}</title>
<style>body{margin:0;background:#f3f4f6;padding:24px;}
.sheet{background:#fff;max-width:900px;margin:0 auto;padding:28px 32px;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.12);}
${ECON_SHEET_CSS}</style></head>
<body><div class="sheet">${buildEconomicsSheetBody(meta, econ)}</div></body></html>`;
}
