// Типы контента раздела «Справка для сотрудников».
// Контент — данные, а не разметка: один рендерер отвечает за внешний вид.

export type HelpCategoryId =
  | "start"
  | "orders"
  | "quotes"
  | "paperwork"
  | "presentations"
  | "catalog"
  | "clients"
  | "mail"
  | "infobase"
  | "settings"
  | "faq";

export type HelpBlock =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "steps"; items: string[] }
  | { t: "list"; items: string[] }
  | { t: "note"; tone: "info" | "tip" | "warn"; text: string }
  | { t: "example"; title?: string; text: string }
  | { t: "image"; src: string; alt: string; caption?: string }
  | { t: "faq"; items: { q: string; a: string }[] };

export type HelpArticle = {
  /** Стабильный id = slug статьи, на него ссылаются иконки «?». */
  id: string;
  title: string;
  summary: string;
  category: HelpCategoryId;
  tags?: string[];
  related?: string[];
  blocks: HelpBlock[];
};

/** Компактное описание статьи — из него собирается единая структура блоков. */
export type ArticleSpec = {
  id: string;
  title: string;
  summary: string;
  /** Зачем это нужно: 1–2 абзаца. */
  why: string[];
  /** Пошаговая инструкция. */
  steps?: string[];
  /** Что важно знать / нюансы. */
  facts?: string[];
  tips?: string[];
  warns?: string[];
  examples?: { title?: string; text: string }[];
  faq?: { q: string; a: string }[];
  image?: { src: string; alt: string; caption?: string };
  tags?: string[];
  related?: string[];
};

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=70";

/** Собирает статью по единому шаблону: зачем → шаги → нюансы → примеры → FAQ. */
export function buildArticle(category: HelpCategoryId, spec: ArticleSpec): HelpArticle {
  const blocks: HelpBlock[] = [];

  for (const text of spec.why) blocks.push({ t: "p", text });

  blocks.push({
    t: "image",
    src: spec.image?.src ?? PLACEHOLDER,
    alt: spec.image?.alt ?? spec.title,
    caption: spec.image?.caption ?? "Место для скриншота раздела",
  });

  if (spec.steps?.length) {
    blocks.push({ t: "h", text: "Пошагово" });
    blocks.push({ t: "steps", items: spec.steps });
  }

  if (spec.facts?.length) {
    blocks.push({ t: "h", text: "Что важно знать" });
    blocks.push({ t: "list", items: spec.facts });
  }

  for (const text of spec.tips ?? []) blocks.push({ t: "note", tone: "tip", text });
  for (const text of spec.warns ?? []) blocks.push({ t: "note", tone: "warn", text });

  if (spec.examples?.length) {
    blocks.push({ t: "h", text: "Примеры" });
    for (const ex of spec.examples) blocks.push({ t: "example", title: ex.title, text: ex.text });
  }

  if (spec.faq?.length) {
    blocks.push({ t: "h", text: "Частые вопросы" });
    blocks.push({ t: "faq", items: spec.faq });
  }

  return {
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    category,
    tags: spec.tags,
    related: spec.related,
    blocks,
  };
}
