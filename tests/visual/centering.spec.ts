import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression tests for centering across mobile + intermediate widths.
 *
 * What we snapshot:
 *  - CatalogChoiceModal (icon + title + desc cards, grid swaps at sm, layout swaps at md)
 *  - Industries grid tiles (centered stack on mobile, row-left at md+)
 *  - Industries dialog header (icon + title + scale)
 *  - About VALUES cards
 *
 * Snapshots are stored per-project (one folder per viewport), so a regression
 * on any single width fails its dedicated snapshot.
 */

/** Hide things that are inherently unstable across runs (images, videos, scrollbars). */
async function stabilizePage(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
      /* Replace media with solid placeholders so loading races don't break diffs */
      img, video { visibility: hidden !important; }
      ::-webkit-scrollbar { display: none !important; }
      html { scrollbar-width: none !important; }
    `,
  });
  // Wait for fonts so glyph metrics match
  await page.evaluate(() => (document as any).fonts?.ready);
}

test.describe("Centering — catalog choice modal", () => {
  test("opens and matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const trigger = page.getByRole("button", { name: /перейти в каталог/i }).first();
    await trigger.waitFor({ state: "visible", timeout: 10000 });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(400);

    await expect(dialog).toHaveScreenshot(`catalog-choice-${testInfo.project.name}.png`);
  });
});

test.describe("Centering — industries page", () => {
  test("grid tiles match snapshot", async ({ page }, testInfo) => {
    await page.goto("/industries");
    await stabilizePage(page);

    const grid = page.locator('section[aria-labelledby="grid-heading"]');
    await expect(grid).toBeVisible();
    await expect(grid).toHaveScreenshot(`industries-grid-${testInfo.project.name}.png`);
  });

  test("dialog header matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/industries");
    await stabilizePage(page);

    // First industry tile
    const firstTile = page
      .locator('section[aria-labelledby="grid-heading"] button')
      .first();
    await firstTile.scrollIntoViewIfNeeded();
    await firstTile.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await expect(dialog).toHaveScreenshot(`industries-dialog-${testInfo.project.name}.png`);
  });
});

test.describe("Centering — about values cards", () => {
  test("VALUES grid matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/about");
    await stabilizePage(page);

    const section = page.locator('section[aria-labelledby="values-heading"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveScreenshot(`about-values-${testInfo.project.name}.png`);
  });
});


test.describe("Centering — catalog landing", () => {
  test("CATALOGS grid matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/catalog");
    await stabilizePage(page);
    const grid = page.locator("main, body").locator(".grid").first();
    await expect(grid).toBeVisible();
    await expect(grid).toHaveScreenshot(`catalog-landing-${testInfo.project.name}.png`);
  });
});

test.describe("Centering — terms-rental BLOCKS", () => {
  test("BLOCKS grid matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/terms-rental");
    await stabilizePage(page);
    // First grid section under the header
    const grid = page.locator("section.grid").first();
    await expect(grid).toBeVisible();
    await expect(grid).toHaveScreenshot(`terms-rental-blocks-${testInfo.project.name}.png`);
  });
});

test.describe("Centering — partners BENEFITS", () => {
  test("BENEFITS grid matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/partners");
    await stabilizePage(page);
    const section = page.locator('section[aria-labelledby="benefits-heading"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveScreenshot(`partners-benefits-${testInfo.project.name}.png`);
  });
});

test.describe("Centering — delivery PAYMENT cards", () => {
  test("PAYMENT grid matches snapshot", async ({ page }, testInfo) => {
    await page.goto("/delivery");
    await stabilizePage(page);
    const section = page.locator('section[aria-labelledby="payment-heading"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveScreenshot(`delivery-payment-${testInfo.project.name}.png`);
  });
});
