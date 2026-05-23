// Admin layout: проверка роли admin/manager/marketer/content_editor.
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRoles } from "@/hooks/use-roles";
import { useAuth } from "@/hooks/use-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админ-панель — event-hub.by" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { loading, isStaff } = useRoles();
  const navigate = useNavigate();

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

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="h-5 w-5 animate-spin mr-2" /> Проверка доступа...
      </div>
    );
  }
  if (!isStaff) return null;

  return (
    <div className="admin-shell flex">
      <AdminSidebar />
      <div className="flex-1 min-w-0 p-6"><Outlet /></div>
    </div>
  );
}
