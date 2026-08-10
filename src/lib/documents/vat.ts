// Единый расчёт НДС для всех документов (КП, КП промо, счёт, акт, договор).
// Browser-safe: используется и в админке, и в серверных рендерерах.

export const VAT_MODES = ["none", "add", "included"] as const;
export type VatMode = (typeof VAT_MODES)[number];

export const VAT_MODE_LABELS: Record<VatMode, string> = {
  none: "Без НДС",
  add: "Начисляется сверху",
  included: "В том числе",
};

export const DEFAULT_VAT_RATE = 20;

export type VatConfig = {
  /** Режим расчёта. */
  mode: VatMode;
  /** Ставка в процентах. */
  rate: number;
  /** Показывать НДС отдельной строкой-позицией в таблице. */
  asLine: boolean;
};

export type VatResult = {
  enabled: boolean;
  mode: VatMode;
  rate: number;
  asLine: boolean;
  /** Сумма без НДС. */
  net: number;
  /** Сумма налога. */
  vat: number;
  /** Итог с НДС. */
  gross: number;
};

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function normalizeVatMode(value: unknown): VatMode {
  const v = String(value ?? "none");
  return (VAT_MODES as readonly string[]).includes(v) ? (v as VatMode) : "none";
}

export function vatConfig(source: {
  vat_mode?: unknown;
  vat_rate?: unknown;
  vat_as_line?: unknown;
}): VatConfig {
  const mode = normalizeVatMode(source.vat_mode);
  const raw = Number(source.vat_rate);
  const rate = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : DEFAULT_VAT_RATE;
  return { mode, rate, asLine: Boolean(source.vat_as_line) };
}

/**
 * Расчёт НДС от базы.
 * - `add`: база — сумма без НДС, налог начисляется сверху.
 * - `included`: база — итог с НДС, налог выделяется расчётным методом.
 */
export function computeVat(base: number, cfg: VatConfig): VatResult {
  const amount = r2(base);
  const rate = cfg.rate;
  if (cfg.mode === "none" || rate <= 0) {
    return { enabled: false, mode: "none", rate, asLine: cfg.asLine, net: amount, vat: 0, gross: amount };
  }
  if (cfg.mode === "included") {
    const vat = r2((amount * rate) / (100 + rate));
    return { enabled: true, mode: "included", rate, asLine: cfg.asLine, net: r2(amount - vat), vat, gross: amount };
  }
  const vat = r2((amount * rate) / 100);
  return { enabled: true, mode: "add", rate, asLine: cfg.asLine, net: amount, vat, gross: r2(amount + vat) };
}

/** Ставка в человеческом виде: 20, 20.5. */
export function vatRateLabel(rate: number): string {
  return String(Math.round(rate * 100) / 100).replace(".", ",");
}

export function vatLabels(v: VatResult) {
  return {
    net: v.enabled ? "Сумма без НДС" : "Сумма",
    vat: `НДС ${vatRateLabel(v.rate)}%`,
    gross: v.enabled ? "Итого с НДС" : "Итого",
  };
}

/** Строки для блока «Итого». Возвращает только те, что нужно печатать. */
export function vatSummaryRows(v: VatResult): Array<{ label: string; value: number; emphasis?: boolean }> {
  const l = vatLabels(v);
  if (!v.enabled) return [{ label: l.gross, value: v.gross, emphasis: true }];
  return [
    { label: l.net, value: v.net },
    { label: l.vat, value: v.vat },
    { label: l.gross, value: v.gross, emphasis: true },
  ];
}

/** Нужно ли добавлять НДС отдельной строкой в таблицу позиций. */
export function vatTableLine(v: VatResult): { title: string; amount: number } | null {
  if (!v.enabled || !v.asLine) return null;
  return { title: v.mode === "included" ? `В том числе НДС ${vatRateLabel(v.rate)}%` : `НДС ${vatRateLabel(v.rate)}%`, amount: v.vat };
}

/** Текст для документов: «в том числе НДС 20% — 240,00 BYN» либо примечание «без НДС». */
export function vatNoteText(v: VatResult, money: (n: number) => string, fallback = ""): string {
  if (!v.enabled) return fallback;
  return `В том числе НДС ${vatRateLabel(v.rate)}% — ${money(v.vat)}`;
}

/** Проблема конфигурации НДС для панели проверок документа. */
export type VatIssue = { level: "error" | "warn"; message: string; code: string };

/**
 * Валидация настроек НДС документа: несогласованные режим/ставка приводят
 * к некорректным суммам в превью и в PDF.
 */
export function checkVatConfig(source: {
  vat_mode?: unknown;
  vat_rate?: unknown;
  vat_as_line?: unknown;
}): VatIssue[] {
  const out: VatIssue[] = [];
  const mode = normalizeVatMode(source.vat_mode);
  const raw = Number(source.vat_rate);
  const hasRate = Number.isFinite(raw) && raw > 0;

  if (mode !== "none" && !hasRate) {
    out.push({ level: "error", code: "vat_rate_missing", message: "Включён НДС, но ставка не задана — в документ уйдёт ставка по умолчанию 20%" });
  }
  if (mode !== "none" && hasRate && raw > 30) {
    out.push({ level: "warn", code: "vat_rate_odd", message: `Необычная ставка НДС — ${vatRateLabel(raw)}%. Проверьте значение` });
  }
  if (mode === "none" && hasRate && raw !== DEFAULT_VAT_RATE) {
    out.push({ level: "warn", code: "vat_rate_unused", message: `Ставка НДС ${vatRateLabel(raw)}% указана, но режим «Без НДС» — налог не будет посчитан` });
  }
  if (mode === "none" && Boolean(source.vat_as_line)) {
    out.push({ level: "warn", code: "vat_line_unused", message: "Включена строка НДС в таблице, но режим «Без НДС» — строка не появится" });
  }
  return out;
}
