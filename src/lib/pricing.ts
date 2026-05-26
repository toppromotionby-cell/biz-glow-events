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

// ---------- Hour-based tier parsing ----------

export type HourTier = { hours: number; price: number; label?: string };
export type HourPricing = {
  points: HourTier[];
  extraPerHour: number | null;
  popularHours: number | null;
  minHours: number;
  maxHours: number;
};

function extractHours(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/(\d+(?:[.,]\d+)?)\s*ч/i);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isExtraHourRow(label?: string, unit?: string): boolean {
  const l = (label ?? "").toLowerCase();
  if (!/час/.test(l) && !/час/i.test(unit ?? "")) return false;
  return /последующ|кажд|доп|extra|additional/.test(l);
}

export function parseHourTiers(
  tiers: Array<{ label?: string; price: number | ""; unit?: string }>,
): HourPricing | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const points: HourTier[] = [];
  let extraPerHour: number | null = null;

  for (const t of tiers) {
    const price = Number(t.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const isHourUnit = detectQuantityKind(t.unit) === "hour" || /час/i.test(t.label ?? "");
    if (!isHourUnit) continue;
    if (isExtraHourRow(t.label, t.unit)) {
      if (extraPerHour === null || price < extraPerHour) extraPerHour = price;
      continue;
    }
    const hours = extractHours(t.label);
    if (hours !== null) {
      points.push({ hours, price, label: t.label });
    }
  }

  if (points.length === 0 && extraPerHour === null) return null;

  points.sort((a, b) => a.hours - b.hours);

  const minHours = points[0]?.hours ?? 1;
  const baseMax = points[points.length - 1]?.hours ?? minHours;
  const maxHours = extraPerHour !== null ? Math.max(12, baseMax + 1) : baseMax;
  const popularHours = points.length >= 3 ? points[Math.floor(points.length / 2)].hours : null;

  return { points, extraPerHour, popularHours, minHours, maxHours };
}

export function priceForHours(pricing: HourPricing, hours: number): number {
  const h = Math.max(pricing.minHours, Math.min(pricing.maxHours, Math.round(hours)));
  const exact = pricing.points.find((p) => p.hours === h);
  if (exact) return exact.price;
  if (pricing.points.length === 0) {
    return pricing.extraPerHour ? pricing.extraPerHour * h : 0;
  }
  const last = pricing.points[pricing.points.length - 1];
  if (h > last.hours && pricing.extraPerHour !== null) {
    return last.price + (h - last.hours) * pricing.extraPerHour;
  }
  let chosen = pricing.points[0];
  for (const p of pricing.points) {
    if (p.hours <= h) chosen = p;
    else break;
  }
  return chosen.price;
}

