// Модерация и редактирование библиотеки DJ-раздела. Только сервер.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { removeStoredFile } from "./upload.server";
import type { DjContentStatus } from "./types";

export type TrackInput = {
  artist: string;
  title: string;
  version: string;
  genre?: string | null;
  bpm?: number | null;
  key_camelot?: string | null;
  year?: number | null;
  language?: string | null;
  energy?: number | null;
  duration_sec?: number | null;
  tags?: string[];
  audio_path: string;
  artwork_path?: string | null;
  format?: string | null;
  /** Раздел библиотеки (music, jingles, family, club…). */
  section?: string;
  /** Слаги форматов мероприятий — связь many-to-many. */
  formats?: string[];
  file_size?: number | null;
  bitrate_kbps?: number | null;
  album?: string | null;
  source_filename?: string | null;
  content_hash?: string | null;
  dedupe_key?: string | null;
  work_key?: string | null;
  cover_palette?: string | null;
  cover_spec_version?: number | null;
};

/**
 * Проверка дубликатов перед загрузкой: по SHA-256 содержимого и по
 * нормализованному ключу «артист|название|версия|длительность».
 */
export async function findExistingDuplicates(hashes: string[], keys: string[]) {
  const taken = { hashes: new Set<string>(), keys: new Set<string>() };
  if (hashes.length) {
    const { data } = await supabaseAdmin.from("dj_tracks").select("content_hash").in("content_hash", hashes);
    for (const r of data ?? []) if (r.content_hash) taken.hashes.add(r.content_hash);
  }
  if (keys.length) {
    const { data } = await supabaseAdmin.from("dj_tracks").select("dedupe_key").in("dedupe_key", keys);
    for (const r of data ?? []) if (r.dedupe_key) taken.keys.add(r.dedupe_key);
  }
  return { hashes: [...taken.hashes], keys: [...taken.keys] };
}

export async function insertTrack(userId: string, input: TrackInput, status: DjContentStatus) {
  const { data, error } = await supabaseAdmin
    .from("dj_tracks")
    .insert({
      artist: input.artist.trim(),
      title: input.title.trim(),
      version: input.version,
      genre: input.genre ?? null,
      bpm: input.bpm ?? null,
      key_camelot: input.key_camelot ?? null,
      year: input.year ?? null,
      language: input.language ?? null,
      energy: input.energy ?? null,
      duration_sec: input.duration_sec ?? null,
      tags: input.tags ?? [],
      audio_path: input.audio_path,
      artwork_path: input.artwork_path ?? null,
      format: input.format ?? null,
      ...(input.section ? { section: input.section } : {}),
      file_size: input.file_size ?? null,
      bitrate_kbps: input.bitrate_kbps ?? null,
      album: input.album ?? null,
      source_filename: input.source_filename ?? null,
      content_hash: input.content_hash ?? null,
      dedupe_key: input.dedupe_key ?? null,
      work_key: input.work_key ?? null,
      ...(input.cover_palette ? { cover_palette: input.cover_palette } : {}),
      ...(input.cover_spec_version ? { cover_spec_version: input.cover_spec_version } : {}),
      status,
      uploaded_by: userId,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = data.id as string;
  await linkTrackFormats(id, input.formats ?? []);
  return id;
}

/** Привязывает трек к форматам мероприятий по слагам. */
export async function linkTrackFormats(trackId: string, slugs: string[]) {
  if (!slugs.length) return;
  const { data: rows } = await supabaseAdmin
    .from("dj_event_formats").select("id, slug").in("slug", slugs);
  const links = (rows ?? []).map((r) => ({ track_id: trackId, format_id: r.id }));
  if (!links.length) return;
  await supabaseAdmin.from("dj_track_formats").upsert(links, { onConflict: "track_id,format_id" });
}

export async function updateTrack(id: string, patch: Partial<TrackInput>) {
  const { formats, ...columns } = patch;
  const { error } = await supabaseAdmin.from("dj_tracks").update(columns).eq("id", id);
  if (formats) await linkTrackFormats(id, formats);
  if (error) throw new Error(error.message);
}

export async function moderateTrack(id: string, status: DjContentStatus, reason?: string) {
  const { error } = await supabaseAdmin
    .from("dj_tracks")
    .update({
      status,
      reject_reason: status === "rejected" ? reason ?? null : null,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTrack(id: string) {
  const { data } = await supabaseAdmin.from("dj_tracks").select("audio_path, artwork_path").eq("id", id).maybeSingle();
  await supabaseAdmin.from("dj_tracks").delete().eq("id", id);
  await removeStoredFile("dj-audio", data?.audio_path);
  await removeStoredFile("dj-artwork", data?.artwork_path);
}

export async function pendingQueue() {
  const [tracks, software] = await Promise.all([
    supabaseAdmin.from("dj_tracks").select("id, artist, title, version, created_at, uploaded_by").eq("status", "pending").order("created_at"),
    supabaseAdmin.from("dj_software").select("id, name, vendor, created_at").eq("status", "pending").order("created_at"),
  ]);
  return {
    tracks: tracks.data ?? [],
    software: software.data ?? [],
  };
}
