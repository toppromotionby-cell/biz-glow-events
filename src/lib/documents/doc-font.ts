// Единый источник правды по шрифту документов (КП, промо-КП, презентации).
// Значение хранится в БД: 'brand' | 'ubuntu' (в документах ещё 'inherit' —
// наследовать значение из настроек шаблонов). Модуль клиент-безопасный.

export const DOC_FONTS = ["brand", "ubuntu"] as const;
export type DocFont = (typeof DOC_FONTS)[number];

/** Значение на уровне конкретного документа: наследовать или переопределить. */
export type DocFontChoice = DocFont | "inherit";

export const DOC_FONT_LABELS: Record<DocFont, string> = {
  brand: "Фирменный (Space Grotesk / Inter)",
  ubuntu: "Ubuntu",
};

export const DOC_FONT_CHOICE_LABELS: Record<DocFontChoice, string> = {
  inherit: "Как в настройках документов",
  ...DOC_FONT_LABELS,
};

export function normalizeDocFont(v: unknown, fallback: DocFont = "brand"): DocFont {
  return (DOC_FONTS as readonly string[]).includes(String(v)) ? (v as DocFont) : fallback;
}

export function normalizeDocFontChoice(v: unknown): DocFontChoice {
  const s = String(v ?? "inherit");
  return s === "inherit" || (DOC_FONTS as readonly string[]).includes(s) ? (s as DocFontChoice) : "inherit";
}

/** Итоговый шрифт документа: переопределение документа поверх настроек. */
export function resolveDocFont(choice: unknown, fallback: unknown = "brand"): DocFont {
  const c = normalizeDocFontChoice(choice);
  return c === "inherit" ? normalizeDocFont(fallback) : c;
}

type FontStacks = { body: string; display: string };

const STACKS: Record<DocFont, FontStacks> = {
  brand: {
    body: '"Inter", system-ui, sans-serif',
    display: '"Space Grotesk", system-ui, sans-serif',
  },
  ubuntu: {
    body: '"Ubuntu", system-ui, sans-serif',
    display: '"Ubuntu", system-ui, sans-serif',
  },
};

export function fontStacks(font: DocFont): FontStacks {
  return STACKS[font];
}

/** CSS-переменные семейства для HTML-превью документа. */
export function fontCssVars(font: DocFont): string {
  const s = fontStacks(font);
  return `--font-body:${s.body}; --font-display:${s.display}`;
}

const GOOGLE_HREF: Record<DocFont, string> = {
  brand:
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
  ubuntu:
    "https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap",
};

/** <link> на веб-шрифты для standalone HTML документа. */
export function fontLinkTags(font: DocFont): string {
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `<link rel="stylesheet" href="${GOOGLE_HREF[font]}" />`,
  ].join("\n");
}

export function fontHref(font: DocFont): string {
  return GOOGLE_HREF[font];
}
