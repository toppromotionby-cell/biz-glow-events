import { test } from "@playwright/test";
const PAGES = ["/", "/equipment"];
for (const url of PAGES) {
  for (const w of [1280, 375]) {
    test(`shot ${url} ${w}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 1600 } });
      const p = await ctx.newPage();
      await p.goto(`http://localhost:8080${url}`, { waitUntil: "networkidle" });
      await p.waitForTimeout(1500);
      const name = url === "/" ? "home" : "equipment";
      await p.screenshot({ path: `/tmp/${name}_${w}.png` });
      await ctx.close();
    });
  }
}
