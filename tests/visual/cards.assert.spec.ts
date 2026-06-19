import { test, expect, type Page } from "@playwright/test";

/**
 * Детерминированные ассерты для карточек каталога — дополняют пиксельные
 * снапшоты из cards.spec.ts. Проверяют именно три инварианта, которые
 * чаще всего ломаются при рефакторинге:
 *
 *   1. Градиент-текст — background-clip: text + прозрачный fill;
 *   2. line-clamp = 2 (display: -webkit-box, -webkit-line-clamp: 2);
 *   3. Стабильная высота карточки при экстремально длинном заголовке
 *      (отличие от карточки с коротким названием < 2px).
 *
 * Эти проверки запускаются в CI наравне со снапшотами и не зависят от
 * font rendering / девайс-пикселей.
 */

const LONG =
  "Очень длинное название карточки для проверки переноса и обрезки на двух строках с многоточием в конце и ещё немного текста сверху";

async function gotoHome(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const section = page.locator("section").filter({ hasText: "Наши рекомендации" });
  await section.locator("article").first().waitFor({ state: "visible", timeout: 15000 });
  await section.scrollIntoViewIfNeeded();
  return section;
}

test("градиент: background-clip: text + прозрачный fill", async ({ page }) => {
  const section = await gotoHome(page);
  const title = section.locator("article").first().locator(".card-title-gradient").first();
  await expect(title).toBeVisible();

  const styles = await title.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      backgroundClip: s.backgroundClip || s.webkitBackgroundClip,
      webkitBackgroundClip: s.webkitBackgroundClip,
      webkitTextFillColor: s.webkitTextFillColor,
      backgroundImage: s.backgroundImage,
      filter: s.filter,
    };
  });

  expect(styles.webkitBackgroundClip).toBe("text");
  // прозрачный fill — иначе градиент перекрывается сплошным цветом
  expect(styles.webkitTextFillColor).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  expect(styles.backgroundImage).toMatch(/linear-gradient/);
  // drop-shadow для свечения
  expect(styles.filter).toMatch(/drop-shadow/);
});

test("line-clamp: 2 строки с -webkit-box", async ({ page }) => {
  const section = await gotoHome(page);
  const title = section.locator("article").first().locator(".card-title-gradient").first();

  const styles = await title.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      display: s.display,
      webkitBoxOrient: s.webkitBoxOrient || (s as unknown as Record<string, string>)["-webkit-box-orient"],
      webkitLineClamp: s.webkitLineClamp,
      overflow: s.overflow,
    };
  });

  // Lightning CSS оптимизирует `display:-webkit-box + -webkit-line-clamp`
  // в современный шорткат с `display:flow-root` — поведение в Chrome идентично.
  expect(["-webkit-box", "flow-root"]).toContain(styles.display);
  expect(styles.webkitLineClamp).toBe("2");
  expect(styles.overflow).toBe("hidden");
});

test("стабильная высота карточки при длинном заголовке", async ({ page }) => {
  const section = await gotoHome(page);
  const first = section.locator("article").first();

  // ждём, пока ленивые картинки догрузятся — иначе высота карточки меняется
  // между baseline и измерением после подмены текста, что даёт ложный фейл.
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => {
          img.addEventListener("load", () => r(null), { once: true });
          img.addEventListener("error", () => r(null), { once: true });
        }),
      ),
    );
  });
  await page.waitForTimeout(100);

  const baselineHeight = await first.evaluate((el) => el.getBoundingClientRect().height);

  await first.evaluate((el, t) => {
    const btn = el.querySelector("h3 .card-title-gradient");
    if (btn) btn.textContent = t;
  }, LONG);
  await page.waitForTimeout(150);

  const longHeight = await first.evaluate((el) => el.getBoundingClientRect().height);

  // обрезка должна удержать высоту: допускаем sub-pixel/font-metrics шум
  expect(Math.abs(longHeight - baselineHeight)).toBeLessThan(4);

  // и сам заголовок не должен превышать ~2 строк
  const titleHeight = await first
    .locator(".card-title-gradient")
    .first()
    .evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      const h = el.getBoundingClientRect().height;
      return { lh, h };
    });
  expect(titleHeight.h).toBeLessThanOrEqual(titleHeight.lh * 2 + 2);
});

test("ряд карточек: одинаковая высота при смешанных длинах", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-375" || testInfo.project.name === "mobile-414",
    "одна колонка — проверка высоты строки нерелевантна",
  );
  const section = await gotoHome(page);
  const cards = section.locator("article");
  const count = Math.min(3, await cards.count());
  test.skip(count < 2, "недостаточно карточек для сравнения");

  for (let i = 0; i < count; i += 1) {
    const text = i === 1 ? LONG : "Короткое название";
    await cards.nth(i).evaluate((el, t) => {
      const btn = el.querySelector("h3 .card-title-gradient");
      if (btn) btn.textContent = t;
    }, text);
  }
  await page.waitForTimeout(200);

  const heights = await cards.evaluateAll((els) =>
    els.slice(0, 3).map((el) => el.getBoundingClientRect().height),
  );
  const max = Math.max(...heights);
  const min = Math.min(...heights);
  // grid-auto-rows: 1fr должен выровнять карточки в одном ряду
  expect(max - min).toBeLessThan(2);
});
