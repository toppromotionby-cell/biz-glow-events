import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Calendar, Package, Wrench, Sparkles, Hammer, FileText, Megaphone, Newspaper, UserCog, Trophy, MessageSquareQuote, CalendarClock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Заказы (CRM)", icon: ShoppingCart },
  { to: "/admin/calendar", label: "Календарь", icon: Calendar },
  { to: "/admin/availability", label: "Занятость", icon: CalendarClock },
  { to: "/admin/catalog/zones", label: "Зоны", icon: Sparkles },
  { to: "/admin/catalog/tech_equipment", label: "Оборудование", icon: Wrench },
  { to: "/admin/catalog/services", label: "Услуги", icon: Package },
  { to: "/admin/catalog/production_items", label: "Производство", icon: Hammer },
  { to: "/admin/cases", label: "Кейсы", icon: Trophy },
  { to: "/admin/testimonials", label: "Отзывы", icon: MessageSquareQuote },
  { to: "/admin/blog", label: "Блог", icon: Newspaper },
  { to: "/admin/marketing", label: "Маркетинг", icon: Megaphone },
  { to: "/admin/newsletter", label: "Рассылка", icon: Mail },
  { to: "/admin/users", label: "Пользователи", icon: UserCog },
  { to: "/admin/audit", label: "Аудит", icon: FileText },
];

export function AdminSidebar() {
  const loc = useLocation();
  return (
    <aside className="w-64 shrink-0 glass-strong border-r border-border/50 min-h-[calc(100vh-4rem)] p-4">
      <nav className="space-y-1">
        {NAV.map(n => {
          const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active ? "bg-gradient-primary glow-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
