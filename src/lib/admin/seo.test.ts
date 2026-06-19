import { describe, it, expect } from "vitest";
import { generateSeoDescription } from "./seo";

describe("generateSeoDescription", () => {
  it("returns empty for no sources", () => {
    expect(generateSeoDescription(undefined, null, "")).toBe("");
  });
  it("picks first non-empty source", () => {
    expect(generateSeoDescription("", "  ", "Привет, мир")).toBe("Привет, мир");
  });
  it("strips html, markdown and collapses spaces", () => {
    const out = generateSeoDescription("<p>Hello</p>\n\n**bold**  text");
    expect(out).toBe("Hello bold text");
  });
  it("truncates at word boundary near 155", () => {
    const long = "слово ".repeat(60).trim();
    const out = generateSeoDescription(long);
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
  it("keeps short text intact", () => {
    expect(generateSeoDescription("short")).toBe("short");
  });
});
