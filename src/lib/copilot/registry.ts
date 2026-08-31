// Реестр инструментов помощника: единый источник правды для модели, UI и тестов.
// Клиентобезопасный модуль — здесь только описания, без обращения к базе.
import type { CopilotModule, CopilotRisk } from "@/lib/copilot/types";

export interface ToolArg {
  type: "string" | "number" | "boolean" | "string[]" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface CopilotToolMeta {
  name: string;
  module: CopilotModule;
  title: string;
  description: string;
  risk: CopilotRisk;
  /** true — инструмент готовит изменения (нужны превью и утверждение). */
  writes: boolean;
  args: Record<string, ToolArg>;
}

/** Таблицы каталога, доступные помощнику. */
export const CATALOG_TABLES = ["zones", "services", "tech_equipment", "production_items", "attractions"] as const;
export type CatalogTable = (typeof CATALOG_TABLES)[number];

export const CATALOG_TABLE_LABEL: Record<CatalogTable, string> = {
  zones: "Фотозоны",
  services: "Услуги",
  tech_equipment: "Техника",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

/** Таблицы контента сайта. */
export const CONTENT_TABLES = ["blog_posts", "cases", "testimonials"] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

export const CONTENT_TABLE_LABEL: Record<ContentTable, string> = {
  blog_posts: "Блог",
  cases: "Кейсы",
  testimonials: "Отзывы",
};

export const ORDER_STATUSES = [
  "new",
  "consultation",
  "estimate",
  "quoted",
  "contract",
  "confirmed",
  "in_progress",
  "paid",
  "completed",
  "cancelled",
] as const;

const T = <const T extends Record<string, CopilotToolMeta>>(x: T) => x;

export const TOOLS = T({
  /* ------------------------------- чтение ------------------------------- */
  search_records: {
    name: "search_records",
    module: "analytics",
    title: "Найти записи",
    description:
      "Поиск записей по названию/номеру в каталоге, контенте, заявках и документах. Возвращает id, названия и ключевые поля.",
    risk: "read",
    writes: false,
    args: {
      table: {
        type: "string",
        description: "Таблица для поиска",
        required: true,
        enum: [...CATALOG_TABLES, ...CONTENT_TABLES, "orders", "quotes", "promo_quotes", "email_templates"],
      },
      query: { type: "string", description: "Строка поиска (может быть пустой — вернёт последние записи)" },
      limit: { type: "number", description: "Сколько записей вернуть, по умолчанию 20" },
    },
  },
  read_record: {
    name: "read_record",
    module: "analytics",
    title: "Прочитать запись",
    description: "Полное содержимое одной записи по таблице и id.",
    risk: "read",
    writes: false,
    args: {
      table: { type: "string", description: "Таблица", required: true },
      id: { type: "string", description: "id записи", required: true },
    },
  },
  analytics_summary: {
    name: "analytics_summary",
    module: "analytics",
    title: "Сводка по бизнесу",
    description: "Количество заявок по статусам, суммы, свежие заявки за период. Для отчётов и вопросов «как дела».",
    risk: "read",
    writes: false,
    args: { days: { type: "number", description: "За сколько последних дней, по умолчанию 30" } },
  },
  hygiene_scan: {
    name: "hygiene_scan",
    module: "hygiene",
    title: "Проверка качества данных",
    description:
      "Ищет проблемы: позиции каталога без фото, без цены, без описания, скрытые записи, заявки без менеджера, дубли названий.",
    risk: "read",
    writes: false,
    args: {},
  },
  files_find: {
    name: "files_find",
    module: "files",
    title: "Найти файлы",
    description: "Поиск файлов в хранилищах проекта по названию. Возвращает путь, размер и временную ссылку.",
    risk: "read",
    writes: false,
    args: {
      query: { type: "string", description: "Часть имени файла" },
      bucket: { type: "string", description: "Хранилище: catalog-media, order-attachments, paperwork-archive, media" },
      limit: { type: "number", description: "Сколько файлов вернуть, по умолчанию 20" },
    },
  },
  knowledge_search: {
    name: "knowledge_search",
    module: "knowledge",
    title: "Поиск в базе знаний",
    description: "Ищет ранее сохранённые факты компании в Информационной базе.",
    risk: "read",
    writes: false,
    args: { query: { type: "string", description: "Тема или ключевое слово" } },
  },
  web_search: {
    name: "web_search",
    module: "web",
    title: "Поиск в интернете",
    description: "Свободный поиск в интернете для идей, цен, фактов. Всегда указывай источники.",
    risk: "read",
    writes: false,
    args: { query: { type: "string", description: "Поисковый запрос", required: true } },
  },

  /* ------------------------------ изменения ------------------------------ */
  catalog_update: {
    name: "catalog_update",
    module: "catalog",
    title: "Изменить позиции каталога",
    description:
      "Меняет поля позиций каталога: название, описание, категорию, SEO-поля, публикацию. Работает по списку id.",
    risk: "write",
    writes: true,
    args: {
      table: { type: "string", description: "Таблица каталога", required: true, enum: [...CATALOG_TABLES] },
      ids: { type: "string[]", description: "id позиций", required: true },
      title: { type: "string", description: "Новое название" },
      description: { type: "string", description: "Новое описание" },
      category: { type: "string", description: "Новая категория" },
      seo_title: { type: "string", description: "SEO-заголовок" },
      seo_description: { type: "string", description: "SEO-описание" },
      published: { type: "boolean", description: "Публикация на сайте" },
    },
  },
  catalog_price_adjust: {
    name: "catalog_price_adjust",
    module: "catalog",
    title: "Пересчитать цены каталога",
    description:
      "Меняет цену «от» у позиций: процентом (percent: 7 = +7%, -5 = -5%) или установкой конкретного значения (set).",
    risk: "write",
    writes: true,
    args: {
      table: { type: "string", description: "Таблица каталога", required: true, enum: [...CATALOG_TABLES] },
      ids: { type: "string[]", description: "id позиций; если не заданы — применяется ко всей категории" },
      category: { type: "string", description: "Категория, если меняем целиком" },
      percent: { type: "number", description: "Процент изменения цены" },
      set: { type: "number", description: "Установить цену «от» этим значением" },
      round: { type: "number", description: "Округлять до кратного, например 10" },
    },
  },
  content_update: {
    name: "content_update",
    module: "content",
    title: "Изменить контент сайта",
    description: "Меняет записи блога, кейсов и отзывов: заголовок, текст, публикацию, признак «избранное».",
    risk: "write",
    writes: true,
    args: {
      table: { type: "string", description: "Таблица контента", required: true, enum: [...CONTENT_TABLES] },
      ids: { type: "string[]", description: "id записей", required: true },
      title: { type: "string", description: "Заголовок (блог, кейсы)" },
      excerpt: { type: "string", description: "Краткое описание (блог)" },
      summary: { type: "string", description: "Краткое описание (кейсы)" },
      text: { type: "string", description: "Текст отзыва" },
      seo_title: { type: "string", description: "SEO-заголовок" },
      seo_description: { type: "string", description: "SEO-описание" },
      published: { type: "boolean", description: "Публикация" },
      featured: { type: "boolean", description: "Избранное" },
    },
  },
  section_update: {
    name: "section_update",
    module: "content",
    title: "Изменить раздел каталога",
    description: "Меняет заголовок, описание, видимость и порядок разделов каталога.",
    risk: "write",
    writes: true,
    args: {
      key: { type: "string", description: "Ключ раздела", required: true },
      title: { type: "string", description: "Заголовок" },
      description: { type: "string", description: "Описание" },
      visible: { type: "boolean", description: "Показывать на сайте" },
      sort_order: { type: "number", description: "Порядок" },
    },
  },
  order_update: {
    name: "order_update",
    module: "orders",
    title: "Изменить заявку",
    description: "Меняет статус, сумму, дату мероприятия и контакты заявки.",
    risk: "write",
    writes: true,
    args: {
      ids: { type: "string[]", description: "id заявок", required: true },
      status: { type: "string", description: "Новый статус", enum: [...ORDER_STATUSES] },
      total: { type: "number", description: "Сумма заявки" },
      paid: { type: "number", description: "Оплачено" },
      event_date: { type: "string", description: "Дата мероприятия в формате ГГГГ-ММ-ДД" },
      notes: { type: "string", description: "Публичные заметки заявки" },
    },
  },
  order_note_add: {
    name: "order_note_add",
    module: "orders",
    title: "Внутренняя заметка к заявке",
    description: "Добавляет внутреннюю заметку к заявке (клиент её не видит).",
    risk: "draft",
    writes: true,
    args: {
      orderId: { type: "string", description: "id заявки", required: true },
      note: { type: "string", description: "Текст заметки", required: true },
    },
  },
  mail_template_update: {
    name: "mail_template_update",
    module: "mail",
    title: "Изменить шаблон письма",
    description: "Меняет тему, прехедер, HTML-тело и включение шаблона письма.",
    risk: "write",
    writes: true,
    args: {
      template_key: { type: "string", description: "Ключ шаблона", required: true },
      subject: { type: "string", description: "Тема письма" },
      preheader: { type: "string", description: "Прехедер" },
      html_body: { type: "string", description: "HTML-тело" },
      enabled: { type: "boolean", description: "Включён" },
    },
  },
  campaign_upsert: {
    name: "campaign_upsert",
    module: "mail",
    title: "Кампания рассылки",
    description: "Создаёт или меняет маркетинговую кампанию: название, источник, бюджет, даты, активность.",
    risk: "write",
    writes: true,
    args: {
      id: { type: "string", description: "id кампании; пусто — создать новую" },
      name: { type: "string", description: "Название" },
      source: { type: "string", description: "Источник/канал" },
      budget: { type: "number", description: "Бюджет" },
      start_date: { type: "string", description: "Дата старта ГГГГ-ММ-ДД" },
      end_date: { type: "string", description: "Дата окончания ГГГГ-ММ-ДД" },
      active: { type: "boolean", description: "Активна" },
    },
  },
  knowledge_add: {
    name: "knowledge_add",
    module: "knowledge",
    title: "Записать факт в базу знаний",
    description: "Сохраняет факт компании в Информационную базу — им пользуются сотрудники и боты.",
    risk: "draft",
    writes: true,
    args: {
      subject: { type: "string", description: "Тема факта", required: true },
      fact: { type: "string", description: "Сам факт", required: true },
      tags: { type: "string[]", description: "Метки" },
    },
  },
  knowledge_archive: {
    name: "knowledge_archive",
    module: "knowledge",
    title: "Убрать факт из базы знаний",
    description: "Переводит устаревший факт в архив.",
    risk: "write",
    writes: true,
    args: { id: { type: "string", description: "id факта", required: true } },
  },
  catalog_delete: {
    name: "catalog_delete",
    module: "catalog",
    title: "Удалить позиции каталога",
    description: "Полное удаление позиций каталога. Используй только по прямой просьбе — обычно достаточно снять с публикации.",
    risk: "destructive",
    writes: true,
    args: {
      table: { type: "string", description: "Таблица каталога", required: true, enum: [...CATALOG_TABLES] },
      ids: { type: "string[]", description: "id позиций", required: true },
    },
  },
});

export type ToolName = keyof typeof TOOLS;

export const TOOL_LIST: CopilotToolMeta[] = Object.values(TOOLS);

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(TOOLS, name);
}

export function toolMeta(name: string): CopilotToolMeta | null {
  return isToolName(name) ? TOOLS[name] : null;
}

function jsonType(t: ToolArg["type"]): Record<string, unknown> {
  switch (t) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "string[]":
      return { type: "array", items: { type: "string" } };
    case "object":
      return { type: "object" };
    default:
      return { type: "string" };
  }
}

/** Схемы инструментов для OpenAI-совместимого вызова функций. */
export function toolSchemas(allowed?: readonly string[]): unknown[] {
  return TOOL_LIST.filter((t) => !allowed || allowed.includes(t.name)).map((t) => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, arg] of Object.entries(t.args)) {
      properties[key] = { ...jsonType(arg.type), description: arg.description, ...(arg.enum ? { enum: arg.enum } : {}) };
      if (arg.required) required.push(key);
    }
    return {
      type: "function",
      function: {
        name: t.name,
        description: `${t.title}. ${t.description}`,
        parameters: { type: "object", properties, required },
      },
    };
  });
}
