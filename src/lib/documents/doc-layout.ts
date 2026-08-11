// Единый «макет» КП: один расчёт колонок, строк, шапки и итогов для
// HTML-превью, PDF, Excel, Google Таблиц и Google Документов.
// Модуль чистый и браузеро-безопасный — никаких сетевых вызовов.
import { BRAND_ACCENT } from "@/lib/documents/brand";
import { vatRateLabel } from "@/lib/documents/vat";
import {
  computePromoTotals,
  groupBySection,
  hasSecondUnit,
  isCounted,
  lineQty,
  lineTotal,
  promoNumberDisplay,
  rateUnitLabel,
  soleRateUnit,
  type PromoItem,
  type PromoQuote,
  type PromoTotals,
} from "@/lib/promo-quote-model";

export type DocColumnKey =
  | "title"
  | "unit"
  | "qty"
  | "rate_unit"
  | "multiplier"
  | "total_qty"
  | "price"
  | "amount"
  | "note";

export type DocAlign = "left" | "center" | "right";

export type DocColumn = {
  key: DocColumnKey;
  label: string;
  /** Доля ширины таблицы (сумма по всем колонкам = 1). */
  width: number;
  align: DocAlign;
  money: boolean;
};

export type DocRowKind = "section" | "item" | "subtotal" | "extra";

export type DocRow = {
  kind: DocRowKind;
  /** Отображаемые значения по ключу колонки. */
  cells: Partial<Record<DocColumnKey, string>>;
  /** Числовые значения (для формул в таблицах). */
  numbers: Partial<Record<DocColumnKey, number>>;
  item?: PromoItem;
  section?: string;
  /** Позиция участвует в итоге. */
  counted: boolean;
  /** Позиция участвует в базе комиссии. */
  commissionable: boolean;
};

export type DocTotalLine = { label: string; value: number; grand?: boolean; sign?: "minus" };

export type DocLayout = {
  columns: DocColumn[];
  rows: DocRow[];
  meta: string[];
  docTitle: string;
  totals: DocTotalLine[];
  computed: PromoTotals;
  accent: string;
  dual: boolean;
};

/** Базовые доли ширины по ключу (нормализуются по фактическому набору колонок). */
const BASE_WIDTH: Record<DocColumnKey, number> = {
  title: 26,
  unit: 9,
  qty: 6,
  rate_unit: 8,
  multiplier: 6,
  total_qty: 6,
  price: 10,
  amount: 10,
  note: 27,
};

const nf = (n: number) =>
  new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

const nq = (n: number) =>
  new Intl.NumberFormat("ru-BY", { maximumFractionDigits: 3 }).format(Number.isFinite(n) ? n : 0);

