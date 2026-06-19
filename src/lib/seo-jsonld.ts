// Helpers for category-level + detail-page JSON-LD.

/**
 * Escapes a JSON string for safe embedding inside a <script type="application/ld+json"> block.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const SITE_URL = "https://event-hub.by";
const ORG = { "@type": "Organization", name: "event-hub.by", url: SITE_URL } as const;
const PUBLISHER = {
  "@type": "Organization",
  name: "event-hub.by",
  logo: { "@type": "ImageObject", url: `${SITE_URL}/og-image.png` },
} as const;

/** Drops undefined / null / "" entries from an object — schema.org validators reject them. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

type ItemListInput = { title?: string | null; slug?: string | null };

/** ItemList schema for a category page. */
export function itemListJsonLd(opts: {
  basePath: string;
  pageUrl: string;
  name: string;
  items: ItemListInput[];
  limit?: number;
}): string {
  const limit = opts.limit ?? 20;
  const elements = opts.items
    .filter((i) => i.slug && i.title)
    .slice(0, limit)
    .map((i, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: i.title,
      url: `${SITE_URL}${opts.basePath}/${i.slug}`,
    }));
  return safeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    url: opts.pageUrl,
    numberOfItems: elements.length,
    itemListElement: elements,
  });
}

// ───────────────────────── Article (blog) ─────────────────────────

export type BlogPostJsonLdInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  seo_description?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

export function buildBlogPostJsonLd(post: BlogPostJsonLdInput): Record<string, unknown> {
  const url = `${SITE_URL}/blog/${post.slug}`;
  return compact({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? post.seo_description ?? undefined,
    image: post.cover_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    author: ORG,
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "ru-BY",
  }) as Record<string, unknown>;
}

// ───────────────────────── Event (case) ─────────────────────────

export type CaseEventJsonLdInput = {
  title: string;
  slug: string;
  summary?: string | null;
  description?: string | null;
  cover_url?: string | null;
  event_date?: string | null;
  location?: string | null;
  client?: string | null;
};

export function buildCaseEventJsonLd(c: CaseEventJsonLdInput): Record<string, unknown> {
  const url = `${SITE_URL}/cases/${c.slug}`;
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: c.title,
    description: c.summary ?? c.description ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    image: c.cover_url ?? undefined,
    startDate: c.event_date ?? undefined,
    organizer: ORG,
  };
  if (c.location) {
    base.location = {
      "@type": "Place",
      name: c.location,
      address: { "@type": "PostalAddress", addressLocality: c.location, addressCountry: "BY" },
    };
  }
  if (c.client) base.performer = { "@type": "Organization", name: c.client };
  return compact(base) as Record<string, unknown>;
}

// ───────────────────────── Review (testimonial) ─────────────────────────

export type TestimonialJsonLdInput = {
  client_name: string;
  client_company?: string | null;
  text: string;
  rating: number;
  event_date?: string | null;
};

export function buildTestimonialJsonLd(t: TestimonialJsonLdInput): Record<string, unknown> {
  return compact({
    "@context": "https://schema.org",
    "@type": "Review",
    reviewBody: t.text,
    datePublished: t.event_date ?? undefined,
    author: compact({
      "@type": "Person",
      name: t.client_name,
      ...(t.client_company ? { affiliation: { "@type": "Organization", name: t.client_company } } : {}),
    }),
    reviewRating: {
      "@type": "Rating",
      ratingValue: Math.max(1, Math.min(5, Math.round(t.rating))),
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: ORG,
  }) as Record<string, unknown>;
}
