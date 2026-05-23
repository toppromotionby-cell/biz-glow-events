// Простая утилита для подсветки кнопок и навигации.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBYN(value: number): string {
  return new Intl.NumberFormat("ru-BY", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Извлекает минимальную/базовую цену из произвольного pricing-объекта.
 *  Поддерживает ключи: from, priceFrom, min, base. Возвращает null, если число не найдено. */
export function priceFrom(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== "object") return null;
  const p = pricing as Record<string, unknown>;
  const v = p.from ?? p.priceFrom ?? p.min ?? p.base;
  return typeof v === "number" ? v : null;
}

// Транслитерация для slug'ов
const ruMap: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",
  о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",
  э:"e",ю:"yu",я:"ya"," ":"-"
};
export function slugify(input: string): string {
  return input.toLowerCase().split("").map(c => ruMap[c] ?? c).join("")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
