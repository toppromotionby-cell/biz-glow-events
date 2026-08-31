// Доступ к библиотеке треков и софта. Только серверный код.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DjAccess } from "./guard.server";
import type { DjTrack, DjTrackFilters } from "./types";

const TRACK_COLUMNS =
  "id, artist, title, version, genre, bpm, key_camelot, year, language, energy, duration_sec, tags, artwork_path, status, reject_reason, uploaded_by, play_count, download_count, rating_avg, rating_count, published_at, created_at";

export const SIGNED_TTL = 60 * 60; // 1 час

export async function signPath(bucket: string, path: string | null | undefined, ttl = SIGNED_TTL): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

async function signArtworks(paths: (string | null)[]): Promise<(string | null)[]> {
  const unique = [...new Set(paths.filter(Boolean) as string[])];
  if (unique.length === 0) return paths.map(() => null);
  const { data } = await supabaseAdmin.storage.from("dj-artwork").createSignedUrls(unique, SIGNED_TTL);
  const map = new Map<string, string>();
  for (const row of data ?? []) if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

export type TrackListResult = { items: DjTrack[]; total: number; page: number; pageSize: number };

export async function listTracks(access: DjAccess, filters: DjTrackFilters): Promise<TrackListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(6, filters.pageSize ?? 24));
  const from = (page - 1) * pageSize;

  let q = supabaseAdmin.from("dj_tracks").select(TRACK_COLUMNS, { count: "exact" });

  // Модератор может смотреть любые статусы, участник — только опубликованное.
  if (access.isManager && filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  } else if (!access.isManager) {
    q = q.eq("status", "published");
  }

  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,()]/g, " ");
    q = q.or(`artist.ilike.%${term}%,title.ilike.%${term}%`);
  }
  if (filters.genre) q = q.eq("genre", filters.genre);
  if (filters.version) q = q.eq("version", filters.version);
  if (filters.language) q = q.eq("language", filters.language);
  if (filters.key) q = q.eq("key_camelot", filters.key);
  if (typeof filters.bpmMin === "number") q = q.gte("bpm", filters.bpmMin);
  if (typeof filters.bpmMax === "number") q = q.lte("bpm", filters.bpmMax);
  if (typeof filters.yearMin === "number") q = q.gte("year", filters.yearMin);
  if (typeof filters.yearMax === "number") q = q.lte("year", filters.yearMax);
  if (filters.freshDays && filters.freshDays > 0) {
    q = q.gte("created_at", new Date(Date.now() - filters.freshDays * 86_400_000).toISOString());
  }

  if (filters.favoritesOnly) {
    const { data: favs } = await supabaseAdmin.from("dj_favorites").select("track_id").eq("user_id", access.userId);
    const ids = (favs ?? []).map((f) => f.track_id);
    if (ids.length === 0) return { items: [], total: 0, page, pageSize };
    q = q.in("id", ids);
  }

  switch (filters.sort ?? "new") {
    case "rating": q = q.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false }); break;
    case "popular": q = q.order("download_count", { ascending: false }).order("play_count", { ascending: false }); break;
    case "artist": q = q.order("artist", { ascending: true }).order("title", { ascending: true }); break;
    case "bpm": q = q.order("bpm", { ascending: true, nullsFirst: false }); break;
    default: q = q.order("created_at", { ascending: false });
  }

  const { data, error, count } = await q.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as (DjTrack & { artwork_path: string | null })[];
  const art = await signArtworks(rows.map((r) => r.artwork_path));

  const ids = rows.map((r) => r.id);
  const [ratings, favorites] = ids.length
    ? await Promise.all([
        supabaseAdmin.from("dj_ratings").select("track_id, value").eq("user_id", access.userId).in("track_id", ids),
        supabaseAdmin.from("dj_favorites").select("track_id").eq("user_id", access.userId).in("track_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const myRating = new Map((ratings.data ?? []).map((r) => [r.track_id, r.value]));
  const favSet = new Set((favorites.data ?? []).map((f) => f.track_id));

  const items: DjTrack[] = rows.map((r, i) => ({
    ...r,
    tags: r.tags ?? [],
    artwork_url: art[i] ?? null,
    my_rating: myRating.get(r.id) ?? null,
    is_favorite: favSet.has(r.id),
  }));

  return { items, total: count ?? items.length, page, pageSize };
}

export async function getTrack(access: DjAccess, id: string): Promise<DjTrack | null> {
  const { data } = await supabaseAdmin.from("dj_tracks").select(TRACK_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as DjTrack & { artwork_path: string | null };
  if (!access.isManager && row.status !== "published" && row.uploaded_by !== access.userId) return null;
  const [art] = await signArtworks([row.artwork_path]);
  const [rating, fav] = await Promise.all([
    supabaseAdmin.from("dj_ratings").select("value").eq("user_id", access.userId).eq("track_id", id).maybeSingle(),
    supabaseAdmin.from("dj_favorites").select("id").eq("user_id", access.userId).eq("track_id", id).maybeSingle(),
  ]);
  return {
    ...row,
    tags: row.tags ?? [],
    artwork_url: art ?? null,
    my_rating: rating.data?.value ?? null,
    is_favorite: Boolean(fav.data),
  };
}

/** Ссылка на аудио: короткоживущая, выдаётся только участнику. */
export async function trackAudioUrl(access: DjAccess, id: string): Promise<string> {
  const { data } = await supabaseAdmin.from("dj_tracks").select("audio_path, status, uploaded_by").eq("id", id).maybeSingle();
  if (!data) throw new Error("Трек не найден");
  if (!access.isManager && data.status !== "published" && data.uploaded_by !== access.userId) {
    throw new Error("Трек недоступен");
  }
  const url = await signPath("dj-audio", data.audio_path, 60 * 30);
  if (!url) throw new Error("Файл трека недоступен");
  return url;
}

export async function bumpCounter(id: string, column: "play_count" | "download_count") {
  const { data } = await supabaseAdmin.from("dj_tracks").select(column).eq("id", id).maybeSingle();
  const current = (data as Record<string, number> | null)?.[column] ?? 0;
  const patch = column === "play_count" ? { play_count: current + 1 } : { download_count: current + 1 };
  await supabaseAdmin.from("dj_tracks").update(patch).eq("id", id);
}

export type DjSoftwareVersion = {
  id: string;
  software_id: string;
  version: string;
  release_date: string | null;
  platform: string;
  file_path: string | null;
  external_url: string | null;
  file_size: number | null;
  changelog: string | null;
  status: string;
  download_count: number;
  created_at: string;
};

export type DjSoftwareItem = {
  id: string;
  name: string;
  slug: string;
  vendor: string | null;
  category: string;
  description: string | null;
  instructions: string | null;
  platforms: string[];
  website: string | null;
  icon_url: string | null;
  status: string;
  created_at: string;
  versions: DjSoftwareVersion[];
};

export async function listSoftware(access: DjAccess, opts: { q?: string; category?: string; platform?: string }): Promise<DjSoftwareItem[]> {
  let q = supabaseAdmin.from("dj_software").select("*").order("name");
  if (!access.isManager) q = q.eq("status", "published");
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.q?.trim()) {
    const term = opts.q.trim().replace(/[%,()]/g, " ");
    q = q.or(`name.ilike.%${term}%,vendor.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const filtered = opts.platform
    ? rows.filter((r) => (r.platforms ?? []).includes(opts.platform as string))
    : rows;
  if (filtered.length === 0) return [];

  const ids = filtered.map((r) => r.id);
  let vq = supabaseAdmin.from("dj_software_versions").select("*").in("software_id", ids)
    .order("release_date", { ascending: false, nullsFirst: false });
  if (!access.isManager) vq = vq.eq("status", "published");
  const { data: versions } = await vq;

  const icons = await signArtworks(filtered.map((r) => r.icon_path));

  return filtered.map((r, i) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    vendor: r.vendor,
    category: r.category,
    description: r.description,
    instructions: r.instructions,
    platforms: r.platforms ?? [],
    website: r.website,
    icon_url: icons[i] ?? null,
    status: r.status,
    created_at: r.created_at,
    versions: ((versions ?? []).filter((v) => v.software_id === r.id) as unknown as DjSoftwareVersion[]),
  }));
}

export async function softwareDownloadUrl(access: DjAccess, versionId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("dj_software_versions").select("file_path, external_url, status").eq("id", versionId).maybeSingle();
  if (!data) throw new Error("Версия не найдена");
  if (!access.isManager && data.status !== "published") throw new Error("Версия недоступна");
  if (data.external_url) return data.external_url;
  const url = await signPath("dj-software", data.file_path, 60 * 15);
  if (!url) throw new Error("Файл недоступен");
  return url;
}
