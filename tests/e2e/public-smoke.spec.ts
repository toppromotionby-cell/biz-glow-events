// Публичные страницы: открываются, без runtime-ошибок и 5xx, есть один H1.
import { test, expect } from "@playwright/test";
import { PUBLIC_ROUTES, watchProblems, hasProblems, formatProblems } from "./helpers";

for (const path of PUBLIC_ROUTES) {
  test(`публичная страница ${path} без ошибок`, async ({ page }) => {
    const problems = watchProblems(page);
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `HTTP статус ${path}`).toBeLessThan(400);

    await page.waitForLoadState("networkidle").catch(() => {});
    const h1 = page.locator("h1");
    await expect(h1.first(), `нет H1 на ${path}`).toBeVisible({ timeout: 15_000 });
    expect(await h1.count(), `на ${path} должен быть один H1`).toBeLessThanOrEqual(1);

    expect(hasProblems(problems), formatProblems(path, problems)).toBe(false);
  });
}

test("оверлеи редактора не попадают в prod-сборку разметки", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lovable-editor], .lovable-badge")).toHaveCount(0);
});
