// JSON-LD валидаторы: проверяем, что builders выдают schema.org-совместимые объекты
// с обязательными полями и без undefined/пустых значений.
import { describe, it, expect } from "vitest";
import {
  buildBlogPostJsonLd, buildCaseEventJsonLd, buildTestimonialJsonLd,
  itemListJsonLd, safeJsonLd, SITE_URL,
} from "./seo-jsonld";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Walk a JSON-LD tree and collect violations. */
function violations(node: unknown, path = "$"): string[] {
  const out: string[] = [];
  if (node === undefined) out.push(`${path}: undefined leaked`);
  if (node === null) return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...violations(v, `${path}[${i}]`)));
    return out;
  }
  if (isPlainObject(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (v === undefined) out.push(`${path}.${k}: undefined value`);
      if (typeof v === "string" && v.trim() === "") out.push(`${path}.${k}: empty string`);
      out.push(...violations(v, `${path}.${k}`));
    }
  }
  return out;
}

describe("safeJsonLd", () => {
  it("escapes </script> sequences", () => {
    const out = safeJsonLd({ x: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });
  it("escapes line separators", () => {
    expect(safeJsonLd({ x: "\u2028\u2029" })).not.toMatch(/[\u2028\u2029]/);
  });
});

describe("buildBlogPostJsonLd", () => {
  const ld = buildBlogPostJsonLd({
    title: "Как мы делаем events",
    slug: "events-2026",
    excerpt: "Кратко о подходе",
    cover_url: "https://cdn/x.jpg",
    published_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-02T10:00:00Z",
    seo_description: null,
  });
  it("has required Article fields", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Article");
    expect(ld.headline).toBe("Как мы делаем events");
    expect(ld.datePublished).toBe("2026-01-01T10:00:00Z");
    expect(ld.dateModified).toBe("2026-01-02T10:00:00Z");
    expect(ld.image).toBe("https://cdn/x.jpg");
  });
  it("mainEntityOfPage points to canonical URL", () => {
    const mep = ld.mainEntityOfPage as { "@id": string };
    expect(mep["@id"]).toBe(`${SITE_URL}/blog/events-2026`);
  });
  it("publisher has logo", () => {
    const pub = ld.publisher as { logo: { url: string } };
    expect(pub.logo.url).toMatch(/^https:/);
  });
  it("does not leak undefined / empty values", () => {
    expect(violations(ld)).toEqual([]);
  });
  it("falls back to published_at for dateModified when updated_at missing", () => {
    const ld2 = buildBlogPostJsonLd({ title: "t", slug: "s", published_at: "2026-01-01" });
    expect(ld2.dateModified).toBe("2026-01-01");
  });
  it("omits description / image when sources are empty", () => {
    const ld2 = buildBlogPostJsonLd({ title: "t", slug: "s" });
    expect(ld2.description).toBeUndefined();
    expect(ld2.image).toBeUndefined();
  });
});

describe("buildCaseEventJsonLd", () => {
  const ld = buildCaseEventJsonLd({
    title: "Свадьба для 200 гостей",
    slug: "wedding-200",
    summary: "Outdoor, август",
    cover_url: "https://cdn/w.jpg",
    event_date: "2025-08-15",
    location: "Минск",
    client: "ООО Ромашка",
  });
  it("has required Event fields", () => {
    expect(ld["@type"]).toBe("Event");
    expect(ld.name).toBe("Свадьба для 200 гостей");
    expect(ld.startDate).toBe("2025-08-15");
    expect(ld.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(ld.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(ld.url).toBe(`${SITE_URL}/cases/wedding-200`);
  });
  it("includes Place with PostalAddress", () => {
    const loc = ld.location as { "@type": string; address: { "@type": string; addressCountry: string } };
    expect(loc["@type"]).toBe("Place");
    expect(loc.address["@type"]).toBe("PostalAddress");
    expect(loc.address.addressCountry).toBe("BY");
  });
  it("includes performer when client provided", () => {
    expect((ld.performer as { name: string }).name).toBe("ООО Ромашка");
  });
  it("omits location / performer when missing", () => {
    const ld2 = buildCaseEventJsonLd({ title: "t", slug: "s" });
    expect(ld2.location).toBeUndefined();
    expect(ld2.performer).toBeUndefined();
  });
  it("no undefined leaks", () => {
    expect(violations(ld)).toEqual([]);
  });
});

describe("buildTestimonialJsonLd", () => {
  const ld = buildTestimonialJsonLd({
    client_name: "Анна Иванова",
    client_company: "EventLab",
    text: "Очень довольны.",
    rating: 5,
    event_date: "2025-06-01",
  });
  it("has Review type with rating", () => {
    expect(ld["@type"]).toBe("Review");
    const r = ld.reviewRating as { ratingValue: number; bestRating: number; worstRating: number };
    expect(r.ratingValue).toBe(5);
    expect(r.bestRating).toBe(5);
    expect(r.worstRating).toBe(1);
  });
  it("clamps rating into [1..5]", () => {
    expect((buildTestimonialJsonLd({ client_name: "x", text: "y", rating: 0 }).reviewRating as { ratingValue: number }).ratingValue).toBe(1);
    expect((buildTestimonialJsonLd({ client_name: "x", text: "y", rating: 9 }).reviewRating as { ratingValue: number }).ratingValue).toBe(5);
    expect((buildTestimonialJsonLd({ client_name: "x", text: "y", rating: 3.7 }).reviewRating as { ratingValue: number }).ratingValue).toBe(4);
  });
  it("author has Person with affiliation when company set", () => {
    const a = ld.author as { "@type": string; name: string; affiliation?: { name: string } };
    expect(a["@type"]).toBe("Person");
    expect(a.affiliation?.name).toBe("EventLab");
  });
  it("omits affiliation when no company", () => {
    const a = buildTestimonialJsonLd({ client_name: "n", text: "t", rating: 5 }).author as { affiliation?: unknown };
    expect(a.affiliation).toBeUndefined();
  });
});

describe("itemListJsonLd", () => {
  const out = itemListJsonLd({
    basePath: "/blog",
    pageUrl: "https://event-hub.by/blog",
    name: "Блог",
    items: [
      { title: "Пост 1", slug: "post-1" },
      { title: "Пост 2", slug: "post-2" },
      { title: null, slug: "skipme" },
      { title: "no slug", slug: null },
    ],
  });
  const parsed = JSON.parse(out) as { numberOfItems: number; itemListElement: Array<{ url: string; position: number }> };
  it("filters out items missing slug or title", () => {
    expect(parsed.numberOfItems).toBe(2);
    expect(parsed.itemListElement).toHaveLength(2);
  });
  it("emits sequential positions and absolute URLs", () => {
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[1].position).toBe(2);
    expect(parsed.itemListElement[0].url).toBe(`${SITE_URL}/blog/post-1`);
  });
  it("respects limit", () => {
    const out2 = itemListJsonLd({
      basePath: "/blog", pageUrl: "x", name: "n", limit: 1,
      items: [{ title: "a", slug: "a" }, { title: "b", slug: "b" }],
    });
    expect((JSON.parse(out2) as { numberOfItems: number }).numberOfItems).toBe(1);
  });
});
