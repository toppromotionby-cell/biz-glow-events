// Глобальная система переключателей секций сайта.
// Админ может включать/выключать любые блоки. Отключённый блок скрыт
// для обычных посетителей, а админам показан полупрозрачным с бейджем.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Реестр всех управляемых секций. Добавляйте сюда новые ключи —
// они автоматически появятся в админ-панели.
export const SECTION_REGISTRY = [
  // Главная
  { key: "home.hero", label: "Главная: Hero-блок", group: "Главная" },
  { key: "home.directions", label: "Главная: Направления", group: "Главная" },
  { key: "home.featured", label: "Главная: Из каталога", group: "Главная" },
  { key: "home.values", label: "Главная: Ценности", group: "Главная" },
  { key: "home.cases", label: "Главная: Кейсы", group: "Главная" },
  { key: "home.estimator", label: "Главная: Калькулятор гостей", group: "Главная" },
  { key: "home.testimonials", label: "Главная: Отзывы", group: "Главная" },
  { key: "home.blog", label: "Главная: Блог", group: "Главная" },
  { key: "home.cta", label: "Главная: CTA-блок", group: "Главная" },

  // Шапка
  { key: "header.root", label: "Шапка: Вся шапка", group: "Шапка" },
  { key: "header.brand", label: "Шапка: Логотип/название", group: "Шапка" },
  { key: "header.nav", label: "Шапка: Навигация (целиком)", group: "Шапка" },
  { key: "header.nav.zones", label: "Шапка: Пункт «Зоны»", group: "Шапка" },
  { key: "header.nav.equipment", label: "Шапка: Пункт «Оборудование»", group: "Шапка" },
  { key: "header.nav.services", label: "Шапка: Пункт «Услуги»", group: "Шапка" },
  { key: "header.nav.production", label: "Шапка: Пункт «Производство»", group: "Шапка" },
  { key: "header.nav.attractions", label: "Шапка: Пункт «Аттракционы»", group: "Шапка" },
  { key: "header.nav.cases", label: "Шапка: Пункт «Кейсы»", group: "Шапка" },
  { key: "header.nav.industries", label: "Шапка: Пункт «Индустрии»", group: "Шапка" },
  { key: "header.nav.testimonials", label: "Шапка: Пункт «Отзывы»", group: "Шапка" },
  { key: "header.nav.blog", label: "Шапка: Пункт «Блог»", group: "Шапка" },
  { key: "header.nav.about", label: "Шапка: Пункт «О нас»", group: "Шапка" },
  { key: "header.nav.contacts", label: "Шапка: Пункт «Контакты»", group: "Шапка" },
  { key: "header.search", label: "Шапка: Поиск", group: "Шапка" },
  
  { key: "header.cart", label: "Шапка: Корзина", group: "Шапка" },
  { key: "header.account", label: "Шапка: Кабинет (для авторизованных)", group: "Шапка" },
  { key: "header.logout", label: "Шапка: Кнопка «Выйти»", group: "Шапка" },
  { key: "header.login", label: "Шапка: Кнопка «Войти»", group: "Шапка" },
  { key: "header.register", label: "Шапка: Кнопка регистрации", group: "Шапка" },

  // Подвал
  { key: "footer.root", label: "Подвал: Весь подвал", group: "Подвал" },
  { key: "footer.brand", label: "Подвал: Брендовый блок", group: "Подвал" },
  { key: "footer.catalog", label: "Подвал: Блок «Каталог»", group: "Подвал" },
  { key: "footer.catalog.zones", label: "Подвал → Каталог: «Интерактивные Зоны»", group: "Подвал" },
  { key: "footer.catalog.equipment", label: "Подвал → Каталог: «Техническое оснащение»", group: "Подвал" },
  { key: "footer.catalog.services", label: "Подвал → Каталог: «Услуги»", group: "Подвал" },
  { key: "footer.catalog.production", label: "Подвал → Каталог: «Производство»", group: "Подвал" },
  { key: "footer.catalog.attractions", label: "Подвал → Каталог: «Аттракционы»", group: "Подвал" },
  { key: "footer.catalog.cases", label: "Подвал → Каталог: «Кейсы»", group: "Подвал" },
  { key: "footer.catalog.industries", label: "Подвал → Каталог: «Индустрии»", group: "Подвал" },
  { key: "footer.catalog.testimonials", label: "Подвал → Каталог: «Отзывы»", group: "Подвал" },
  { key: "footer.catalog.blog", label: "Подвал → Каталог: «Блог»", group: "Подвал" },
  { key: "footer.catalog.about", label: "Подвал → Каталог: «О нас»", group: "Подвал" },
  { key: "footer.catalog.contacts_link", label: "Подвал → Каталог: «Контакты»", group: "Подвал" },
  { key: "footer.info", label: "Подвал: Блок «Информация»", group: "Подвал" },
  { key: "footer.info.partners", label: "Подвал → Информация: «Агентствам»", group: "Подвал" },
  { key: "footer.info.delivery", label: "Подвал → Информация: «Доставка и оплата»", group: "Подвал" },
  { key: "footer.info.faq", label: "Подвал → Информация: «Частые вопросы»", group: "Подвал" },
  { key: "footer.info.terms", label: "Подвал → Информация: «Условия аренды»", group: "Подвал" },
  { key: "footer.info.privacy", label: "Подвал → Информация: «Политика конфиденциальности»", group: "Подвал" },
  { key: "footer.info.cookies", label: "Подвал → Информация: «Политика cookies»", group: "Подвал" },
  { key: "footer.info.offer", label: "Подвал → Информация: «Публичная оферта»", group: "Подвал" },
  { key: "footer.contacts", label: "Подвал: Блок «Контакты»", group: "Подвал" },
  { key: "footer.contacts.address", label: "Подвал → Контакты: Адрес", group: "Подвал" },
  { key: "footer.contacts.phone", label: "Подвал → Контакты: Телефон", group: "Подвал" },
  { key: "footer.contacts.telegram", label: "Подвал → Контакты: Telegram", group: "Подвал" },
  { key: "footer.contacts.email", label: "Подвал → Контакты: E-mail", group: "Подвал" },
  
  { key: "footer.copyright", label: "Подвал: Копирайт", group: "Подвал" },

  // Глобально
  { key: "global.cookies", label: "Глобально: Cookie-баннер", group: "Глобально" },
  
  { key: "global.floating_contacts", label: "Глобально: Плавающий онлайн-помощник", group: "Глобально" },

  // Карточки каталога
  { key: "catalog.video", label: "Карточки: Блок «Видео» целиком", group: "Карточки каталога" },
  { key: "catalog.video.external", label: "Карточки: Видео со сторонних ресурсов (YouTube и др.)", group: "Карточки каталога" },
  { key: "catalog.video.uploaded", label: "Карточки: Загруженные видео-файлы", group: "Карточки каталога" },

] as const;

