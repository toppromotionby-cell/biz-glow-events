import { describe, expect, it } from "vitest";
import { checkFeesConfig, computeFees, documentFees, feeConfig } from "@/lib/documents/fees";
import { computeTotals } from "@/lib/quotes-model";

const q = (over: Record<string, unknown> = {}) =>
  ({
    discount_type: "none",
    discount_value: 0,
    prepayment_type: "none",
    prepayment_value: 0,
    delivery_amount: 0,
    vat_mode: "none",
    vat_rate: 20,
    vat_as_line: false,
    management_type: "none",
    management_value: 0,
    agency_fee_type: "none",
    agency_fee_value: 0,
    ...over,
  }) as never;

const items = [{ qty: 2, price: 500, cost: 200 }];

describe("fees", () => {
  it("выключенные начисления не меняют суммы", () => {
    const t = computeTotals(q(), items);
    expect(t.total).toBe(1000);
    expect(t.management).toBe(0);
    expect(t.agencyFee).toBe(0);
    expect(t.feeLines).toHaveLength(0);
  });

  it("менеджмент процентом считается от суммы после скидки и доставки", () => {
    const r = documentFees(1000, { management_type: "percent", management_value: 10 });
    expect(r.management).toBe(100);
    expect(r.total).toBe(100);
  });

  it("комиссия считается после менеджмента", () => {
    const r = computeFees(1000, feeConfig({
      management_type: "percent",
      management_value: 10,
      agency_fee_type: "percent",
      agency_fee_value: 10,
    }));
    expect(r.management).toBe(100);
    expect(r.agency).toBe(110);
    expect(r.total).toBe(210);
  });

  it("начисления входят в базу НДС и в итог", () => {
    const t = computeTotals(
      q({ vat_mode: "add", management_type: "amount", management_value: 200, agency_fee_type: "percent", agency_fee_value: 10 }),
      items,
    );
    expect(t.management).toBe(200);
    expect(t.agencyFee).toBe(120);
    expect(t.net).toBe(1320);
    expect(t.vat).toBe(264);
    expect(t.total).toBe(1584);
    expect(t.feeLines.map((f) => f.key)).toEqual(["management", "agency"]);
  });

  it("предоплата процентом считается от итога с начислениями", () => {
    const t = computeTotals(q({ prepayment_type: "percent", prepayment_value: 50, management_type: "amount", management_value: 200 }), items);
    expect(t.total).toBe(1200);
    expect(t.prepayment).toBe(600);
    expect(t.balance).toBe(600);
  });

  it("проверки ловят пустое значение и превышение процента", () => {
    const codes = checkFeesConfig({ management_type: "percent", management_value: 0, agency_fee_type: "percent", agency_fee_value: 120 }).map((i) => i.code);
    expect(codes).toContain("management_value_missing");
    expect(codes).toContain("agency_fee_percent_range");
  });

  it("значение без включённого типа даёт предупреждение", () => {
    const codes = checkFeesConfig({ management_type: "none", management_value: 500 }).map((i) => i.code);
    expect(codes).toContain("management_unused");
  });
});
