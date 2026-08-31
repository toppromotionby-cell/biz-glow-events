// Участники DJ-клуба: заявки и админ-управление. Только сервер.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DjAccess } from "./guard.server";
import type { DjMemberStatus } from "./types";

export type DjMemberRow = {
  id: string;
  user_id: string;
  nickname: string;
  city: string | null;
  bio: string | null;
  contact: string | null;
  status: DjMemberStatus;
  admin_note: string | null;
  approved_at: string | null;
  created_at: string;
  email?: string | null;
};

export async function applyForMembership(
  userId: string,
  input: { nickname: string; city?: string; bio?: string; contact?: string },
): Promise<DjMemberRow> {
  const existing = await supabaseAdmin.from("dj_members").select("*").eq("user_id", userId).maybeSingle();
  if (existing.data) {
    if (existing.data.status === "blocked") throw new Error("Доступ к DJ-разделу закрыт");
    // Повторная подача — обновляем анкету, статус не трогаем.
    const { data, error } = await supabaseAdmin
      .from("dj_members")
      .update({
        nickname: input.nickname.trim(),
        city: input.city?.trim() || null,
        bio: input.bio?.trim() || null,
        contact: input.contact?.trim() || null,
        status: existing.data.status === "rejected" ? "pending" : existing.data.status,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as DjMemberRow;
  }
  const { data, error } = await supabaseAdmin
    .from("dj_members")
    .insert({
      user_id: userId,
      nickname: input.nickname.trim(),
      city: input.city?.trim() || null,
      bio: input.bio?.trim() || null,
      contact: input.contact?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DjMemberRow;
}

export async function listMembers(status?: DjMemberStatus | "all"): Promise<DjMemberRow[]> {
  let q = supabaseAdmin.from("dj_members").select("*").order("created_at", { ascending: false }).limit(500);
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DjMemberRow[];
  if (rows.length) {
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, email").in("id", rows.map((r) => r.user_id));
    const emails = new Map((profs ?? []).map((p) => [p.id, p.email]));
    for (const r of rows) r.email = emails.get(r.user_id) ?? null;
  }
  return rows;
}

export async function setMemberStatus(
  access: DjAccess,
  id: string,
  status: DjMemberStatus,
  adminNote?: string,
): Promise<void> {
  const approved = status === "approved" || status === "trusted";
  const { error } = await supabaseAdmin
    .from("dj_members")
    .update({
      status,
      admin_note: adminNote ?? null,
      ...(approved ? { approved_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  void access;
}

export async function djStats(): Promise<{
  members: Record<string, number>;
  tracks: Record<string, number>;
  downloads7d: number;
  comments: number;
  topTracks: { id: string; artist: string; title: string; download_count: number; rating_avg: number }[];
}> {
  const [members, tracks, downloads, comments, top] = await Promise.all([
    supabaseAdmin.from("dj_members").select("status"),
    supabaseAdmin.from("dj_tracks").select("status"),
    supabaseAdmin
      .from("dj_downloads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabaseAdmin.from("dj_comments").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("dj_tracks")
      .select("id, artist, title, download_count, rating_avg")
      .eq("status", "published")
      .order("download_count", { ascending: false })
      .limit(10),
  ]);
  const tally = (rows: { status: string }[] | null) => {
    const out: Record<string, number> = {};
    for (const r of rows ?? []) out[r.status] = (out[r.status] ?? 0) + 1;
    return out;
  };
  return {
    members: tally(members.data),
    tracks: tally(tracks.data),
    downloads7d: downloads.count ?? 0,
    comments: comments.count ?? 0,
    topTracks: (top.data ?? []) as never,
  };
}
