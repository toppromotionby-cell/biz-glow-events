// Глобальная система переключателей секций сайта.
// Админ может включать/выключать любые блоки. Отключённый блок скрыт
// для обычных посетителей, а админам показан полупрозрачным с бейджем.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { cn } from "@/lib/utils";
import { EyeOff } from "lucide-react";

// Реестр всех управляемых секций. Добавляйте сюда новые ключи —
// они автоматически появятся в админ-панели.
export const SECTION_REGISTRY = [
  { key: "home.hero", label: "Главная: Hero-блок", group: "Главная" },
  { key: "home.directions", label: "Главная: Направления", group: "Главная" },
  { key: "home.featured", label: "Главная: Из каталога", group: "Главная" },
  { key: "home.values", label: "Главная: Ценности", group: "Главная" },
  { key: "home.cases", label: "Главная: Кейсы", group: "Главная" },
  { key: "home.estimator", label: "Главная: Калькулятор гостей", group: "Главная" },
  { key: "home.testimonials", label: "Главная: Отзывы", group: "Главная" },
  { key: "home.blog", label: "Главная: Блог", group: "Главная" },
  { key: "home.cta", label: "Главная: CTA-блок", group: "Главная" },
  { key: "header.search", label: "Шапка: Поиск", group: "Шапка" },
  { key: "header.wishlist", label: "Шапка: Избранное", group: "Шапка" },
  { key: "header.compare", label: "Шапка: Сравнение", group: "Шапка" },
  { key: "header.cart", label: "Шапка: Корзина", group: "Шапка" },
  { key: "header.register", label: "Шапка: Кнопка регистрации", group: "Шапка" },
  { key: "footer.newsletter", label: "Подвал: Рассылка", group: "Подвал" },
  { key: "footer.info", label: "Подвал: Блок «Информация»", group: "Подвал" },
  { key: "footer.contacts", label: "Подвал: Контакты", group: "Подвал" },
  { key: "global.cookies", label: "Глобально: Cookie-баннер", group: "Глобально" },
] as const;

export type SectionKey = (typeof SECTION_REGISTRY)[number]["key"];

type SectionsMap = Record<string, boolean>;

const SectionsCtx = createContext<SectionsMap>({});

export function SiteSectionsProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<SectionsMap>({});

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
    })();

    const ch = supabase
      .channel("site_sections_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_sections" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { key: string; enabled?: boolean } | null;
          if (!row?.key) return;
          setMap((prev) => ({ ...prev, [row.key]: payload.eventType === "DELETE" ? true : !!row.enabled }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
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
  const { has } = useRoles();
  const isAdmin = has("admin");

  if (!enabled && !isAdmin) return null;

  const label = useMemo(
    () => SECTION_REGISTRY.find((s) => s.key === sectionKey)?.label ?? sectionKey,
    [sectionKey],
  );

  if (enabled) {
    return <Tag className={className}>{children}</Tag>;
  }

  // Админ видит выключенный блок с пометкой.
  return (
    <Tag
      className={cn("relative opacity-40 pointer-events-none select-none", className)}
      data-admin-hidden
      aria-label={`Скрыто: ${label}`}
    >
      <div className="pointer-events-auto absolute top-2 right-2 z-30 inline-flex items-center gap-1 rounded-full bg-destructive/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground shadow-lg">
        <EyeOff className="h-3 w-3" /> Скрыто для посетителей
      </div>
      {children}
    </Tag>
  );
}
