// Комментарии, обсуждения, рейтинги, избранное и плейлисты DJ-клуба. Только сервер.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DjAccess } from "./guard.server";

export type DjComment = {
  id: string;
  author_id: string;
  author_name: string;
  parent_id: string | null;
  body: string;
  status: string;
  created_at: string;
};

async function nicknames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabaseAdmin.from("dj_members").select("user_id, nickname").in("user_id", unique);
  const map = new Map((data ?? []).map((m) => [m.user_id, m.nickname]));
  const missing = unique.filter((id) => !map.has(id));
  if (missing.length) {
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", missing);
    for (const p of profs ?? []) map.set(p.id, p.full_name || "Участник");
  }
  for (const id of unique) if (!map.has(id)) map.set(id, "Участник");
  return map;
}

export async function listComments(
  access: DjAccess,
  targetType: "track" | "software" | "thread",
  targetId: string,
): Promise<DjComment[]> {
  let q = supabaseAdmin
    .from("dj_comments")
    .select("id, author_id, parent_id, body, status, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (!access.isManager) q = q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const names = await nicknames(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author_name: names.get(r.author_id) ?? "Участник" }));
}

export async function addComment(
  access: DjAccess,
  input: { targetType: "track" | "software" | "thread"; targetId: string; body: string; parentId?: string | null },
): Promise<DjComment> {
  const { data, error } = await supabaseAdmin
    .from("dj_comments")
    .insert({
      author_id: access.userId,
      target_type: input.targetType,
      target_id: input.targetId,
      body: input.body.trim(),
      parent_id: input.parentId ?? null,
    })
    .select("id, author_id, parent_id, body, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, author_name: access.nickname ?? "Участник" };
}

export type DjThread = {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  locked: boolean;
  status: string;
  views: number;
  replies: number;
  created_at: string;
  updated_at: string;
};

export async function listThreads(access: DjAccess, category?: string): Promise<DjThread[]> {
  let q = supabaseAdmin
    .from("dj_threads")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!access.isManager) q = q.eq("status", "published");
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const names = await nicknames(rows.map((r) => r.author_id));
  const { data: counts } = await supabaseAdmin
    .from("dj_comments")
    .select("target_id")
    .eq("target_type", "thread")
    .eq("status", "published")
    .in("target_id", rows.length ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]);
  const replyMap = new Map<string, number>();
  for (const c of counts ?? []) replyMap.set(c.target_id, (replyMap.get(c.target_id) ?? 0) + 1);
  return rows.map((r) => ({
    ...r,
    author_name: names.get(r.author_id) ?? "Участник",
    replies: replyMap.get(r.id) ?? 0,
  })) as DjThread[];
}

export async function createThread(
  access: DjAccess,
  input: { title: string; body: string; category: string },
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("dj_threads")
    .insert({
      author_id: access.userId,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function rateTrack(access: DjAccess, trackId: string, value: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dj_ratings")
    .upsert({ track_id: trackId, user_id: access.userId, value, updated_at: new Date().toISOString() }, { onConflict: "track_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function toggleFavorite(access: DjAccess, trackId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("dj_favorites")
    .select("id")
    .eq("user_id", access.userId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (data) {
    await supabaseAdmin.from("dj_favorites").delete().eq("id", data.id);
    return false;
  }
  const { error } = await supabaseAdmin.from("dj_favorites").insert({ user_id: access.userId, track_id: trackId });
  if (error) throw new Error(error.message);
  return true;
}
