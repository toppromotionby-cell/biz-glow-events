// Каталог готовых шаблонов презентаций.
//
// Шаблон = тема оформления + бренд-набор + «сценарий» слайдов (blueprint).
// Из него одним кликом собирается презентация с правильной структурой.
import { BRAND_KIT_PRESETS, type BrandKit } from "@/lib/presentations/brand-kit";
import {
  blankSlide, type PresentationSlide, type PresentationTemplate, type SlideType,
} from "@/lib/presentations/model";

export type DeckTopic =
  | "corporate" | "wedding" | "concert" | "tech" | "exhibition" | "minimal";

export const DECK_TOPIC_LABELS: Record<DeckTopic, string> = {
  corporate: "Корпоратив",
  wedding: "Свадьба",
  concert: "Концерт / шоу",
  tech: "Техника и продакшн",
  exhibition: "Выставка / стенд",
  minimal: "Универсальный минимализм",
};

export type DeckStep = { type: SlideType; variant: string; title?: string; subtitle?: string };

export type DeckTemplate = {
  id: string;
  name: string;
  description: string;
  topics: DeckTopic[];
  theme: PresentationTemplate;
  /** Бренд-набор по умолчанию (можно заменить своим). */
  brandKitId: string;
  blueprint: DeckStep[];
};

const kit = (id: string): BrandKit =>
  BRAND_KIT_PRESETS.find((k) => k.id === id) ?? BRAND_KIT_PRESETS[0];

export function deckBrandKit(t: DeckTemplate): BrandKit {
  return kit(t.brandKitId);
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: "corporate-pitch",
    name: "Корпоративное предложение",
    description: "Классическая структура для тендера и согласования с заказчиком.",
    topics: ["corporate", "minimal"],
    theme: "light",
    brandKitId: "preset-paper",
    blueprint: [
      { type: "title", variant: "classic" },
      { type: "agenda", variant: "classic", title: "Программа встречи" },
      { type: "text", variant: "classic", title: "Задача клиента" },
      { type: "section", variant: "classic", title: "Концепция" },
      { type: "gallery", variant: "classic", title: "Референсы" },
      { type: "timeline", variant: "classic", title: "Тайминг мероприятия" },
      { type: "estimate", variant: "classic", title: "Смета" },
      { type: "team", variant: "classic", title: "Команда проекта" },
      { type: "cta", variant: "classic" },
      { type: "contacts", variant: "classic" },
    ],
  },
  {
    id: "event-showcase",
    name: "Шоу-кейс мероприятия",
    description: "Фотографии крупно, минимум текста — для продажи впечатления.",
    topics: ["concert", "corporate"],
    theme: "dark",
    brandKitId: "preset-graphite",
    blueprint: [
      { type: "title", variant: "hero" },
      { type: "section", variant: "bold", title: "Атмосфера" },
      { type: "gallery", variant: "mosaic", title: "Как это выглядит" },
      { type: "stats", variant: "bold", title: "Цифры проекта" },
      { type: "gallery", variant: "bento", title: "Детали" },
      { type: "quote", variant: "classic", title: "Отзыв клиента" },
      { type: "cta", variant: "bold" },
    ],
  },
  {
    id: "wedding-story",
    name: "Свадебная история",
    description: "Тёплое оформление, акцент на эмоциях и таймлайне дня.",
    topics: ["wedding"],
    theme: "sunset",
    brandKitId: "preset-paper",
    blueprint: [
      { type: "title", variant: "hero" },
      { type: "text", variant: "classic", title: "О вашем дне" },
      { type: "gallery", variant: "mosaic", title: "Настроение" },
      { type: "timeline", variant: "classic", title: "Тайминг дня" },
      { type: "product", variant: "classic", title: "Декор и флористика" },
      { type: "estimate", variant: "classic", title: "Бюджет" },
      { type: "contacts", variant: "classic" },
    ],
  },
  {
    id: "tech-rider",
    name: "Технический райдер",
    description: "Оборудование, спецификации и смета — для продакшн-задач.",
    topics: ["tech", "exhibition"],
    theme: "night",
    brandKitId: "preset-night",
    blueprint: [
      { type: "title", variant: "classic" },
      { type: "agenda", variant: "classic", title: "Состав комплекта" },
      { type: "product", variant: "classic", title: "Звук" },
      { type: "product", variant: "classic", title: "Свет" },
      { type: "product", variant: "classic", title: "Видео" },
      { type: "compare", variant: "classic", title: "Базовый и расширенный пакет" },
      { type: "estimate", variant: "classic", title: "Смета" },
      { type: "contacts", variant: "classic" },
    ],
  },
  {
    id: "expo-stand",
    name: "Выставочный стенд",
    description: "Застройка, зонирование и логика стенда с визуалами.",
    topics: ["exhibition", "corporate"],
    theme: "emerald",
    brandKitId: "preset-emerald",
    blueprint: [
      { type: "title", variant: "classic" },
      { type: "text", variant: "classic", title: "Задача стенда" },
      { type: "gallery", variant: "bento", title: "Визуализация" },
      { type: "stats", variant: "classic", title: "Площадь и трафик" },
      { type: "timeline", variant: "classic", title: "График монтажа" },
      { type: "estimate", variant: "classic", title: "Смета застройки" },
      { type: "cta", variant: "classic" },
    ],
  },
  {
    id: "one-pager",
    name: "Короткое предложение",
    description: "5 слайдов: суть, картинка, цифры, цена, контакт.",
    topics: ["minimal", "corporate"],
    theme: "accent",
    brandKitId: "preset-signature",
    blueprint: [
      { type: "title", variant: "classic" },
      { type: "text", variant: "classic", title: "Что предлагаем" },
      { type: "gallery", variant: "classic", title: "Примеры" },
      { type: "estimate", variant: "classic", title: "Стоимость" },
      { type: "contacts", variant: "classic" },
    ],
  },
];

export function deckTemplateById(id: string): DeckTemplate | null {
  return DECK_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Разворачивает сценарий шаблона в набор слайдов-заготовок. */
export function buildDeckSlides(t: DeckTemplate): PresentationSlide[] {
  return t.blueprint.map((step, i) => {
    const slide = blankSlide(step.type, i, step.variant);
    return {
      ...slide,
      title: step.title ?? slide.title,
      subtitle: step.subtitle ?? slide.subtitle,
    };
  });
}
