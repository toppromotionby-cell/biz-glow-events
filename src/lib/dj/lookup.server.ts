// Сверка треков с бесплатными музыкальными каталогами. Только сервер.
//
// Источники (без ключей и без регистрации):
//   1. Deezer  — https://api.deezer.com/search  (быстрый, каноничные названия)
//   2. MusicBrainz — https://musicbrainz.org/ws/2/recording (открытая база,
//      знает связи «оригинал ↔ ремикс»)
//
// Ответы кэшируются в public.dj_lookup_cache, чтобы не упираться в лимиты
// (MusicBrainz — 1 запрос в секунду, поэтому запросы идут последовательно).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CatalogMatch } from "./version-detect";
import { normalizeText } from "./dedupe";

const UA = "event-hub.by DJ Hub/1.0 (https://event-hub.by)";
const TIMEOUT_MS = 6000;

function queryKey(artist: string, title: string): string {
  return `${normalizeText(artist)}|${normalizeText(title)}`.slice(0, 300);
}

async function readCache(provider: string, key: string): Promise<CatalogMatch | null | undefined> {
  const { data } = await supabaseAdmin
    .from("dj_lookup_cache")
    .select("response, expires_at")
    .eq("provider", provider)
    .eq("query_key", key)
    .maybeSingle();
  if (!data) return undefined;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return undefined;
  return (data.response as CatalogMatch | null) ?? null;
}

async function writeCache(provider: string, key: string, value: CatalogMatch | null) {
  await supabaseAdmin
    .from("dj_lookup_cache")
    .upsert(
      { provider, query_key: key, response: value as unknown as Record<string, unknown> | null },
      { onConflict: "provider,query_key" },
    );
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Насколько ответ каталога похож на наш трек. */
function similar(a: string, b: string): boolean {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

async function deezerLookup(artist: string, title: string): Promise<CatalogMatch | null> {
  const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  const json = (await getJson(`https://api.deezer.com/search?q=${q}&limit=5`)) as
    | { data?: { title?: string; title_short?: string; duration?: number; artist?: { name?: string } }[] }
    | null;
  const items = json?.data ?? [];
  for (const it of items) {
    const full = String(it.title ?? "");
    const name = String(it.artist?.name ?? "");
    if (!full || !name) continue;
    if (!similar(name, artist)) continue;
    if (!similar(it.title_short ?? full, title)) continue;
    return {
      artist: name,
      title: String(it.title_short ?? full),
      fullTitle: full,
      durationSec: typeof it.duration === "number" ? it.duration : null,
      provider: "deezer",
    };
  }
  return null;
}

async function musicbrainzLookup(artist: string, title: string): Promise<CatalogMatch | null> {
  const q = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`);
  const json = (await getJson(
    `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=5`,
  )) as
    | { recordings?: { title?: string; length?: number; "artist-credit"?: { name?: string }[] }[] }
    | null;
  for (const rec of json?.recordings ?? []) {
    const full = String(rec.title ?? "");
    const name = rec["artist-credit"]?.map((c) => c.name).filter(Boolean).join(", ") ?? "";
    if (!full || !name) continue;
    if (!similar(name, artist)) continue;
    return {
      artist: name,
      title: full.replace(/\s*[([].*$/, "").trim() || full,
      fullTitle: full,
      durationSec: typeof rec.length === "number" ? Math.round(rec.length / 1000) : null,
      provider: "musicbrainz",
    };
  }
  return null;
}

/**
 * Каскад: кэш → Deezer → MusicBrainz. `null` означает «каталог не знает трек»
 * и тоже кэшируется, чтобы не долбить сервисы одинаковыми запросами.
 */
export async function lookupCatalog(artist: string, title: string): Promise<CatalogMatch | null> {
  const clean = { artist: artist.trim(), title: title.trim() };
  if (!clean.artist || !clean.title || clean.artist.toLowerCase() === "unknown artist") return null;
  const key = queryKey(clean.artist, clean.title);

  const cached = await readCache("catalog", key);
  if (cached !== undefined) return cached;

  let match = await deezerLookup(clean.artist, clean.title);
  if (!match) match = await musicbrainzLookup(clean.artist, clean.title);

  await writeCache("catalog", key, match);
  return match;
}

/** Ищет в нашей библиотеке оригинал того же произведения. */
export async function findOriginalTrackId(workKeyValue: string, excludeId?: string): Promise<string | null> {
  if (!workKeyValue) return null;
  let q = supabaseAdmin
    .from("dj_tracks")
    .select("id")
    .eq("work_key", workKeyValue)
    .eq("is_remix", false)
    .limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return data?.[0]?.id ?? null;
}
