import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  checkPassword,
  generatePassword,
  passwordError,
} from "./password-policy";
import { safeRedirect } from "./auth-redirect";

describe("password policy", () => {
  it("отклоняет короткие пароли", () => {
    expect(checkPassword("Ab1!c").ok).toBe(false);
    expect("Ab1!cdefgh".length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
  });

  it("требует все классы символов", () => {
    expect(checkPassword("abcdefghijk").ok).toBe(false); // нет заглавных/цифр/спецсимвола
    expect(checkPassword("ABCDEFGHIJK1").ok).toBe(false); // нет строчных/спецсимвола
    expect(checkPassword("Abcdefghij1").ok).toBe(false); // нет спецсимвола
    expect(checkPassword("Abcdefghij!").ok).toBe(false); // нет цифры
  });

  it("принимает сложный пароль", () => {
    expect(checkPassword("Sv3t-Zvuk!2026").ok).toBe(true);
    expect(passwordError("Sv3t-Zvuk!2026")).toBeNull();
  });

  it("режет популярные пароли и совпадение с почтой", () => {
    expect(checkPassword("Password123!").ok).toBe(false);
    expect(checkPassword("Dmitry!2026x", { email: "dmitry@event-hub.by" }).ok).toBe(false);
  });

  it("не пропускает пробелы по краям", () => {
    expect(checkPassword(" Sv3t-Zvuk!2026 ").ok).toBe(false);
  });

  it("генератор всегда выдаёт валидный пароль", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword(16);
      expect(checkPassword(pwd).ok).toBe(true);
    }
  });
});

describe("safeRedirect", () => {
  it("пропускает внутренние пути", () => {
    expect(safeRedirect("/dj/pool")).toBe("/dj/pool");
  });
  it("блокирует внешние и опасные адреса", () => {
    expect(safeRedirect("//evil.com")).toBeUndefined();
    expect(safeRedirect("https://evil.com")).toBeUndefined();
    expect(safeRedirect("javascript:alert(1)")).toBeUndefined();
    expect(safeRedirect(42)).toBeUndefined();
  });
});
