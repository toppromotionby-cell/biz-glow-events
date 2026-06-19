import { describe, it, expect } from "vitest";
import { blogPostSchema, testimonialSchema, caseSchema } from "./schemas";

describe("blogPostSchema", () => {
  const base = {
    title: "T", slug: "my-post", excerpt: "", body: "", cover_url: "",
    tags: [] as string[], published: false, published_at: null,
    seo_title: "", seo_description: "",
  };
  it("accepts valid input", () => {
    expect(blogPostSchema.safeParse(base).success).toBe(true);
  });
  it("rejects bad slug (uppercase / spaces)", () => {
    expect(blogPostSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...base, slug: "" }).success).toBe(false);
  });
  it("rejects too long seo_title", () => {
    expect(blogPostSchema.safeParse({ ...base, seo_title: "x".repeat(61) }).success).toBe(false);
  });
  it("rejects invalid cover_url", () => {
    expect(blogPostSchema.safeParse({ ...base, cover_url: "not-a-url" }).success).toBe(false);
  });
});

describe("testimonialSchema", () => {
  const base = {
    client_name: "Иван", client_company: "", client_role: "", client_photo_url: "",
    rating: 5, text: "Отлично", event_date: null,
    published: true, featured: false, sort_order: 0,
  };
  it("accepts valid input", () => {
    expect(testimonialSchema.safeParse(base).success).toBe(true);
  });
  it("rejects rating out of range", () => {
    expect(testimonialSchema.safeParse({ ...base, rating: 0 }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
  });
  it("requires client_name and text", () => {
    expect(testimonialSchema.safeParse({ ...base, client_name: "" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, text: "" }).success).toBe(false);
  });
});

describe("caseSchema", () => {
  const base = {
    title: "Кейс", slug: "case-1", client: "", event_type: "", event_date: null,
    location: "", guests_count: null, summary: "", description: "", cover_url: "",
    seo_title: "", seo_description: "", published: false, featured: false,
  };
  it("accepts valid input", () => {
    expect(caseSchema.safeParse(base).success).toBe(true);
  });
  it("rejects bad slug", () => {
    expect(caseSchema.safeParse({ ...base, slug: "WRONG" }).success).toBe(false);
  });
});
