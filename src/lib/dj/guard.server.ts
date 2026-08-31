// Серверные проверки доступа к DJ-разделу. Все запросы идут через admin-клиент,
// но каждое действие сначала проходит через явный гейт членства/прав.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DjMemberStatus } from "./types";

export type DjAccess = {
  userId: string;
  status: DjMemberStatus | null;
  isManager: boolean;
  isMember: boolean;
  isTrusted: boolean;
  memberId: string | null;
  nickname: string | null;
};

export async function loadDjAccess(userId: string): Promise<DjAccess> {
  const [rolesRes, memberRes] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("dj_members").select("id, status, nickname").eq("user_id", userId).maybeSingle(),
  ]);
  const roles = (rolesRes.data ?? []).map((r) => r.role as string);
  const isManager = roles.includes("admin") || roles.includes("dj_admin");
  const status = (memberRes.data?.status ?? null) as DjMemberStatus | null;
  const blocked = status === "blocked";
  const isMember = isManager || (!blocked && (status === "approved" || status === "trusted"));
  const isTrusted = isManager || (!blocked && status === "trusted");
  return {
    userId,
    status,
    isManager,
    isMember,
    isTrusted,
    memberId: memberRes.data?.id ?? null,
    nickname: memberRes.data?.nickname ?? null,
  };
}

export async function requireMember(userId: string): Promise<DjAccess> {
  const a = await loadDjAccess(userId);
  if (!a.isMember) throw new Error("Доступ к DJ-разделу открыт только участникам клуба");
  return a;
}

export async function requireTrusted(userId: string): Promise<DjAccess> {
  const a = await loadDjAccess(userId);
  if (!a.isTrusted) throw new Error("Загрузка доступна проверенным участникам");
  return a;
}

export async function requireDjManager(userId: string): Promise<DjAccess> {
  const a = await loadDjAccess(userId);
  if (!a.isManager) throw new Error("Доступ запрещён: нужна роль администратора DJ-раздела");
  return a;
}

/** Простой антифлуд: не больше `limit` записей в таблице за `windowMin` минут. */
export async function assertRateLimit(
  table: "dj_downloads" | "dj_comments",
  userColumn: "user_id" | "author_id",
  userId: string,
  limit: number,
  windowMin: number,
): Promise<void> {
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(userColumn, userId)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    throw new Error("Слишком много действий подряд — попробуйте немного позже");
  }
}