export type SectionKey = (typeof SECTION_REGISTRY)[number]["key"];

type SectionsMap = Record<string, boolean>;

const SectionsCtx = createContext<SectionsMap>({});

const SECTIONS_CACHE_KEY = "site-sections-v1";

function readCache(): SectionsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SECTIONS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SectionsMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: SectionsMap) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify(map)); } catch { /* quota */ }
}

export function SiteSectionsProvider({ children }: { children: ReactNode }) {
  // ВАЖНО: стартовое значение обязано совпадать с SSR ({}), иначе React
  // ругается на hydration mismatch (сервер отрисовал одни пункты меню,
  // клиент — другие). Кэш из localStorage применяем сразу после гидратации.
  const [map, setMap] = useState<SectionsMap>({});

  useEffect(() => {
    const cached = readCache();
    if (Object.keys(cached).length) setMap(cached);
  }, []);

  useEffect(() => {

    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("site_sections").select("key, enabled");
      if (cancelled) return;
      const next: SectionsMap = {};
      (data ?? []).forEach((r: { key: string; enabled: boolean }) => {
        next[r.key] = r.enabled;
      });
      setMap(next);
      writeCache(next);
    })();

    // Realtime-подписку откладываем на простой браузера: на проде она не нужна
    // для первого экрана и съедает JS-время старта.
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const start = () => {
      if (cancelled) return;
      ch = supabase
        .channel("site_sections_rt")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "site_sections" },
          (payload) => {
            const row = (payload.new ?? payload.old) as { key: string; enabled?: boolean } | null;
            if (!row?.key) return;
            setMap((prev) => {
              const upd = { ...prev, [row.key]: payload.eventType === "DELETE" ? true : !!row.enabled };
              writeCache(upd);
              return upd;
            });
          },
        )
        .subscribe();
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(start, { timeout: 3000 })
      : window.setTimeout(start, 1500);

    return () => {
      cancelled = true;
      if (typeof handle === "number") {
        const cw = window as unknown as { cancelIdleCallback?: (h: number) => void };
        cw.cancelIdleCallback ? cw.cancelIdleCallback(handle) : clearTimeout(handle);
      }
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  return <SectionsCtx.Provider value={map}>{children}</SectionsCtx.Provider>;
}

export function useSectionEnabled(key: SectionKey | string): boolean {
  const map = useContext(SectionsCtx);
  // По умолчанию (нет записи в БД) — включено.
  return map[key] !== false;
}

/**
 * Обёртка для управляемой секции.
 * — Для обычных посетителей: если выключено, ничего не рендерится.
 * — Для админов: всегда рендерится, при выключении — полупрозрачно с бейджем.
 */
export function Toggleable({
  sectionKey,
  children,
  className,
  as: Tag = "div",
}: {
  sectionKey: SectionKey | string;
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "span" | "li";
}) {
  const enabled = useSectionEnabled(sectionKey);
  if (!enabled) return null;
  return <Tag className={className}>{children}</Tag>;
}
