import { createServerFn } from "@tanstack/react-start";
import type { CalcItem } from "@/lib/calculator.server";

export type { CalcItem };

export const getCalculatorCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<CalcItem[]> => {
  const { loadCalculatorCatalog } = await import("@/lib/calculator.server");
  return loadCalculatorCatalog();
});
