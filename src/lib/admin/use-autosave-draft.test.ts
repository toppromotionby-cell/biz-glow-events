// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readDraft, clearDraft } from "./use-autosave-draft";

describe("draft storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns null when nothing saved", () => {
    expect(readDraft("missing")).toBeNull();
  });

  it("reads stored draft payload", () => {
    window.localStorage.setItem(
      "admin-draft:k1",
      JSON.stringify({ savedAt: new Date().toISOString(), data: { a: 1 } }),
    );
    expect(readDraft<{ a: number }>("k1")).toEqual({ a: 1 });
  });

  it("clearDraft removes the entry", () => {
    window.localStorage.setItem("admin-draft:k2", JSON.stringify({ savedAt: "", data: 42 }));
    clearDraft("k2");
    expect(readDraft("k2")).toBeNull();
  });

  it("returns null on malformed payload", () => {
    window.localStorage.setItem("admin-draft:k3", "not-json");
    expect(readDraft("k3")).toBeNull();
  });
});
