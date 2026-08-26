// Внутренний PDF «Себестоимость и маржа». Формируется отдельной кнопкой,
// клиенту не отправляется: в шапке — плашка «внутренний документ».
import { rgb } from "pdf-lib";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { buildEconomics, type EconInput } from "@/lib/documents/economics";
import { createCtx } from "@/lib/documents/pdf.server";
import { drawHeader, drawFooter } from "@/lib/documents/pdf/chrome.server";
import { drawTable, drawSummary, fitTableCols, type Col, type TableRow } from "@/lib/documents/pdf/table.server";
import { ensureSpace, gap, money, num, roundedRect } from "@/lib/documents/pdf/draw.server";
import { M, MUTED, PAGE_W } from "@/lib/documents/pdf/style.server";
import { fmtDate } from "@/lib/formatters";

const pct = (v: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v || 0)}%`;

export type EconPdfMeta = {
  docLabel: string;
  client?: string;
  netLabel?: string;
  logoUrl?: string | null;
  netRevenue?: number;
};

export async function buildEconomicsPdf(
  rows: EconInput[],
  settings: DocumentSettings,
  meta: EconPdfMeta,
): Promise<Uint8Array> {
  const econ = buildEconomics(rows, { netRevenue: meta.netRevenue });
  const ctx = await createCtx(meta.logoUrl ?? settings.logo_url, null, null);

  drawHeader(ctx, "Внутренний расчёт", meta.docLabel, fmtDate(new Date()), settings);

  // Плашка «не для клиента».
  ensureSpace(ctx, 34);
  const plaqueH = 22;
  roundedRect(ctx.page, {
    x: M.MARGIN_X,
    y: ctx.y - plaqueH,
    width: PAGE_W - M.MARGIN_X * 2,
    height: plaqueH,
    color: rgb(1, 0.976, 0.918),
    borderColor: rgb(0.85, 0.47, 0.02),
    borderWidth: 0.6,
    radius: 6,
  });
  ctx.page.drawText("Внутренний документ — не для клиента", {
    x: M.MARGIN_X + 10,
    y: ctx.y - plaqueH + 7,
    size: M.F11,
    font: ctx.bold,
    color: rgb(0.57, 0.25, 0.05),
  });
  ctx.y -= plaqueH;
  gap(ctx, 8);

  if (meta.client) {
    ctx.page.drawText(`Клиент: ${meta.client}`, {
      x: M.MARGIN_X, y: ctx.y - M.F11, size: M.F11, font: ctx.regular, color: MUTED,
    });
    ctx.y -= M.F11 + 8;
  }

  const cols: Col[] = [
    { key: "title", title: "Позиция", width: 0, align: "left" },
    { key: "qty", title: "Кол-во", width: 0, align: "center" },
    { key: "price", title: "Цена, BYN", width: 0, align: "right" },
    { key: "unitCost", title: "С/с ед., BYN", width: 0, align: "right" },
    { key: "revenue", title: "Сумма, BYN", width: 0, align: "right" },
    { key: "cost", title: "С/с, BYN", width: 0, align: "right" },
    { key: "margin", title: "Прибыль, BYN", width: 0, align: "right" },
    { key: "marginPct", title: "%", width: 0, align: "right" },
  ];

  const tableRows: TableRow[] = [];
  for (const s of econ.sections) {
    if (econ.sections.length > 1 || s.name) tableRows.push({ _kind: "section", title: s.name });
    for (const r of s.rows) {
      tableRows.push({
        title: `${r.title || "Без названия"}${r.excluded ? " (не в итоге)" : ""}`,
        qty: r.qtyLabel,
        price: num(r.price),
        unitCost: num(r.unitCost),
        revenue: num(r.revenue),
        cost: num(r.cost),
        margin: num(r.margin),
        marginPct: r.hasCost ? pct(r.marginPct) : "—",
      });
    }
    tableRows.push({
      _kind: "subtotal",
      title: `Итого «${s.name}»: сумма ${money(s.revenue)} · себестоимость ${money(s.cost)} · прибыль ${money(s.margin)}`,
      marginPct: pct(s.marginPct),
    });
  }


  const tableW = PAGE_W - M.MARGIN_X * 2;
  fitTableCols(ctx, cols, tableRows, tableW);
  drawTable(ctx, cols, tableRows);
  gap(ctx, 10);

  drawSummary(ctx, [
    { label: "Сумма позиций", value: money(econ.revenue) },
    { label: "Себестоимость", value: money(econ.cost) },
    { label: `Средняя наценка`, value: pct(econ.avgMarkupPct) },
    { label: `Прибыль (${meta.netLabel ?? "после скидки и доставки"})`, value: money(econ.netMargin), emphasis: true },
    { label: "Рентабельность", value: pct(econ.netMarginPct) },
  ]);

  if (econ.missingCount) {
    gap(ctx, 10);
    ensureSpace(ctx, 20);
    ctx.page.drawText(`Себестоимость не заполнена у ${econ.missingCount} поз. — прибыль завышена.`, {
      x: M.MARGIN_X, y: ctx.y - M.F11, size: M.F11, font: ctx.regular, color: rgb(0.77, 0.15, 0.15),
    });
    ctx.y -= M.F11 + 6;
  }

  drawFooter(ctx, settings);
  return ctx.pdf.save();
}
