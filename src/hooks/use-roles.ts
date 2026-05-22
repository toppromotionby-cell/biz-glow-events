// Хук получения ролей текущего пользователя из user_roles.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "manager" | "marketer" | "content_editor" | "client";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setRoles((data ?? []).map((r: any) => r.role as AppRole));
      setLoading(false);
    });
  }, [user, authLoading]);

  return {
    roles,
    loading: loading || authLoading,
    has: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => rs.some(r => roles.includes(r)),
    isStaff: roles.some(r => ["admin", "manager", "marketer", "content_editor"].includes(r)),
  };
}
