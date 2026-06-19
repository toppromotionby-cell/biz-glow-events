import { test } from "@playwright/test";
test("dump", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8080/equipment", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const data = await p.locator(".card-title-gradient").first().evaluate(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      text: el.textContent,
      display: cs.display,
      minHeight: cs.minHeight,
      height: r.height,
      lineHeight: cs.lineHeight,
      overflow: cs.overflow,
      orient: cs.webkitBoxOrient,
      clamp: cs.webkitLineClamp,
    };
  });
  console.log("DUMP:", JSON.stringify(data, null, 2));
  await ctx.close();
});
