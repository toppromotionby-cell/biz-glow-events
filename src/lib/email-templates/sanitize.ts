// Worker/SSR-safe HTML sanitizer для email-шаблонов.
// Заменяет isomorphic-dompurify, который тянет jsdom и падает в Cloudflare Worker
// ("Cannot read properties of undefined (reading 'bind')" → catastrophic SSR 500).
//
// Используется только для email-HTML, который редактируется админом/менеджером
// (uses already gated by has_role в email-templates.functions.ts).
// Достаточно для допущенного множества тегов/атрибутов — не пытается быть
// заменой DOMPurify в браузере на произвольном пользовательском вводе.

const ALLOWED_TAGS = new Set([
  "html", "head", "body", "meta", "title", "style",
  "div", "span", "p", "br", "hr", "a", "img",
  "strong", "b", "em", "i", "u", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "td", "th",
  "blockquote", "pre", "code",
  "center", "font",
]);

const FORBID_TAGS = new Set([
  "script", "iframe", "object", "embed", "form", "input", "button",
  "link", "base", "noscript", "svg", "math",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "style", "class", "id",
  "width", "height", "border", "align", "valign",
  "cellpadding", "cellspacing", "bgcolor", "color", "face", "size",
  "target", "rel", "name", "role",
]);

const SAFE_URL = /^(https?:|mailto:|tel:|cid:|#|\/)/i;

function stripForbiddenBlocks(html: string): string {
  // Удаляем целиком содержимое опасных блоков (script/style исключение: style разрешён).
  return html.replace(
    /<(script|iframe|object|embed|form|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "",
  );
}

function sanitizeAttrs(tagName: string, attrsStr: string): string {
  const result: string[] = [];
  // Простой парсер: name, name=value, name="value", name='value'.
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrsStr)) !== null) {
    const rawName = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";

    // on*-handlers всегда выкидываем.
    if (rawName.startsWith("on")) continue;
    if (!ALLOWED_ATTRS.has(rawName)) continue;

    // URL-атрибуты: только безопасные схемы.
    if (rawName === "href" || rawName === "src") {
      const v = value.trim();
      if (!v || !SAFE_URL.test(v)) continue;
    }

    // style: запрещаем javascript:/expression()/url(javascript:)
    if (rawName === "style") {
      const v = value.toLowerCase();
      if (v.includes("javascript:") || v.includes("expression(") || /url\s*\(\s*['"]?\s*javascript:/i.test(value)) {
        continue;
      }
    }

    // Экранируем кавычки в значении.
    const safe = value.replace(/"/g, "&quot;");
    result.push(`${rawName}="${safe}"`);
    void tagName;
  }
  return result.length ? " " + result.join(" ") : "";
}

/**
 * Простая очистка HTML, безопасная в Cloudflare Worker (без jsdom).
 * Удаляет опасные теги и атрибуты, оставляя допустимые email-теги.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  let out = stripForbiddenBlocks(html);

  // Убираем HTML-комментарии (могут содержать conditional IE с js).
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // Перебираем все теги.
  out = out.replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawName: string, rest: string) => {
    const name = rawName.toLowerCase();
    if (FORBID_TAGS.has(name)) return "";
    if (!ALLOWED_TAGS.has(name)) return "";

    const isClosing = match.startsWith("</");
    if (isClosing) return `</${name}>`;

    const selfClosing = /\/\s*$/.test(rest);
    const attrs = sanitizeAttrs(name, rest.replace(/\/\s*$/, ""));
    return `<${name}${attrs}${selfClosing ? " /" : ""}>`;
  });

  return out;
}
