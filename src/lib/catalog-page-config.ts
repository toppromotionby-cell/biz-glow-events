// Конфигурация страниц каталога: тексты H1/lead/meta и описание под JSON-LD.
// Один источник истины для 4 типов (zones / tech_equipment / services / production_items).
import type { CatalogType } from "@/lib/catalog.functions";
import type { CatalogItem } from "@/lib/catalog-mock";
import { ZONES, EQUIPMENT, SERVICES, PRODUCTION } from "@/lib/catalog-mock";

export type CatalogBasePath = "/zones" | "/equipment" | "/services" | "/production";
export type CatalogCategoryKey = "zones" | "equipment" | "services" | "production";

export interface CatalogPageConfig {
  /** Тип в таблице БД и в server-functions каталога. */
  type: CatalogType;
  /** URL списка (тот же, что routeId роута). */
  basePath: CatalogBasePath;
  /** Ключ для группировки/фильтрации в `<CatalogGrid />`. */
  category: CatalogCategoryKey;
  /** Подпись «назад к списку» на странице карточки. */
  backLabel: string;
  /** Заголовок страницы списка (H1). */
  h1: string;
  /** Лид-абзац под H1. */
  lead: string;
  /** Имя коллекции для ItemList JSON-LD. */
  collectionName: string;
  /** Полный URL списка для JSON-LD/canonical. */
  pageUrl: string;
  /** SEO-meta списка. */
  list: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  /** SEO-meta карточки. Принимают сам item; если seo_* пусто — собираем по шаблону. */
  detail: {
    fallbackTitle: string; // когда item не загружен
    notFoundTitle: string; // h1 на странице 404
    jsonLdLabel: string;   // baseLabel для productJsonLd
    buildTitle: (it: { title: string; seo_title?: string | null }) => string;
    buildDescription: (it: {
      title: string;
      seo_description?: string | null;
      short_description?: string | null;
    }) => string;
  };
  /** Демо-данные, если БД пуста. */
  fallback: CatalogItem[];
}

const SITE = "https://event-hub.by";

/** Единый SEO-шаблон для всех карточек каталога. Ручной override через `seo_title`. */
export const buildDefaultTitle = (title: string) =>
  `${title} в Минске — Аренда и прокат на мероприятие`;

/** Единый SEO-шаблон для description. Ручной override через `seo_description`. */
export const buildDefaultDescription = (title: string) =>
  `Закажите ${title} в Минске и Беларуси на выгодных условиях. Техническое обеспечение и организация мероприятий от Event Hub. Цены, фото, подбор за 15 минут!`;


export const CATALOG_PAGE_CONFIG: Record<CatalogBasePath, CatalogPageConfig> = {
  "/zones": {
    type: "zones",
    basePath: "/zones",
    category: "zones",
    backLabel: "Все зоны",
    h1: "Интерактивные зоны для мероприятий в Минске",
    lead: "VR-арены, фотозоны 360°, AR-зеркала и тематические лаунжи под ключ.",
    collectionName: "Интерактивные зоны для мероприятий в Минске",
    pageUrl: `${SITE}/zones`,
    list: {
      title: "Интерактивные зоны для мероприятий — event-hub.by",
      description: "VR/AR, фотозоны 360°, AR-зеркала, неоновые лаунж-зоны. Аренда в Минске и по Беларуси.",
      ogTitle: "Интерактивные зоны — event-hub.by",
      ogDescription: "Каталог интерактивных зон для event-мероприятий.",
    },
    detail: {
      fallbackTitle: "Зона — event-hub.by",
      notFoundTitle: "Зона не найдена",
      jsonLdLabel: "Интерактивные зоны",
      buildTitle: (it) => it.seo_title ?? buildDefaultTitle(it.title),
      buildDescription: (it) => it.seo_description ?? buildDefaultDescription(it.title),
    },
    fallback: ZONES,

  },
  "/equipment": {
    type: "tech_equipment",
    basePath: "/equipment",
    category: "equipment",
    backLabel: "Всё оборудование",
    h1: "Аренда event-оборудования в Минске",
    lead: "Звук, свет, видео и проекционный маппинг — комплекты под формат вашего мероприятия.",
    collectionName: "Аренда event-оборудования в Минске",
    pageUrl: `${SITE}/equipment`,
    list: {
      title: "Аренда event-оборудования в Минске — event-hub.by",
      description: "LED-экраны, звук, свет, проекционный маппинг. Аренда и монтаж под мероприятие.",
      ogTitle: "Оборудование — event-hub.by",
      ogDescription: "Профессиональное event-оборудование в аренду.",
    },
    detail: {
      fallbackTitle: "Оборудование — event-hub.by",
      notFoundTitle: "Позиция не найдена",
      jsonLdLabel: "Оборудование",
      buildTitle: (it) => it.seo_title ?? buildDefaultTitle(it.title),
      buildDescription: (it) => it.seo_description ?? buildDefaultDescription(it.title),
    },

    fallback: EQUIPMENT,
  },
  "/services": {
    type: "services",
    basePath: "/services",
    category: "services",
    backLabel: "Все услуги",
    h1: "Event-услуги в Минске и по Беларуси",
    lead: "От креатива и продакшна до промо и трансляций.",
    collectionName: "Event-услуги в Минске и по Беларуси",
    pageUrl: `${SITE}/services`,
    list: {
      title: "Event-услуги в Беларуси — event-hub.by",
      description: "Продакшн под ключ, BTL, онлайн-трансляции, букинг артистов.",
      ogTitle: "Услуги — event-hub.by",
      ogDescription: "Комплексные event-услуги от event-hub.by.",
    },
    detail: {
      fallbackTitle: "Услуга — event-hub.by",
      notFoundTitle: "Услуга не найдена",
      jsonLdLabel: "Услуги",
      buildTitle: (it) => it.seo_title ?? buildDefaultTitle(it.title),
      buildDescription: (it) => it.seo_description ?? buildDefaultDescription(it.title),
    },

    fallback: SERVICES,
  },
  "/production": {
    type: "production_items",
    basePath: "/production",
    category: "production",
    backLabel: "Всё производство",
    h1: "Производство декораций и конструкций в Минске",
    lead: "Декорации, фотозоны, сцены и печать. От эскиза до монтажа на площадке.",
    collectionName: "Производство декораций и конструкций для мероприятий",
    pageUrl: `${SITE}/production`,
    list: {
      title: "Производство декораций и конструкций — event-hub.by",
      description: "Фотостены, арки, сцены, реквизит, печать. Производство под ключ в Минске.",
      ogTitle: "Производство — event-hub.by",
      ogDescription: "Event-производство: декор, конструкции, печать.",
    },
    detail: {
      fallbackTitle: "Производство — event-hub.by",
      notFoundTitle: "Позиция не найдена",
      jsonLdLabel: "Производство",
      buildTitle: (it) => it.seo_title ?? `${it.title} — производство в Минске | event-hub.by`,
      buildDescription: (it) =>
        it.seo_description ??
        it.short_description ??
        `Изготовление «${it.title}» под мероприятие в Минске. Сроки и доставка от event-hub.by.`,
    },
    fallback: PRODUCTION,
  },
};
