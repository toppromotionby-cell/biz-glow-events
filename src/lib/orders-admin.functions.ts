// Admin server functions for the order detail page.
// Returns the list of users who can be assigned as order managers (admin/manager roles).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAssignableManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Caller must be admin or manager themselves to see the list.
    const { data: callerRoles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rErr) throw new Error(rErr.message);
    const allowed = (callerRoles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager"]);
    if (roleErr) throw new Error(roleErr.message);

    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [] as Array<{ id: string; name: string; email: string | null }>;

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);

    return (profiles ?? [])
      .map((p) => ({
        id: p.id,
        name: (p.full_name && p.full_name.trim()) || p.email || p.id.slice(0, 8),
        email: p.email,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  });
