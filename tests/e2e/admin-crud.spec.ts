// Критичный CRUD-путь: создание → правка → сохранение после F5 → удаление
// с подтверждением. Пишет в базу, поэтому включается флагом E2E_WRITE=1.
import { test, expect } from "@playwright/test";
import { loginAsAdmin, HAS_ADMIN_CREDS, ALLOW_WRITES } from "./helpers";

test.describe("Отзывы — полный CRUD", () => {
  test.skip(!HAS_ADMIN_CREDS || !ALLOW_WRITES, "нужны креды админа и E2E_WRITE=1");

  const storage = "test-results/.admin-session-crud.json";
  const name = `E2E отзыв ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await loginAsAdmin(page), "не удалось войти").toBe(true);
    await context.storageState({ path: storage });
    await context.close();
  });

  test.use({ storageState: "test-results/.admin-session-crud.json" });

  test("создаёт, редактирует, переживает перезагрузку и удаляется", async ({ page }) => {
    await page.goto("/admin/testimonials", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Добавить|Создать|Новый/i }).first().click();
    await page.getByLabel(/Имя|Автор/i).first().fill(name);
    await page.getByLabel(/Отзыв|Текст/i).first().fill("Текст e2e-отзыва");
    await page.getByRole("button", { name: /Сохранить/i }).first().click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });

    // Правка сохраняется и остаётся после F5.
    await page.getByText(name).first().click();
    const textArea = page.getByLabel(/Отзыв|Текст/i).first();
    await textArea.fill("Текст e2e-отзыва (обновлён)");
    await page.getByRole("button", { name: /Сохранить/i }).first().click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(name).first().click();
    await expect(page.getByLabel(/Отзыв|Текст/i).first()).toHaveValue(/обновлён/);

    // Удаление требует подтверждения в диалоге.
    await page.getByRole("button", { name: /Удалить/i }).first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Удалить|Подтвердить/i }).click();
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 20_000 });
  });
});
