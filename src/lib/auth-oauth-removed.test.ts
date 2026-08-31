// Регрессия: на сайте не должно остаться входа через Google/Apple.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const SKIP_DIRS = new Set(["node_modules", "integrations"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(full);
  }
  return acc;
}

const files = walk(SRC);

describe("вход через соцсети удалён", () => {
  it("нет вызовов signInWithOAuth в приложении", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("signInWithOAuth"));
    expect(hits).toEqual([]);
  });

  it("нет компонентов GoogleButton/AppleButton и oauth-redirect", () => {
    const hits = files.filter((f) => /GoogleButton|AppleButton|oauth-redirect|~oauth\/initiate/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("нет тумблеров auth.google / auth.apple в реестре секций", () => {
    const registry = readFileSync(join(SRC, "lib/site-sections.tsx"), "utf8");
    expect(registry).not.toContain("auth.google");
    expect(registry).not.toContain("auth.apple");
  });
});

describe("страницы авторизации связаны между собой", () => {
  const read = (p: string) => readFileSync(join(SRC, p), "utf8");

  it("вход ведёт на регистрацию и восстановление", () => {
    const login = read("routes/login.tsx");
    expect(login).toContain('to="/register"');
    expect(login).toContain('to="/forgot-password"');
  });

  it("регистрация ведёт на вход и использует единую политику паролей", () => {
    const reg = read("routes/register.tsx");
    expect(reg).toContain('to="/login"');
    expect(reg).toContain("password-policy");
    expect(reg).toContain("PasswordField");
  });

  it("сброс пароля проверяет ссылку и политику", () => {
    const reset = read("routes/reset-password.tsx");
    expect(reset).toContain("passwordError");
    expect(reset).toContain("getSession");
  });

  it("смена пароля в кабинете использует ту же политику", () => {
    expect(read("components/ChangePasswordCard.tsx")).toContain("passwordError");
  });
});
