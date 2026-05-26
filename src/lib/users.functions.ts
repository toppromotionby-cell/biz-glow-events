// Admin users management: list profiles with roles, assign/remove roles.
// Uses supabaseAdmin internally, but every handler verifies admin role first.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "manager", "content_editor", "marketer"] as const;
const RoleSchema = z.enum(ROLES);

async function assertAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Доступ запрещён: требуется роль admin");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, authRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone, company, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role);
      byUser.set(r.user_id, list);
    }

    const confirmedMap = new Map<string, string | null>();
    for (const u of authRes.data?.users ?? []) {
      confirmedMap.set(u.id, (u as any).email_confirmed_at ?? (u as any).confirmed_at ?? null);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      company: p.company,
      created_at: p.created_at,
      roles: byUser.get(p.id) ?? [],
      email_confirmed_at: confirmedMap.get(p.id) ?? null,
    }));
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    // Unique violation = role already assigned → treat as success.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    // Prevent the last admin from removing their own admin role.
    if (data.role === "admin" && data.user_id === context.userId) {
      const { count, error: cErr } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) <= 1) throw new Error("Нельзя снять роль с единственного администратора");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Нельзя удалить самого себя");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ALL_ROLES = ROLES;
