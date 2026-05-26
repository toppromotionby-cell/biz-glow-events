// Helpers for quantity-based pricing (hours, pieces, people, days).

export type QuantityKind = "hour" | "piece" | "person" | "day" | null;

export function detectQuantityKind(unit?: string | null): QuantityKind {
  if (!unit) return null;
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (/^час/.test(u) || u === "ч" || u === "hour" || u === "h") return "hour";
  if (u === "шт" || u === "штука" || u === "штуки" || u === "штук" || u === "pcs" || u === "piece") return "piece";
  if (/^чел/.test(u) || u === "person" || u === "people" || u === "гость" || u === "гостя" || u === "гостей") return "person";
  if (/^(день|дн|сутк)/.test(u) || u === "day") return "day";
  return null;
}

export function isQuantityUnit(unit?: string | null): boolean {
  return detectQuantityKind(unit) !== null;
}

const PLURAL: Record<NonNullable<QuantityKind>, [string, string, string]> = {
  hour: ["час", "часа", "часов"],
  piece: ["шт.", "шт.", "шт."],
  person: ["человек", "человека", "человек"],
  day: ["день", "дня", "дней"],
};

export function pluralizeUnit(kind: QuantityKind, n: number): string {
  if (!kind) return "";
  const forms = PLURAL[kind];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function maxQtyFor(kind: QuantityKind): number {
  if (kind === "hour") return 24;
  if (kind === "day") return 30;
  if (kind === "person") return 500;
  return 100;
}

export function formatBYNTotal(n: number): string {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);
}
