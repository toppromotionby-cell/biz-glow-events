// Состояние списков живёт в URL: поиск/фильтр переживают F5 и кнопку «назад».
import { test, expect } from "@playwright/test";
import { loginAsAdmin, HAS_ADMIN_CREDS } from "./helpers";

test.describe("Списки админки — состояние в URL", () => {
  test.skip(!HAS_ADMIN_CREDS, "нет E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD");

  const storage = "test-results/.admin-session-lists.json";

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await loginAsAdmin(page), "не удалось войти").toBe(true);
    await context.storageState({ path: storage });
    await context.close();
  });

  test.use({ storageState: "test-results/.admin-session-lists.json" });

  test("поиск по заказам сохраняется в адресе и после перезагрузки", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("textbox").first();
    await search.fill("тест-поиск");
    await expect(page).toHaveURL(/q=|search=/, { timeout: 10_000 });

    const urlBefore = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByRole("textbox").first()).toHaveValue("тест-поиск");
  });

  test("переход в карточку и назад возвращает список в прежнее состояние", async ({ page }) => {
    await page.goto("/admin/documents/quotes", { waitUntil: "domcontentloaded" });
    const urlBefore = page.url();
    const firstLink = page.locator("a[href*='/admin/documents/quotes/']").first();
    if (await firstLink.count()) {
      await firstLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.goBack();
      expect(page.url()).toBe(urlBefore);
    }
  });
});
