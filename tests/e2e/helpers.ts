// Общие помощники e2e: вход в админку, сбор ошибок консоли/сети, список маршрутов.
import { readdirSync } from "node:fs";
import type { Page, BrowserContext } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
export const HAS_ADMIN_CREDS = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
export const ALLOW_WRITES = process.env.E2E_WRITE === "1";

/** Шум, который не считаем ошибкой: сторонние скрипты, HMR, аналитика. */
const IGNORED = [
  /favicon/i,
  /ResizeObserver loop/i,
  /\[vite\]/i,
  /Download the React DevTools/i,
  /googletagmanager|mc\.yandex|google-analytics/i,
  /Failed to load resource: net::ERR_/i,
];

export type PageProblems = {
  console: string[];
  pageErrors: string[];
  badResponses: string[];
};

/** Подписывается на консоль, необработанные исключения и ответы >= 400. */
export function watchProblems(page: Page): PageProblems {
  const problems: PageProblems = { console: [], pageErrors: [], badResponses: [] };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    problems.console.push(text);
  });

  page.on("pageerror", (err) => {
    const text = err.message;
    if (IGNORED.some((re) => re.test(text))) return;
    problems.pageErrors.push(text);
  });

  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (IGNORED.some((re) => re.test(url))) return;
    // 401/403 на анонимных запросах публичных страниц — ожидаемое поведение RLS.
    if (status === 401 || status === 403) return;
    problems.badResponses.push(`${status} ${url}`);
  });

  return problems;
}

export function formatProblems(path: string, p: PageProblems): string {
  return [
    `Проблемы на ${path}:`,
    p.pageErrors.length ? `  runtime: ${p.pageErrors.join(" | ")}` : "",
    p.console.length ? `  console.error: ${p.console.join(" | ")}` : "",
    p.badResponses.length ? `  сеть: ${p.badResponses.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function hasProblems(p: PageProblems): boolean {
  return p.console.length + p.pageErrors.length + p.badResponses.length > 0;
}

/** Вход по email/паролю через форму /login. Возвращает true при успехе. */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  if (!HAS_ADMIN_CREDS) return false;
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Пароль").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Войти/i }).click();
  await page.waitForURL(/\/(admin|profile)/, { timeout: 30_000 }).catch(() => {});
  return /\/admin/.test(page.url()) || /\/profile/.test(page.url());
}

/** Сохранённая сессия переиспользуется между тестами файла. */
export async function saveSession(context: BrowserContext, path: string) {
  await context.storageState({ path });
}

/** Список маршрутов админки, выведенный из файловой структуры роутов. */
export function adminRoutes(): string[] {
  const files = readdirSync("src/routes").filter(
    (f) => f.startsWith("admin") && f.endsWith(".tsx") && !f.includes("$") && !f.includes("render"),
  );
  const paths = files.map(
    (f) =>
      "/" +
      f
        .replace(/\.tsx$/, "")
        .split(".")
        .filter((seg) => seg !== "index")
        .join("/"),
  );
  return [...new Set(["/admin", ...paths])].sort();
}

export const PUBLIC_ROUTES = [
  "/",
  "/zones",
  "/equipment",
  "/services",
  "/production",
  "/attractions",
  "/cases",
  "/blog",
  "/testimonials",
  "/calculator",
  "/contacts",
  "/cart",
  "/login",
];
