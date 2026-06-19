// Единые форматтеры для денег/дат/времени по локали ru-BY.
// Используем вместо локальных дублей в роутах админки и в карточках профиля.

type Numeric = number | string | null | undefined;
type DateInput = string | number | Date | null | undefined;

/** "1 234 BYN" — без копеек. */
export function fmtMoney(value: Numeric): string {
  return `${Number(value ?? 0).toLocaleString("ru-BY")} BYN`;
}

/** "19.06.2026" или "—" если пусто. */
export function fmtDate(value: DateInput): string {
  return value ? new Date(value).toLocaleDateString("ru-BY") : "—";
}

/** "19.06.2026, 14:32:01" или "—" если пусто. */
export function fmtDateTime(value: DateInput): string {
  return value ? new Date(value).toLocaleString("ru-BY") : "—";
}

/** Короткая дата+время без секунд: "19.06.26, 14:32". */
export function fmtDateTimeShort(value: DateInput): string {
  return value
    ? new Date(value).toLocaleString("ru-BY", { dateStyle: "short", timeStyle: "short" })
    : "—";
}

/** Валютный формат через Intl: "1 234 BYN". */
const currencyBYN = new Intl.NumberFormat("ru-BY", {
  style: "currency",
  currency: "BYN",
  maximumFractionDigits: 0,
});
export function fmtCurrency(value: Numeric): string {
  return currencyBYN.format(Number(value ?? 0));
}
