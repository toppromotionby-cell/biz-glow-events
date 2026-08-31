// Admin layout: доступ по правам роли (admin/manager/accountant/content_editor).
// Сайдбар сворачивается (cookie от SidebarProvider), на мобильных — off-canvas.
import { createFileRoute, Outlet, useNavigate, useLocation, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { RolesProvider, useRoles } from "@/hooks/use-roles";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminCommandPalette, CommandPaletteTrigger } from "@/components/admin/AdminCommandPalette";
import { DocumentViewerProvider } from "@/hooks/use-document-viewer";
import { CopilotContextProvider } from "@/components/copilot/copilot-context";
import { CopilotDock } from "@/components/copilot/CopilotDock";
import { HelpDrawer } from "@/components/admin/help/HelpDrawer";
import { isStaffRoles, permissionForPath, firstAllowedAdminPath, permissionsForRoles } from "@/lib/permissions";


export const Route = createFileRoute("/admin")({
  // Сессия Supabase хранится в localStorage — на сервере её нет, поэтому
  // гейт делается клиентом до рендера UI. Это убирает «вспышку» оболочки
  // админки для неавторизованных и не-staff пользователей.
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleList = (roles ?? []).map((r) => r.role as string);
    if (!isStaffRoles(roleList)) {
      throw redirect({ to: "/profile" });
    }
    // Раздел недоступен этой роли — уводим на первый доступный.
    const need = permissionForPath(location.pathname);
    const perms = permissionsForRoles(roleList);
    if (need && !perms.has(need)) {
      throw redirect({ to: firstAllowedAdminPath(perms) });
    }
  },
  head: () => ({ meta: [{ title: "Админ-панель — event-hub.by" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminLayout,
});


const CRUMBS: { match: RegExp; label: string }[] = [
  { match: /^\/admin\/?$/, label: "Дашборд" },
  { match: /^\/admin\/orders/, label: "Заявки и заказы" },
  { match: /^\/admin\/calendar/, label: "Календарь" },
  { match: /^\/admin\/catalog-structure/, label: "Структура каталога" },
  { match: /^\/admin\/catalog/, label: "Каталог" },
  { match: /^\/admin\/documents\/presentations/, label: "Презентации" },
  { match: /^\/admin\/documents\/knowledge/, label: "Информационная база" },
  { match: /^\/admin\/documents/, label: "Коммерческие предложения" },
  { match: /^\/admin\/paperwork\/templates/, label: "Шаблоны документов" },
  { match: /^\/admin\/paperwork\/type\/(payroll|staffing|timesheet)/, label: "Кадровые документы" },
  { match: /^\/admin\/paperwork/, label: "Документы компании" },
  { match: /^\/admin\/cases/, label: "Кейсы" },
  { match: /^\/admin\/testimonials/, label: "Отзывы" },
  { match: /^\/admin\/blog/, label: "Блог" },
  { match: /^\/admin\/promo/, label: "Промокоды" },
  { match: /^\/admin\/campaigns/, label: "Email-рассылки" },
  { match: /^\/admin\/mail-accounts/, label: "Почтовые ящики" },
  { match: /^\/admin\/settings\/documents/, label: "Компании и реквизиты" },
  { match: /^\/admin\/settings\/emails/, label: "Шаблоны писем" },
  { match: /^\/admin\/settings\/social/, label: "Соцсети" },
  { match: /^\/admin\/settings\/hygiene/, label: "Чистка данных" },
  { match: /^\/admin\/notifications/, label: "Уведомления" },
  { match: /^\/admin\/users/, label: "Пользователи" },
  { match: /^\/admin\/sections/, label: "Блоки на сайте" },
  { match: /^\/admin\/help/, label: "Справка" },
  { match: /^\/admin\/audit/, label: "Аудит" },
];

function AdminLayout() {
  return (
    <RolesProvider>
      <AdminLayoutContent />
    </RolesProvider>
  );
}

function AdminLayoutContent() {
  const { user, loading: authLoading } = useAuth();
  const { loading, isStaff, perms } = useRoles();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/admin" } });
      return;
    }
    if (!isStaff) {
      toast.error("Нет доступа к админ-панели");
      navigate({ to: "/profile" });
      return;
    }
    // Роль могли изменить прямо сейчас — проверяем доступ к текущему разделу.
    const need = permissionForPath(loc.pathname);
    if (need && !perms.has(need)) {
      toast.error("Раздел недоступен для вашей роли");
      navigate({ to: firstAllowedAdminPath(perms) });
    }
  }, [authLoading, loading, isStaff, user, navigate, loc.pathname, perms]);

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
      <DocumentViewerProvider>
      <CopilotContextProvider>
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
              <CommandPaletteTrigger />
              <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="Справка">
                <Link to="/admin/help">
                  <HelpCircle className="h-4 w-4" />
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
          <AdminCommandPalette />
          {/* Контекстная справка: открывается иконками «?» из любого места админки. */}
          <HelpDrawer />
          {/* ИИ-управленец: доступен только главному администратору. */}
          <CopilotDock />
        </div>
      </div>
      </CopilotContextProvider>
      </DocumentViewerProvider>
    </SidebarProvider>
  );
}
