// Хук получения ролей текущего пользователя из user_roles.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "manager" | "marketer" | "content_editor" | "client";

const STAFF: AppRole[] = ["admin", "manager", "marketer", "content_editor"];

export function useRoles() {
  const { user, loading: authLoading } = useAuth();

  const { data: roles = [], isLoading: rolesLoading, isFetched } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
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

  const loading = authLoading || (!!user && !isFetched) || rolesLoading;

  return {
    roles,
    loading,
    has: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    isStaff: roles.some((r) => STAFF.includes(r)),
  };
}
