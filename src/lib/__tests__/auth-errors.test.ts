import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";

describe("authErrorMessage", () => {
  it("переводит неверные учётные данные", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/Неверная почта или пароль/);
    expect(authErrorMessage({ message: "Invalid login credentials" })).toMatch(/Неверная почта или пароль/);
  });

  it("сообщает о неподтверждённой почте и лимите попыток", () => {
    expect(authErrorMessage({ message: "Email not confirmed" })).toMatch(/подтверждена/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Слишком много попыток/);
  });

  it("никогда не возвращает английский технический текст", () => {
    const msg = authErrorMessage({ message: "AuthApiError: something weird" });
    expect(msg).not.toContain("AuthApiError");
    expect(msg.length).toBeGreaterThan(10);
  });
});
