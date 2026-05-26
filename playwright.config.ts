import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression tests for mobile + intermediate widths.
 *
 * Covers the breakpoints that matter for our centering logic:
 *   375  — small phone (default mobile)
 *   414  — large phone
 *   640  — sm breakpoint (2-col grid starts, layout still centered)
 *   768  — md breakpoint (layout switches to row-left)
 *   1024 — lg breakpoint (full desktop)
 *
 * Snapshots live next to each .spec.ts under __screenshots__/.
 * Update with: `bunx playwright test --update-snapshots`
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    launchOptions: { args: ["--font-render-hinting=none"] },
  },
  expect: {
    // Allow tiny font-rendering noise across runs
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  projects: [
    { name: "mobile-375", use: { ...devices["iPhone SE"], viewport: { width: 375, height: 812 } } },
    { name: "mobile-414", use: { ...devices["iPhone 11"], viewport: { width: 414, height: 896 } } },
    { name: "tablet-640", use: { viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 } },
    { name: "desktop-1024", use: { viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2 } },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:3000",
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
