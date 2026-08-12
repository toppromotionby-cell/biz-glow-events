import { defineConfig, devices } from "@playwright/test";

/**
 * Этап 9: приёмочные e2e-тесты.
 *
 * Отдельный конфиг от visual-регрессии (playwright.config.ts): здесь нет
 * пиксельных снапшотов, только поведение — маршруты, консоль, состояние в URL,
 * CRUD и права.
 *
 * Запуск:
 *   bun run test:e2e                 — публичные страницы (без логина)
 *   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… bun run test:e2e   — плюс админка
 *   E2E_WRITE=1 …                    — плюс сценарии, которые создают/удаляют записи
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
