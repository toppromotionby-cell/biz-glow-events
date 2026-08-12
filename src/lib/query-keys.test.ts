import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder, invalidateQuote, invalidatePromoQuote } from "./query-keys";

function collect(qc: QueryClient) {
  const invalidated: string[] = [];
  const original = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = ((filters?: { queryKey?: readonly unknown[] }) => {
    invalidated.push(JSON.stringify(filters?.queryKey ?? []));
    return original(filters as never);
  }) as typeof qc.invalidateQueries;
  return invalidated;
}

describe("adminKeys", () => {
  it("все статические ключи уникальны", () => {
    const statics = Object.values(adminKeys)
      .filter((v): v is readonly string[] => Array.isArray(v))
      .map((v) => JSON.stringify(v));
    expect(new Set(statics).size).toBe(statics.length);
  });

  it("детальные ключи вложены в списочные префиксы", () => {
    expect(adminKeys.order("a")[0]).toBe("order");
    expect(adminKeys.orders({ q: "x" })[0]).toBe(adminKeys.ordersAll[0]);
    expect(adminKeys.presentation("p")[0]).toBe("presentation");
  });
});

describe("invalidateOrder", () => {
  it("обновляет карточку, позиции, историю, вложения, список и счётчик внимания", () => {
    const qc = new QueryClient();
    const seen = collect(qc);
    invalidateOrder(qc, "o1");
    expect(seen).toEqual([
      JSON.stringify(adminKeys.order("o1")),
      JSON.stringify(adminKeys.orderItems("o1")),
      JSON.stringify(adminKeys.orderTimeline("o1")),
      JSON.stringify(adminKeys.orderAttachments("o1")),
      JSON.stringify(adminKeys.ordersAll),
      JSON.stringify(adminKeys.attention),
    ]);
  });
});

describe("invalidateQuote / invalidatePromoQuote", () => {
  it("КП обновляет и сам документ, и общий список документов", () => {
    const qc = new QueryClient();
    const seen = collect(qc);
    invalidateQuote(qc, "q1");
    expect(seen).toContain(JSON.stringify(adminKeys.quote("q1")));
    expect(seen).toContain(JSON.stringify(adminKeys.documents));
  });

  it("промо-КП обновляет версии и список документов", () => {
    const qc = new QueryClient();
    const seen = collect(qc);
    invalidatePromoQuote(qc, "p1");
    expect(seen).toContain(JSON.stringify(adminKeys.promoQuoteVersions("p1")));
    expect(seen).toContain(JSON.stringify(adminKeys.documents));
  });
});
