// Дополнительные колонки «Себестоимость / Прибыль / %» для превью КП.
// Только экранный/печатный внутренний режим: клиентский HTML и PDF эти
// колонки не получают (в них опция просто не передаётся).
import { buildEconomics, marginTone, type EconInput } from "@/lib/documents/economics";

export type MarginCell = {
  cost: number;
  margin: number;
  marginPct: number;
  hasCost: boolean;
};

export type MarginCols = Record<string, MarginCell>;

/** Строит карту «id позиции → себестоимость/прибыль» из уже существующей математики. */
export function buildMarginCols(rows: EconInput[]): MarginCols {
  const econ = buildEconomics(rows);
  const map: MarginCols = {};
  for (const s of econ.sections) {
    for (const r of s.rows) {
      map[r.id] = {
        cost: r.cost,
        margin: r.margin,
        marginPct: r.marginPct,
        hasCost: r.cost > 0,
      };
    }
  }
  return map;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const TONE_COLOR: Record<string, string> = {
  bad: "#dc2626",
  warn: "#d97706",
  good: "#059669",
  none: "#9ca3af",
};

export const MARGIN_COLS_CSS = `
.mg-head{white-space:nowrap;}
.mg{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.mg-bad{color:${TONE_COLOR.bad};}
.mg-warn{color:${TONE_COLOR.warn};}
.mg-good{color:${TONE_COLOR.good};}
.mg-none{color:${TONE_COLOR.none};}
`;

/** Три ячейки заголовка. */
export function marginHeadCells(): string {
  return `<th class="num mg-head">Себестоимость</th><th class="num mg-head">Прибыль</th><th class="num mg-head">%</th>`;
}

/** Три ячейки строки позиции. */
export function marginBodyCells(cell: MarginCell | undefined): string {
  if (!cell) return `<td class="mg mg-none">—</td><td class="mg mg-none">—</td><td class="mg mg-none">—</td>`;
  const tone = `mg-${marginTone(cell.marginPct, cell.hasCost)}`;
  const pct = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(cell.marginPct || 0);
  return `<td class="mg">${fmt(cell.cost)}</td><td class="mg ${tone}">${fmt(cell.margin)}</td><td class="mg ${tone}">${pct}%</td>`;
}

/** Пустые ячейки — для служебных строк (НДС, подытог раздела). */
export function marginEmptyCells(): string {
  return `<td class="mg"></td><td class="mg"></td><td class="mg"></td>`;
}

/** CSS альбомного листа: разворачивает A4 и печать. */
export function landscapeSheetCss(): string {
  return `
  @page { size: A4 landscape; }
  .sheet { width: 297mm !important; min-height: 210mm !important; }
  @media screen { body { zoom: min(1, calc((100vw - 24px) / 1123px)); } }
  `;
}
