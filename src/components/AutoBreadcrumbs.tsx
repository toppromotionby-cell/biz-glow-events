// Auto-breadcrumbs from pathname. Hidden on home and admin/auth pages.
import { useRouterState } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const SEGMENT_LABELS: Record<string, string> = {
  zones: "Интерактивные зоны",
  equipment: "Оборудование",
  services: "Услуги",
  production: "Производство",
  cases: "Кейсы",

  blog: "Блог",
  about: "О нас",
  contacts: "Контакты",
  testimonials: "Отзывы",
  industries: "Индустрии",
  faq: "FAQ",
  partners: "Партнёрам",
  delivery: "Доставка и оплата",
  privacy: "Конфиденциальность",
  offer: "Оферта",
  "terms-rental": "Условия аренды",
  cart: "Корзина",
  
  profile: "Кабинет",
  login: "Вход",
  register: "Регистрация",
  catalog: "Каталог",
  unsubscribe: "Отписка",
};

const HIDDEN_PREFIXES = ["/admin", "/lovable", "/api", "/email", "/order"];

export function AutoBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!pathname || pathname === "/" || pathname === "") return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const items = parts.map((seg, i) => {
    const isLast = i === parts.length - 1;
    const labelFromMap = SEGMENT_LABELS[seg];
    const decoded = decodeURIComponent(seg).replace(/-/g, " ");
    const label = labelFromMap ?? decoded.charAt(0).toUpperCase() + decoded.slice(1);
    return {
      label,
      to: isLast ? undefined : "/" + parts.slice(0, i + 1).join("/"),
    };
  });

  return (
    <div className="page-shell pt-3">
      <Breadcrumbs items={items} />
    </div>
  );
}
