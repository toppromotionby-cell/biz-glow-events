// Экономика документа: себестоимость, маржа и подытоги по разделам.
// Общий модуль для КП и промо-КП. Данные только внутренние — в клиентские
// документы (HTML/PDF/публичная ссылка) ничего отсюда не попадает.

export type CostMode = "amount" | "percent";

export const COST_MODES: readonly CostMode[] = ["amount", "percent"] as const;

export const COST_MODE_LABELS: Record<CostMode, string> = {
  amount: "Сумма",
  percent: "% от цены",
};

const n = (v: unknown, d = 0) => {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(x) ? x : d;
};

export const round2 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;

export function normalizeCostMode(v: unknown): CostMode {
  return v === "percent" ? "percent" : "amount";
}

/**
 * Себестоимость за единицу по режиму ввода.
 * amount  — введено значение в деньгах;
 * percent — процент от цены продажи, пересчитывается при смене цены.
 */
export function resolveUnitCost(price: unknown, mode: unknown, input: unknown, fallback: unknown = 0): number {
  const m = normalizeCostMode(mode);
  if (m === "percent") return round2((n(price) * Math.min(Math.max(n(input), 0), 1000)) / 100);
  const v = n(input, NaN);
  return round2(Number.isFinite(v) && v !== 0 ? v : n(fallback));
}

/** Значение, которое показываем в поле ввода себестоимости. */
export function costInputValue(item: { cost_mode?: unknown; cost_input?: unknown; cost?: unknown }): number {
  return normalizeCostMode(item.cost_mode) === "percent" ? n(item.cost_input) : n(item.cost_input, 0) || n(item.cost);
}

/** Патч позиции при изменении режима: сохраняем экономический смысл. */
export function costModePatch(
  item: { price?: unknown; cost?: unknown; cost_input?: unknown; cost_mode?: unknown },
  mode: CostMode,
): { cost_mode: CostMode; cost_input: number; cost: number } {
  const price = n(item.price);
  const unitCost = n(item.cost);
  if (mode === "percent") {
    const pct = price > 0 ? round2((unitCost / price) * 100) : 0;
    return { cost_mode: "percent", cost_input: pct, cost: resolveUnitCost(price, "percent", pct) };
  }
  return { cost_mode: "amount", cost_input: unitCost, cost: unitCost };
}

/** Патч позиции при вводе значения себестоимости. */
export function costValuePatch(
  item: { price?: unknown; cost_mode?: unknown },
  value: number,
): { cost_input: number; cost: number } {
  const mode = normalizeCostMode(item.cost_mode);
  const cost = resolveUnitCost(item.price, mode, value);
  return { cost_input: round2(value), cost };
}

// ==== Расчёт таблицы ====

export type EconInput = {
  id: string;
  section: string;
  title: string;
  qty: number;
  qtyLabel: string;
  price: number;
  unitCost: number;
  costMode: CostMode;
  costInput: number;
  /** Позиция не участвует в итоге (опция / справочная строка). */
  excluded?: boolean;
};

export type EconRow = EconInput & {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  hasCost: boolean;
};

export type EconSection = {
  name: string;
  rows: EconRow[];
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
};

export type Economics = {
  sections: EconSection[];
  rows: EconRow[];
  /** Сумма позиций до скидки и доставки. */
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  /** Выручка после скидки/доставки, без НДС — то, что реально получаем. */
  netRevenue: number;
  netMargin: number;
  netMarginPct: number;
  /** Средняя наценка на себестоимость, %. */
  avgMarkupPct: number;
  /** Сколько позиций без заполненной себестоимости. */
  missingCount: number;
  hasAnyCost: boolean;
};

const pct = (part: number, base: number) => (base > 0 ? round2((part / base) * 100) : 0);

export const NO_SECTION_LABEL = "Без раздела";

export function buildEconomics(input: EconInput[], opts: { netRevenue?: number } = {}): Economics {
  const rows: EconRow[] = input.map((it) => {
    const revenue = round2(n(it.qty) * n(it.price));
    const cost = round2(n(it.qty) * n(it.unitCost));
    const margin = round2(revenue - cost);
    return { ...it, revenue, cost, margin, marginPct: pct(margin, revenue), hasCost: n(it.unitCost) > 0 };
  });

  const counted = rows.filter((r) => !r.excluded);
  const order: string[] = [];
  const map = new Map<string, EconRow[]>();
  for (const r of rows) {
    const key = r.section?.trim() || NO_SECTION_LABEL;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(r);
  }

  const sections: EconSection[] = order.map((name) => {
    const list = map.get(name)!;
    const paid = list.filter((r) => !r.excluded);
    const revenue = round2(paid.reduce((s, r) => s + r.revenue, 0));
    const cost = round2(paid.reduce((s, r) => s + r.cost, 0));
    const margin = round2(revenue - cost);
    return { name, rows: list, revenue, cost, margin, marginPct: pct(margin, revenue) };
  });

  const revenue = round2(counted.reduce((s, r) => s + r.revenue, 0));
  const cost = round2(counted.reduce((s, r) => s + r.cost, 0));
  const margin = round2(revenue - cost);
  const netRevenue = round2(opts.netRevenue ?? revenue);
  const netMargin = round2(netRevenue - cost);

  return {
    sections,
    rows,
    revenue,
    cost,
    margin,
    marginPct: pct(margin, revenue),
    netRevenue,
    netMargin,
    netMarginPct: pct(netMargin, netRevenue),
    avgMarkupPct: cost > 0 ? round2(((revenue - cost) / cost) * 100) : 0,
    missingCount: counted.filter((r) => !r.hasCost).length,
    hasAnyCost: counted.some((r) => r.hasCost),
  };
}

export type MarginTone = "bad" | "warn" | "good" | "none";

export function marginTone(marginPct: number, hasCost = true): MarginTone {
  if (!hasCost) return "none";
  if (marginPct < 15) return "bad";
  if (marginPct < 30) return "warn";
  return "good";
}

export const MARGIN_TONE_CLASS: Record<MarginTone, string> = {
  bad: "text-destructive",
  warn: "text-amber-500",
  good: "text-emerald-500",
  none: "text-muted-foreground",
};
