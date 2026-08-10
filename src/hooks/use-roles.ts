// Хук ролей и прав текущего пользователя.
// Роли не кешируются надолго и обновляются в реальном времени: при смене роли
// администратором права применяются без перезагрузки страницы.
import { createContext, useContext, useEffect, useId, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  permissionsForRoles,
  isStaffRoles,
  type AppRole,
  type Permission,
} from "@/lib/permissions";

export type { AppRole, Permission };

type RolesContextValue = {
  roles: AppRole[];
  perms: Set<Permission>;
  loading: boolean;
  has: (role: AppRole) => boolean;
  hasAny: (roles: AppRole[]) => boolean;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  isStaff: boolean;
};

const RolesContext = createContext<RolesContextValue | null>(null);

export function RolesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const { data: roles = [], isLoading: rolesLoading, isFetched } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<AppRole[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) {
        console.error("[useRoles] fetch error", error);
        throw error;
      }
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  // Realtime: любая правка ролей текущего пользователя сразу пересчитывает доступ.
  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`user-roles-${user.id}-${instanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: ["user-roles", user.id] });
            void router.invalidate();
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            void queryClient.invalidateQueries({ queryKey: ["user-roles", user.id] });
          }
        });
    } catch (error) {
      // Realtime ускоряет применение роли, но не должен блокировать админку.
      console.warn("[useRoles] realtime unavailable; using query refresh", error);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user, queryClient, router, instanceId]);

  const perms = useMemo(() => permissionsForRoles(roles), [roles]);
  const loading = authLoading || (!!user && !isFetched) || rolesLoading;

  const value = useMemo<RolesContextValue>(() => ({
    roles,
    perms,
    loading,
    has: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    can: (p: Permission) => perms.has(p),
    canAny: (ps: Permission[]) => ps.some((p) => perms.has(p)),
    isStaff: isStaffRoles(roles),
  }), [roles, perms, loading]);

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export function useRoles() {
  const value = useContext(RolesContext);
  if (!value) throw new Error("useRoles must be used inside RolesProvider");
  return value;
}