export function buildDocLayout(quote: PromoQuote, items: PromoItem[]): DocLayout {
  const computed = computePromoTotals(quote, items);
  const dual = hasSecondUnit(items);
  const rateUnit = soleRateUnit(items);

  const keys: DocColumnKey[] = ["title", "unit"];
  if (quote.show_qty) keys.push("qty");
  if (dual) keys.push("rate_unit", "multiplier");
  if (quote.show_total_qty) keys.push("total_qty");
  keys.push("price", "amount");
  if (quote.show_notes) keys.push("note");

  const labels: Record<DocColumnKey, string> = {
    title: "Наименование",
    unit: "Ед. изм.",
    qty: "Кол-во",
    rate_unit: "Ед. 2",
    multiplier: "Кол-во 2",
    total_qty: "Всего",
    price: rateUnit ? `Цена за ${rateUnit}` : "Цена за ед.",
    amount: `Всего${computed.vatMode === "add" ? ", без НДС" : computed.vatMode === "included" ? ", с НДС" : ""}`,
    note: "Примечания",
  };
  const align: Record<DocColumnKey, DocAlign> = {
    title: "left",
    unit: "center",
    qty: "center",
    rate_unit: "center",
    multiplier: "center",
    total_qty: "center",
    price: "right",
    amount: "right",
    note: "left",
  };

  const totalW = keys.reduce((s, k) => s + BASE_WIDTH[k], 0);
  const columns: DocColumn[] = keys.map((key) => ({
    key,
    label: labels[key],
    width: BASE_WIDTH[key] / totalW,
    align: align[key],
    money: key === "price" || key === "amount",
  }));

  const rows: DocRow[] = [];
  const row = (kind: DocRowKind, extra: Partial<DocRow> = {}): DocRow => ({
    kind,
    cells: {},
    numbers: {},
    counted: false,
    commissionable: false,
    ...extra,
  });

  for (const sec of groupBySection(items)) {
    if (sec.name) rows.push(row("section", { section: sec.name, cells: { title: sec.name } }));
    for (const it of sec.items) {
      const ru = rateUnitLabel(it);
      const amount = lineTotal(it);
      rows.push(
        row("item", {
          item: it,
          section: sec.name,
          counted: isCounted(it),
          commissionable: isCounted(it) && !it.exclude_from_commission,
          cells: {
            title: it.title.trim() || "Новая позиция",
            unit: it.unit,
            qty: nq(it.qty),
            rate_unit: ru || "—",
            multiplier: ru ? nq(it.multiplier) : "—",
            total_qty: nq(lineQty(it)),
            price: it.price ? nf(it.price) : "",
            amount: amount ? nf(amount) : "",
            note: it.note,
          },
          numbers: {
            qty: it.qty,
            multiplier: ru ? it.multiplier : 1,
            total_qty: lineQty(it),
            price: it.price,
            amount,
          },
        }),
      );
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      const sum = sec.items.reduce((s, it) => s + lineTotal(it), 0);
      rows.push(
        row("subtotal", {
          section: sec.name,
          cells: { title: `Итого по разделу «${sec.name}»`, amount: nf(sum) },
          numbers: { amount: sum },
        }),
      );
    }
  }

  if (quote.management_enabled) {
    rows.push(
      row("extra", {
        cells: { title: quote.management_label, unit: "услуга", amount: nf(computed.management) },
        numbers: { amount: computed.management },
      }),
    );
  }
  if (quote.commission_enabled) {
    rows.push(
      row("extra", {
        cells: {
          title: quote.commission_label,
          amount: nf(computed.commission),
          note: `${nf(quote.commission_rate).replace(",00", "")} %`,
        },
        numbers: { amount: computed.commission },
      }),
    );
  }
  if (computed.vatEnabled && quote.vat_as_line) {
    rows.push(
      row("extra", {
        cells: {
          title:
            computed.vatMode === "included"
              ? `В том числе НДС ${vatRateLabel(computed.vatRate)}%`
              : `НДС ${vatRateLabel(computed.vatRate)}%`,
          amount: nf(computed.vat),
        },
        numbers: { amount: computed.vat },
      }),
    );
  }

  const validUntil = quote.valid_until
    ? new Date(`${quote.valid_until}T00:00:00`).toLocaleDateString("ru-RU")
    : "";
  const contact = [quote.contact_name, quote.contact_role].filter(Boolean).join(", ");
  const meta = [
    quote.project ? `Проект: ${quote.project}` : "",
    quote.client_name ? `Клиент: ${quote.client_name}` : "",
    quote.period ? `Период: ${quote.period}` : "",
    quote.venue ? `Место проведения: ${quote.venue}` : "",
    validUntil ? `Предложение действительно до: ${validUntil}` : "",
    contact || quote.contact_phone || quote.contact_email
      ? `Контактное лицо: ${contact}${quote.contact_phone ? `; ${quote.contact_phone}` : ""}${
          quote.contact_email ? `; ${quote.contact_email}` : ""
        }`
      : "",
  ].filter(Boolean);

  const totals: DocTotalLine[] = [];
  if (computed.discount > 0)
    totals.push({
      label: `Скидка${quote.discount_type === "percent" ? ` ${nf(quote.discount_value).replace(",00", "")}%` : ""}`,
      value: computed.discount,
      sign: "minus",
    });
  totals.push({
    label: computed.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего",
    value: computed.net,
  });
  if (computed.vatEnabled)
    totals.push({ label: `НДС ${vatRateLabel(computed.vatRate)}%`, value: computed.vat });
  totals.push({
    label: `Итого${computed.vatEnabled ? ", с НДС" : ""}`,
    value: computed.totalWithVat,
    grand: true,
  });

  return {
    columns,
    rows,
    meta,
    docTitle: `КП № ${promoNumberDisplay(quote)}`,
    totals,
    computed,
    accent: /^#[0-9a-fA-F]{3,8}$/.test(quote.accent_color) ? quote.accent_color : BRAND_ACCENT,
    dual,
  };
}

export const docMoney = nf;
export const docQty = nq;
