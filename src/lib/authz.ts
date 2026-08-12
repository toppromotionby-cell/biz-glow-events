// Серверная проверка прав: читает роли пользователя и сверяет с матрицей прав.
import { permissionsForRoles, type Permission } from "@/lib/permissions";

type Ctx = {
  supabase: {
    from: (t: string) => {
      select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null; error: unknown }> };
    };
  };
  userId: string;
};

export async function getRoles(context: Ctx): Promise<string[]> {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return (data ?? []).map((r) => r.role);
}

export async function assertPermission(context: Ctx, perm: Permission): Promise<string[]> {
  const roles = await getRoles(context);
  if (!permissionsForRoles(roles).has(perm)) {
    throw new Error("Доступ запрещён: недостаточно прав");
  }
  return roles;
}

export async function hasPermission(context: Ctx, perm: Permission): Promise<boolean> {
  const roles = await getRoles(context);
  return permissionsForRoles(roles).has(perm);
}

/** Единая проверка доступа к разделу «Документы» (КП, промо, презентации). */
export async function assertDocumentsStaff(context: { supabase: unknown; userId: string }): Promise<void> {
  await assertPermission(context as never, "documents.manage");
}
