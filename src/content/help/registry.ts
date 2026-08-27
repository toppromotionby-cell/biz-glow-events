// Единый реестр справки для сотрудников.
import type { HelpArticle, HelpCategoryId } from "./types";
import { START_ARTICLES } from "./start";
import { ORDERS_ARTICLES } from "./orders";
import { QUOTES_ARTICLES } from "./quotes";
import { PAPERWORK_ARTICLES } from "./paperwork";
import { PRESENTATIONS_ARTICLES } from "./presentations";
import { CATALOG_ARTICLES } from "./catalog";
import { CLIENTS_ARTICLES } from "./clients";
import { MAIL_ARTICLES } from "./mail";
import { INFOBASE_ARTICLES } from "./infobase";
import { SETTINGS_ARTICLES } from "./settings";
import { FAQ_ARTICLES } from "./faq";

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  description: string;
  /** lucide-react icon name */
  icon: string;
};

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "start", title: "Начало работы", description: "Как устроена админка, роли, автосохранение", icon: "Compass" },
  { id: "orders", title: "Заказы", description: "Заявки, статусы, позиции, оплаты", icon: "ClipboardList" },
  { id: "quotes", title: "Коммерческие предложения", description: "КП, разделы, экономика, экспорт", icon: "FileText" },
  { id: "paperwork", title: "Документы и шаблоны", description: "Договоры, акты, счета, бренд-наборы", icon: "FileSignature" },
  { id: "presentations", title: "Презентации", description: "Слайды, фотомакеты, целостность", icon: "Presentation" },
  { id: "catalog", title: "Каталог и контент", description: "Разделы, позиции, медиа, SEO", icon: "LayoutGrid" },
  { id: "clients", title: "Клиенты и кампании", description: "Контрагенты, рассылки, промокоды", icon: "Users" },
  { id: "mail", title: "Почта и уведомления", description: "Ящики, письма, шаблоны, Telegram", icon: "Mail" },
  { id: "infobase", title: "Информационная база", description: "Подсказки при вводе и правила изоляции", icon: "Database" },
  { id: "settings", title: "Настройки", description: "Компания, НДС, пользователи, гигиена", icon: "Settings" },
  { id: "faq", title: "Частые вопросы", description: "Что делать, если что-то пошло не так", icon: "LifeBuoy" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  ...START_ARTICLES,
  ...ORDERS_ARTICLES,
  ...QUOTES_ARTICLES,
  ...PAPERWORK_ARTICLES,
  ...PRESENTATIONS_ARTICLES,
  ...CATALOG_ARTICLES,
  ...CLIENTS_ARTICLES,
  ...MAIL_ARTICLES,
  ...INFOBASE_ARTICLES,
  ...SETTINGS_ARTICLES,
  ...FAQ_ARTICLES,
];

const BY_ID = new Map(HELP_ARTICLES.map((a) => [a.id, a]));

export function getHelpArticle(id: string): HelpArticle | undefined {
  return BY_ID.get(id);
}

export function getCategory(id: HelpCategoryId): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function articlesByCategory(id: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === id);
}

/** Простой полнотекстовый поиск по заголовку, описанию и тексту блоков. */
export function searchHelp(term: string): HelpArticle[] {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];
  const score = (a: HelpArticle) => {
    const title = a.title.toLowerCase();
    if (title.includes(q)) return 3;
    if (a.summary.toLowerCase().includes(q)) return 2;
    const body = a.blocks
      .map((b) => ("text" in b ? b.text : "items" in b ? JSON.stringify(b.items) : ""))
      .join(" ")
      .toLowerCase();
    return body.includes(q) ? 1 : 0;
  };
  return HELP_ARTICLES.map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}

export const HELP_ARTICLE_COUNT = HELP_ARTICLES.length;
