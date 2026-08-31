// РОЛЬ АВТОМАТИЧЕСКОГО ПРИЁМА МАТЕРИАЛА (ingest role).
//
// Единый контракт: пользователь отдаёт только файлы. Все поля карточки трека
// вычисляются автоматически из тегов → имени файла/папки → акустики.
// Если обязательный минимум не собран — файл молча отбрасывается.
//
// Ориентир: каталоги Beatport/Traxsource и DJ-пулы (BPM Supreme, DJcity, Mixo):
// теги главнее, имя файла — резерв, спорное значение лучше не заполнять вовсе.
import type { ParsedTrack } from "./metadata";
import { dedupeKey, workKey } from "./dedupe";
import { TRACK_VERSION_LABEL, type TrackVersion } from "./types";
import { BRAND } from "./branding";

/** Пороговые правила приёмки. Меняются только здесь. */
export const INGEST_RULES = {
  minDurationSec: 5,
  maxDurationSec: 3 * 60 * 60,
  /** Ниже этого битрейта сжатый файл в библиотеку не берём. */
  minBitrateKbps: 128,
  losslessExt: /^(wav|flac|aif|aiff)$/i,
  /** Разделы, где артист не обязателен — это служебный материал. */
  anonymousSections: ["jingles", "samples", "inout", "welcome", "host"] as const,
  /** Явный мусор: рабочие файлы проектов, превью, голосовые. */
  junkName: /(^|[\s_\-.])(sample ?rate|voice ?memo|record(ing)?[ _-]?\d+|untitled ?\d*|new ?recording|temp|tmp|test)([\s_\-.]|$)/i,
};

export type IngestPayload = {
  artist: string;
  title: string;
  version: TrackVersion;
  is_remix: boolean;
  remixer: string | null;
  version_label: string;
  genre: string | null;
  bpm: number | null;
  key_camelot: string | null;
  year: number | null;
  language: string | null;
  energy: number | null;
  duration_sec: number | null;
  album: string | null;
  bitrate_kbps: number | null;
  section: string;
  formats: string[];
  tags: string[];
  format: string;
  source_filename: string;
  content_hash: string;
  dedupe_key: string;
  work_key: string;
};

export type IngestResult =
  | { accept: true; payload: IngestPayload; coverMeta: string | null }
  | { accept: false; reason: string };

function isAnonymousSection(section: string): boolean {
  return (INGEST_RULES.anonymousSections as readonly string[]).includes(section);
}

/**
 * Финальная проверка и сборка карточки. Причина отказа возвращается только
 * для внутренней телеметрии — в UI она не показывается.
 */
export function evaluateIngest(
  parsed: ParsedTrack,
  extra: { contentHash: string; energy?: number | null; bpmFallback?: number | null },
): IngestResult {
  const name = parsed.sourceFilename;

  if (INGEST_RULES.junkName.test(name)) return { accept: false, reason: "junk-name" };

  const duration = parsed.durationSec;
  if (!duration || duration < INGEST_RULES.minDurationSec || duration > INGEST_RULES.maxDurationSec) {
    return { accept: false, reason: "duration" };
  }

  const lossless = INGEST_RULES.losslessExt.test(parsed.format);
  if (!lossless && parsed.bitrateKbps !== null && parsed.bitrateKbps < INGEST_RULES.minBitrateKbps) {
    return { accept: false, reason: "bitrate" };
  }

  const title = parsed.title.trim();
  if (!title || title.toLowerCase() === "untitled") return { accept: false, reason: "no-title" };

  const section = parsed.section;
  let artist = parsed.artist.trim();
  if (!artist || artist === "Unknown Artist") {
    if (!isAnonymousSection(section)) return { accept: false, reason: "no-artist" };
    artist = BRAND;
  }

  const bpm = parsed.bpm ?? extra.bpmFallback ?? null;
  const payload: IngestPayload = {
    artist,
    title,
    version: parsed.version,
    is_remix: parsed.isRemix,
    remixer: parsed.remixer,
    version_label: parsed.versionLabel,
    genre: parsed.genre,
    bpm,
    key_camelot: parsed.key_camelot,
    year: parsed.year,
    language: parsed.language,
    energy: extra.energy ?? null,
    duration_sec: duration,
    album: parsed.album,
    bitrate_kbps: parsed.bitrateKbps,
    section,
    formats: parsed.formats,
    tags: parsed.versionRaw ? [parsed.versionRaw] : [],
    format: parsed.format,
    source_filename: name,
    content_hash: extra.contentHash,
    dedupe_key: dedupeKey({ artist, title, version: parsed.version, durationSec: duration }),
    work_key: workKey(artist, title),
  };

  const metaParts = [
    parsed.isRemix ? parsed.versionLabel : (parsed.version !== "original" ? TRACK_VERSION_LABEL[parsed.version] : null),
    bpm ? `${bpm} BPM` : null,
    parsed.key_camelot,
  ].filter(Boolean) as string[];

  return { accept: true, payload, coverMeta: metaParts.length ? metaParts.join("  ·  ") : null };
}
