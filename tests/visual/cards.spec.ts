import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Визуальные тесты карточек:
 *  - FeaturedCard на главной (короткое и длинное название);
 *  - CatalogCard в каталоге (короткое и длинное название);
 *  - hover-состояние FeaturedCard на десктопе;
 *  - skeleton до загрузки изображений.
 *
 * Цель — поймать регрессии вокруг `card-title-gradient`, `line-clamp` и
 * стабильной высоты карточки.
 *
 * Снимки складываются per-project в `cards.spec.ts-snapshots/<project>/`.
 * Обновление: `bunx playwright test tests/visual/cards.spec.ts --update-snapshots`.
 */

async function stabilizePage(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
      img, video { visibility: hidden !important; }
      ::-webkit-scrollbar { display: none !important; }
      html { scrollbar-width: none !important; }
    `,
  });
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<void> } }).fonts?.ready);
}

/** Подменяет текст первой карточки длинной строкой, чтобы спровоцировать обрезку. */
async function injectLongTitle(card: Locator, text: string) {
  await card.evaluate((el, t) => {
    const btn = el.querySelector("h3 button");
    if (btn) {
      // ClampedTitle рендерит <span> внутри кнопки — заменим его текст,
      // а если структура изменилась, перепишем весь контент кнопки.
      const span = btn.querySelector("span");
      if (span) span.textContent = t;
      else btn.textContent = t;
    }
  }, text);
  // даём ResizeObserver/RAF успеть пересчитать обрезку
  await card.page().waitForTimeout(120);
}

const LONG = "Очень длинное название карточки для проверки переноса и обрезки на двух строках с многоточием в конце";

test.describe("Cards — FeaturedCard на главной", () => {
  test("реальные названия (короткие)", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const grid = page.locator("section").filter({ hasText: "Наши рекомендации" }).locator("article").first();
    await grid.waitFor({ state: "visible", timeout: 15000 });
    await grid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(grid).toHaveScreenshot(`featured-short-${testInfo.project.name}.png`);
  });

  test("длинное название — обрезка с многоточием", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const card = page.locator("section").filter({ hasText: "Наши рекомендации" }).locator("article").first();
    await card.waitFor({ state: "visible", timeout: 15000 });
    await card.scrollIntoViewIfNeeded();
    await injectLongTitle(card, LONG);
    await expect(card).toHaveScreenshot(`featured-long-${testInfo.project.name}.png`);
  });

  test("hover-состояние не ломает градиент (все breakpoints с pointer)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("mobile-"), "hover не релевантен на тач-устройствах");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const card = page.locator("section").filter({ hasText: "Наши рекомендации" }).locator("article").first();
    await card.waitFor({ state: "visible", timeout: 15000 });
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(350); // ждём конец transition filter (300ms)
    await expect(card).toHaveScreenshot(`featured-hover-${testInfo.project.name}.png`);
  });

  test("шрифт не загружен → fallback-метрики удерживают высоту", async ({ browser }, testInfo) => {
    // отдельный контекст, чтобы заблокировать загрузку шрифтов до первого рендера
    const ctx = await browser.newContext({
      viewport: { width: testInfo.project.use.viewport!.width, height: testInfo.project.use.viewport!.height },
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: `*,*::before,*::after{transition:none!important;animation:none!important;} img,video{visibility:hidden!important;}` });
    const card = page.locator("section").filter({ hasText: "Наши рекомендации" }).locator("article").first();
    await card.waitFor({ state: "visible", timeout: 15000 });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await expect(card).toHaveScreenshot(`featured-no-font-${testInfo.project.name}.png`);
    await ctx.close();
  });
});

test.describe("Cards — CatalogCard в каталоге", () => {
  test("длинное название — обрезка по словам", async ({ page }, testInfo) => {
    await page.goto("/equipment");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const card = page.locator("main article, body article").first();
    await card.waitFor({ state: "visible", timeout: 15000 });
    await card.scrollIntoViewIfNeeded();
    await injectLongTitle(card, LONG);
    await expect(card).toHaveScreenshot(`catalog-long-${testInfo.project.name}.png`);
  });
});

test.describe("Cards — стабильность высоты при разных длинах", () => {
  test("ряд карточек: смешанные короткие и длинные названия", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-375", "одна узкая колонка — высоту строки сравнивать не нужно");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilizePage(page);

    const section = page.locator("section").filter({ hasText: "Наши рекомендации" });
    await section.scrollIntoViewIfNeeded();
    const cards = section.locator("article");
    const count = Math.min(3, await cards.count());
    for (let i = 0; i < count; i += 1) {
      const text = i === 1 ? LONG : "Короткое название";
      await injectLongTitle(cards.nth(i), text);
    }
    const grid = section.locator(":scope > div").first();
    await expect(grid).toHaveScreenshot(`featured-row-mixed-${testInfo.project.name}.png`);
  });
});
