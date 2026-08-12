import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodFieldErrors, mapServerError } from "./form-errors";
import { promoCodeSchema } from "./schemas";

describe("zodFieldErrors", () => {
  it("собирает плоскую карту путь → сообщение", () => {
    const schema = z.object({ title: z.string().min(1, "Обязательно"), n: z.number().min(1, "Мало") });
    const r = schema.safeParse({ title: "", n: 0 });
    expect(r.success).toBe(false);
    const errors = zodFieldErrors(r.error!);
    expect(errors["title"]).toBe("Обязательно");
    expect(errors["n"]).toBe("Мало");
  });
});

describe("promoCodeSchema", () => {
  const base = {
    code: "SALE-10",
    description: "",
    discount_type: "percent" as const,
    discount_value: 10,
    min_order_total: 0,
    valid_from: null,
    valid_to: null,
    max_uses: null,
    active: true,
  };

  it("принимает корректный промокод", () => {
    expect(promoCodeSchema.safeParse(base).success).toBe(true);
  });

  it("отклоняет строчные буквы в коде", () => {
    const r = promoCodeSchema.safeParse({ ...base, code: "sale10" });
    expect(r.success).toBe(false);
  });

  it("не даёт процент больше 100", () => {
    const r = promoCodeSchema.safeParse({ ...base, discount_value: 120 });
    expect(r.success).toBe(false);
    expect(zodFieldErrors(r.error!)["discount_value"]).toMatch(/100/);
  });

  it("ловит перевёрнутый период действия", () => {
    const r = promoCodeSchema.safeParse({ ...base, valid_from: "2026-05-02", valid_to: "2026-05-01" });
    expect(r.success).toBe(false);
    expect(zodFieldErrors(r.error!)["valid_to"]).toBeTruthy();
  });
});

describe("mapServerError", () => {
  it("вешает дубль на поле из Key (...)", () => {
    const m = mapServerError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "cases_slug_key"',
      details: "Key (slug)=(my-case) already exists.",
    });
    expect(m.field).toBe("slug");
    expect(m.message).toMatch(/уже занято/);
  });

  it("определяет поле по имени ограничения без details", () => {
    const m = mapServerError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "promo_codes_code_key"',
    });
    expect(m.field).toBe("code");
  });

  it("объясняет отказ прав", () => {
    const m = mapServerError({ code: "42501", message: "permission denied" });
    expect(m.field).toBeNull();
    expect(m.message).toMatch(/прав/);
  });

  it("неизвестную ошибку отдаёт как есть", () => {
    const m = mapServerError(new Error("Сеть недоступна"));
    expect(m).toEqual({ field: null, message: "Сеть недоступна" });
  });
});
