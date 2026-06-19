import { test } from "@playwright/test";
test("dump", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const info = await page.locator(".card-title-gradient").first().evaluate(el => {
    const s = getComputedStyle(el);
    return {tag:el.tagName, display:s.display, clamp:s.webkitLineClamp, orient:s.webkitBoxOrient, overflow:s.overflow};
  });
  console.log("DUMP:", JSON.stringify(info));
});
