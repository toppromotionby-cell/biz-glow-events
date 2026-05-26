/**
 * Mobile layout regression tests.
 *
 * These are lightweight "structural" tests: they read component source files
 * and assert that mobile-first centering utilities (and their `sm:` desktop
 * overrides) remain in place. They run in Node without a browser or jsdom,
 * so they're fast and have zero infra cost, but still catch the most common
 * regressions where someone removes `items-center` / `text-center` /
 * `justify-center` from a block we deliberately centered on mobile.
 *
 * If you intentionally change mobile alignment for a block listed here,
 * update the expectations below in the same commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const read = (rel: string) =>
  readFileSync(path.resolve(__dirname, "..", "..", "..", rel), "utf8");

/** Assert all snippets appear in the file (order-independent). */
function expectAllPresent(source: string, snippets: string[], file: string) {
  for (const s of snippets) {
    expect(source, `Missing "${s}" in ${file}`).toContain(s);
  }
}

describe("mobile layout: centering regressions", () => {
  it("CatalogChoiceModal: catalog cards center on mobile, left-align on sm+", () => {
    const file = "src/components/CatalogChoiceModal.tsx";
    const src = read(file);

    // Card row container: vertical + centered on mobile, horizontal + left on sm+
    expectAllPresent(
      src,
      [
        "flex flex-col items-center text-center gap-3",
        "sm:flex-row",
        "sm:items-start",
        "sm:text-left",
      ],
      file,
    );

    // "Перейти" CTA: centered on mobile, pushed to start on sm+
    expectAllPresent(
      src,
      ["justify-center sm:justify-start"],
      file,
    );

    // Dialog header text-center on mobile
    expect(src).toMatch(/DialogHeader[^>]*className="[^"]*text-center/);
  });
});
