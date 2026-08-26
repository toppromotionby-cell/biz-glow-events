// Единый источник строк для внутреннего расчёта (экономика/себестоимость).
// Используется и в редакторах, и в серверных роутах — чтобы превью,
// XLSX и внутренний PDF всегда показывали одинаковые цифры.
import { normalizeCostMode, type EconInput } from "@/lib/documents/economics";
import type { QuoteItem } from "@/lib/quotes-model";
import { isCounted, lineQty, qtyUnitLabel, type PromoItem } from "@/lib/promo-quote-model";

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function quoteEconRows(items: QuoteItem[]): EconInput[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => ({
      id: it.id,
      section: it.section,
      title: it.title,
      qty: n(it.qty),
      qtyLabel: `${n(it.qty)} ${it.unit ?? ""}`.trim(),
      price: n(it.price),
      unitCost: n(it.cost),
      costMode: normalizeCostMode(it.cost_mode),
      costInput: n(it.cost_input),
    }));
}

export function promoEconRows(items: PromoItem[]): EconInput[] {
  return items.map((it) => ({
    id: it.id,
    section: it.section,
    title: it.title,
    qty: lineQty(it),
    qtyLabel: `${lineQty(it)} ${qtyUnitLabel(it)}`.trim(),
    price: n(it.price),
    unitCost: n(it.cost),
    costMode: normalizeCostMode(it.cost_mode),
    costInput: n(it.cost_input),
    excluded: !isCounted(it),
  }));
}
