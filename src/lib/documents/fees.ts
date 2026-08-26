// Единый расчёт дополнительных начислений документа: менеджмент и комиссия агентства.
// Работает по тем же правилам, что и НДС (src/lib/documents/vat.ts): browser-safe,
// используется в админке, в HTML-превью, в PDF и в экономике.

export const FEE_TYPES = ["none", "percent", "amount"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  none: "Нет",
  percent: "Процент",
  amount: "Сумма",
};

export type FeeSource = {
  management_type?: unknown;
  management_value?: unknown;
  agency_fee_type?: unknown;
  agency_fee_value?: unknown;
};

export type FeeConfig = {
  management: { type: FeeType; value: number };
  agency: { type: FeeType; value: number };
};

export type FeeLine = {
  key: "management" | "agency";
  label: string;
  amount: number;
  /** Пояснение вида «10% от 1 000,00» — для подсказок в редакторе. */
  hint: string;
};

export type FeesResult = {
  /** База, от которой считались начисления (сумма − скидка + доставка). */
  base: number;
  management: number;
  agency: number;
  total: number;
  lines: FeeLine[];
};

export const MANAGEMENT_LABEL = "Менеджмент";
export const AGENCY_FEE_LABEL = "Комиссия агентства";

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function normalizeFeeType(value: unknown): FeeType {
  const v = String(value ?? "none");
  return (FEE_TYPES as readonly string[]).includes(v) ? (v as FeeType) : "none";
}

export function feeConfig(source: FeeSource): FeeConfig {
  return {
    management: {
      type: normalizeFeeType(source.management_type),
      value: Math.max(0, num(source.management_value)),
    },
    agency: {
      type: normalizeFeeType(source.agency_fee_type),
      value: Math.max(0, num(source.agency_fee_value)),
    },
  };
}

export function feeAmount(base: number, fee: { type: FeeType; value: number }): number {
  if (fee.type === "percent") return r2((base * Math.min(Math.max(fee.value, 0), 100)) / 100);
  if (fee.type === "amount") return r2(Math.max(fee.value, 0));
  return 0;
}

const pct = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Начисления считаются последовательно:
 *   база = позиции − скидка + доставка
 *   менеджмент  — процент от базы либо фиксированная сумма
 *   комиссия    — процент от (база + менеджмент) либо фиксированная сумма
 * Результат прибавляется к базе ДО расчёта НДС.
 */
export function computeFees(base: number, cfg: FeeConfig): FeesResult {
  const b = r2(base);
  const management = feeAmount(b, cfg.management);
  const agency = feeAmount(r2(b + management), cfg.agency);
  const lines: FeeLine[] = [];
  if (management > 0) {
    lines.push({
      key: "management",
      label: MANAGEMENT_LABEL,
      amount: management,
      hint: cfg.management.type === "percent" ? `${pct(cfg.management.value)}% от ${r2(b)}` : "фиксированная сумма",
    });
  }
  if (agency > 0) {
    lines.push({
      key: "agency",
      label: AGENCY_FEE_LABEL,
      amount: agency,
      hint:
        cfg.agency.type === "percent"
          ? `${pct(cfg.agency.value)}% от ${r2(b + management)}`
          : "фиксированная сумма",
    });
  }
  return { base: b, management, agency, total: r2(management + agency), lines };
}

/** Быстрый расчёт из «сырых» полей документа. */
export function documentFees(base: number, source: FeeSource): FeesResult {
  return computeFees(base, feeConfig(source));
}

export type FeeIssue = { level: "error" | "warn"; message: string; code: string };

/** Проверки конфигурации начислений для панели проверок документа. */
export function checkFeesConfig(source: FeeSource, base = 0): FeeIssue[] {
  const cfg = feeConfig(source);
  const out: FeeIssue[] = [];
  const each: Array<[FeeType, number, string, string]> = [
    [cfg.management.type, cfg.management.value, MANAGEMENT_LABEL, "management"],
    [cfg.agency.type, cfg.agency.value, AGENCY_FEE_LABEL, "agency_fee"],
  ];
  for (const [type, value, label, code] of each) {
    if (type !== "none" && value <= 0) {
      out.push({ level: "error", code: `${code}_value_missing`, message: `${label}: включён, но значение не задано` });
    }
    if (type === "percent" && value > 100) {
      out.push({ level: "error", code: `${code}_percent_range`, message: `${label}: процент больше 100%` });
    }
    if (type === "percent" && value > 50 && value <= 100) {
      out.push({ level: "warn", code: `${code}_percent_high`, message: `${label}: необычно высокий процент — ${pct(value)}%` });
    }
    if (type === "none" && value > 0) {
      out.push({ level: "warn", code: `${code}_unused`, message: `${label}: значение указано, но начисление выключено — в документ не попадёт` });
    }
    if (type === "amount" && base > 0 && value > base) {
      out.push({ level: "warn", code: `${code}_amount_big`, message: `${label}: сумма больше стоимости позиций — проверьте значение` });
    }
  }
  return out;
}
