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
  // Карточки разделов каталога централизованы в src/components/catalog/CatalogNav.tsx
  // (CatalogSectionTile — модалка/главная, CatalogSectionCard — /catalog),
  // поэтому проверяем инварианты именно там, а не в местах использования.
  it("CatalogChoiceModal: tiles grid + centered dialog header", () => {
    const file = "src/components/CatalogChoiceModal.tsx";
    const src = read(file);

    expectAllPresent(src, ["grid-tiles", "CatalogSectionTile"], file);

    // Dialog header text-center on mobile
    expect(src).toMatch(/DialogHeader[^>]*className="[^"]*text-center/);
  });


  it("Industries grid tiles: centered stack on mobile, row-left at md+", () => {
    const file = "src/routes/industries.tsx";
    const src = read(file);
    expectAllPresent(
      src,
      [
        "text-center md:text-left",
        "items-center md:items-start",
      ],
      file,
    );
  });

  it("Industries dialog header: centered on mobile, left at md+", () => {
    const file = "src/routes/industries.tsx";
    const src = read(file);
    expect(src).toMatch(
      /DialogHeader[^>]*className="[^"]*items-center text-center md:items-start md:text-left/,
    );
  });

  it("About VALUES cards: centered stack on mobile, row-left at md+", () => {
    const file = "src/routes/about.tsx";
    const src = read(file);
    expectAllPresent(
      src,
      [
        "flex h-full flex-col items-center text-center",
        "md:flex-row",
        "md:items-start",
        "md:text-left",
      ],
      file,
    );
  });

  it("Catalog landing cards: shrink-safe row layout on mobile", () => {
    // Маршрут /catalog — src/routes/catalog.index.tsx, карточки — CatalogNav.tsx.
    read("src/routes/catalog.index.tsx");
    const file = "src/components/catalog/CatalogNav.tsx";
    const src = read(file);
    expectAllPresent(
      src,
      [
        "h-full flex flex-col",
        "shrink-0 items-center justify-center rounded-xl",
        "min-w-0 flex-1",
        "leading-snug text-balance",
      ],
      file,
    );
  });


  it("DirectionCard: centered stack on mobile, left-aligned at md+", () => {
    const file = "src/components/ui/DirectionCard.tsx";
    const src = read(file);
    expect(src).toContain("items-center text-center md:items-start md:text-left");
  });

  it("Terms-rental BLOCKS: centered stack on mobile, row-left at md+", () => {
    const file = "src/routes/terms-rental.tsx";
    const src = read(file);
    expectAllPresent(
      src,
      [
        "flex h-full flex-col items-center text-center gap-3",
        "md:flex-row",
        "md:items-start",
        "md:text-left",
      ],
      file,
    );
  });

  it("Partners BENEFITS: centered stack on mobile, left at md+", () => {
    const file = "src/routes/partners.tsx";
    const src = read(file);
    expect(src).toContain(
      "flex h-full flex-col items-center text-center md:items-start md:text-left",
    );
  });

  it("Delivery PAYMENT cards: centered stack on mobile, left at md+", () => {
    const file = "src/routes/delivery.tsx";
    const src = read(file);
    expect(src).toContain(
      "flex h-full flex-col items-center text-center md:items-start md:text-left",
    );
  });
});
