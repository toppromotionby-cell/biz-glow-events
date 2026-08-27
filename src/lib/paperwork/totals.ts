// Расчёт сумм блока «Позиции с суммами» для превью, PDF и DOCX.
import { amountToWords } from "@/lib/quotes-model";
import type { PwBlock, PwLine } from "@/lib/paperwork/model";

export type PwTotals = {
  net: number;
  vat: number;
  gross: number;
  words: string;
  currency: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotal(line: PwLine): number {
  return round2((Number(line.qty) || 0) * (Number(line.price) || 0));
}

export function blockTotals(block: PwBlock): PwTotals {
  const net = round2(block.lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const vat = round2((net * (Number(block.vatPct) || 0)) / 100);
  const gross = round2(net + vat);
  return {
    net,
    vat,
    gross,
    words: amountToWords(gross),
    currency: block.currency || "BYN",
  };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
