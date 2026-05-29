// Helpers for category-level JSON-LD (ItemList).

/**
 * Escapes a JSON string for safe embedding inside a <script type="application/ld+json"> block.
 * Prevents stored XSS where attacker-controlled content contains "</script>" or HTML comment
 * sequences that would break out of the script element.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const BASE_URL = "https://event-hub.by";

type ItemListInput = {
  title?: string | null;
  slug?: string | null;
};

/**
 * Builds an ItemList schema for a category page (zones, equipment, services,
 * production, blog, cases). First N items only — keeps payload small while
 * still giving search engines a structured list of children.
 */
export function itemListJsonLd(opts: {
  basePath: string; // e.g. "/equipment"
  pageUrl: string; // absolute URL of the category page
  name: string; // human-readable list name
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
      url: `${BASE_URL}${opts.basePath}/${i.slug}`,
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
