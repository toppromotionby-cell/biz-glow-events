// Утилиты для контента, импортированного как HTML (описания каталога).
// Worker/SSR-safe: только строковые операции, без DOM и внешних зависимостей.

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "strong", "b", "em", "i", "u", "small", "sub", "sup",
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "a", "span", "div", "table", "thead",
  "tbody", "tr", "td", "th",
]);

const ALLOWED_ATTRS = new Set(["href", "title", "target", "rel"]);

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

/** Есть ли в строке хоть какая-то разметка. */
export function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(text);
}

function stripDangerousBlocks(html: string): string {
  return html.replace(
    /<(script|style|iframe|object|embed|form|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "",
  );
}

function cleanAttributes(tag: string, attrsRaw: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrsRaw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (!ALLOWED_ATTRS.has(name)) continue;
    if (name === "href" && !SAFE_URL.test(value.trim())) continue;
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag === "a") {
    if (!out.some((a) => a.startsWith("target="))) out.push('target="_blank"');
    out.push('rel="noopener noreferrer nofollow"');
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * Безопасный HTML: белый список тегов, служебные атрибуты (data, style, on*) удаляются.
 * Неразрешённые теги удаляются вместе с разметкой, но текст внутри сохраняется.
 */
export function sanitizeRichText(html: string): string {
  return stripDangerousBlocks(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (full, rawTag, attrs) => {
      const tag = String(rawTag).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      const selfClosing = /\/\s*$/.test(String(attrs));
      return `<${tag}${cleanAttributes(tag, String(attrs))}${selfClosing ? " /" : ""}>`;
    })
    .trim();
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'",
  laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", rsquo: "’",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, code: string) => {
    const key = code.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return full;
  });
}

/** HTML → чистый текст с сохранением границ абзацев. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    stripDangerousBlocks(html)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();
}

/** Обрезка по границе слова с многоточием. */
export function excerpt(text: string, maxLength = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:—–-]+$/, "") + "…";
}

/** Короткий человеческий текст для карточки из основного описания. */
export function toCardExcerpt(description?: string | null, maxLength = 140): string {
  const full = (description ?? "").trim();
  if (!full) return "";
  const plain = isHtml(full) ? htmlToPlainText(full) : full;
  // Первый абзац, который похож на предложение, а не на заголовок.
  const paragraphs = plain.split("\n").map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.find((p) => p.length > 60) ?? paragraphs[0] ?? "";
  return excerpt(body, maxLength);
}

