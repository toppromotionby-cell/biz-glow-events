// Все разделы админки открываются без ошибок консоли и без 5xx.
// Требует E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, иначе тесты пропускаются.
import { test, expect } from "@playwright/test";
import {
  adminRoutes,
  loginAsAdmin,
  HAS_ADMIN_CREDS,
  watchProblems,
  hasProblems,
  formatProblems,
} from "./helpers";

test.describe("Админка — smoke по всем разделам", () => {
  test.skip(!HAS_ADMIN_CREDS, "нет E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD");

  const storage = "test-results/.admin-session.json";

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const ok = await loginAsAdmin(page);
    expect(ok, "не удалось войти в админку").toBe(true);
    await context.storageState({ path: storage });
    await context.close();
  });

  test.use({ storageState: "test-results/.admin-session.json" });

  for (const path of adminRoutes()) {
    test(`раздел ${path}`, async ({ page }) => {
      const problems = watchProblems(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Не должно выкидывать на логин.
      await expect(page).not.toHaveURL(/\/login/);
      // Каркас админки отрисовался.
      await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle").catch(() => {});

      expect(hasProblems(problems), formatProblems(path, problems)).toBe(false);
    });
  }
});
