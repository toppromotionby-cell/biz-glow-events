// Расчёты по договору подряда с физлицом: подоходный налог 13 %,
// взносы в ФСЗН 1 % и сумма к выплате «на руки».
import { amountToWords } from "@/lib/quotes-model";

export const INCOME_TAX_PCT = 13;
export const FSZN_PCT = 1;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type WorkActAmounts = {
  price: number;
  tax: number;
  fszn: number;
  payout: number;
  priceWords: string;
  taxWords: string;
  fsznWords: string;
  payoutWords: string;
};

/** Все суммы по цене работы: налог, взносы, сумма к выплате и прописи. */
export function workActAmounts(priceRaw: number): WorkActAmounts {
  const price = round2(Math.max(0, Number(priceRaw) || 0));
  const tax = round2((price * INCOME_TAX_PCT) / 100);
  const fszn = round2((price * FSZN_PCT) / 100);
  const payout = round2(price - tax - fszn);
  return {
    price,
    tax,
    fszn,
    payout,
    priceWords: amountToWords(price),
    taxWords: amountToWords(tax),
    fsznWords: amountToWords(fszn),
    payoutWords: amountToWords(payout),
  };
}

/** «930,23» — формат сумм в тексте договора. */
export function money(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
