// Хук ролей и прав текущего пользователя.
// Роли не кешируются надолго и обновляются в реальном времени: при смене роли
// администратором права применяются без перезагрузки страницы.
import { useEffect, useMemo } from "react";
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

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

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
    const channel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-roles", user.id] });
          router.invalidate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, router]);

  const perms = useMemo(() => permissionsForRoles(roles), [roles]);
  const loading = authLoading || (!!user && !isFetched) || rolesLoading;

  return {
    roles,
    perms,
    loading,
    has: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    can: (p: Permission) => perms.has(p),
    canAny: (ps: Permission[]) => ps.some((p) => perms.has(p)),
    isStaff: isStaffRoles(roles),
  };
}
