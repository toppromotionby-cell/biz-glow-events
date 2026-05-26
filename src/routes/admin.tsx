// Admin layout: проверка роли admin/manager/marketer/content_editor.
// Сайдбар сворачивается (cookie от SidebarProvider), на мобильных — off-canvas.
import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useRoles } from "@/hooks/use-roles";
import { useAuth } from "@/hooks/use-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminCommandPalette, CommandPaletteTrigger } from "@/components/admin/AdminCommandPalette";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админ-панель — event-hub.by" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminLayout,
});

const CRUMBS: { match: RegExp; label: string }[] = [
  { match: /^\/admin\/?$/, label: "Дашборд" },
  { match: /^\/admin\/orders/, label: "Заказы" },
  { match: /^\/admin\/calendar/, label: "Календарь" },
  { match: /^\/admin\/availability/, label: "Занятость" },
  { match: /^\/admin\/catalog/, label: "Наполнение" },
  { match: /^\/admin\/cases/, label: "Кейсы" },
  { match: /^\/admin\/testimonials/, label: "Отзывы" },
  { match: /^\/admin\/blog/, label: "Блог" },
  { match: /^\/admin\/marketing/, label: "Маркетинг" },
  { match: /^\/admin\/promo/, label: "Промокоды" },
  { match: /^\/admin\/campaigns/, label: "Email-рассылки" },
  
  
  { match: /^\/admin\/users/, label: "Пользователи" },
  { match: /^\/admin\/sections/, label: "Видимость секций" },
  { match: /^\/admin\/audit/, label: "Аудит" },
];

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { loading, isStaff } = useRoles();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/admin" } as any });
      return;
    }
    if (!isStaff) {
      toast.error("Нет доступа к админ-панели");
      navigate({ to: "/profile" });
    }
  }, [authLoading, loading, isStaff, user, navigate]);

  const crumb = useMemo(
    () => CRUMBS.find((c) => c.match.test(loc.pathname))?.label ?? "Админ-панель",
    [loc.pathname],
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="h-5 w-5 animate-spin mr-2" /> Проверка доступа...
      </div>
    );
  }
  if (!isStaff) return null;

  return (
    <SidebarProvider>
      <div className="admin-shell flex w-full min-h-screen">
        <AdminSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/40 bg-background/80 backdrop-blur-md px-3 md:px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="h-5 w-px bg-border/60 mx-1" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="text-muted-foreground hidden sm:inline">Админ</span>
              <span className="text-muted-foreground hidden sm:inline">/</span>
              <span className="font-medium truncate">{crumb}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
