// Разбор метаданных аудиофайла: ID3 + имя файла. Работает в браузере.
import type { TrackVersion } from "./types";
import { stripBrand } from "./branding";
import { guessSection, guessFormats, type DjSectionKey } from "./sections";

export type ParsedTrack = {
  artist: string;
  title: string;
  version: TrackVersion;
  versionRaw: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  bpm: number | null;
  key_camelot: string | null;
  language: string | null;
  durationSec: number | null;
  bitrateKbps: number | null;
  format: string;
  section: DjSectionKey;
  picture: { data: Uint8Array; mime: string } | null;
  sourceFilename: string;
};

const VERSION_PATTERNS: [RegExp, TrackVersion][] = [
  [/extended|ext\.? ?mix|long ?version/i, "extended"],
  [/radio ?(edit|mix|version)/i, "radio"],
  [/\bclean\b/i, "clean"],
  [/\bdirty\b|explicit/i, "dirty"],
  [/\bintro\b|starter/i, "intro"],
  [/\boutro\b|ending/i, "outro"],
  [/acapella|a ?capella|vocal only/i, "acapella"],
  [/instrumental|\binstr\b|minus/i, "instrumental"],
  [/mash ?up/i, "mashup"],
  [/transition|trans\b/i, "transition"],
  [/quick ?hit|short ?edit/i, "quick_hit"],
  [/segue/i, "segue"],
  [/remix|rmx|\bmix\b|bootleg|rework|edit\b/i, "remix"],
];

const CAMELOT_RE = /\b(1[0-2]|[1-9])\s?([ABab])\b/;
const MUSICAL_TO_CAMELOT: Record<string, string> = {
  "Abm": "1A", "G#m": "1A", "Ebm": "2A", "D#m": "2A", "Bbm": "3A", "A#m": "3A",
  "Fm": "4A", "Cm": "5A", "Gm": "6A", "Dm": "7A", "Am": "8A", "Em": "9A",
  "Bm": "10A", "F#m": "11A", "Gbm": "11A", "Dbm": "12A", "C#m": "12A",
  "B": "1B", "F#": "2B", "Gb": "2B", "Db": "3B", "C#": "3B", "Ab": "4B", "G#": "4B",
  "Eb": "5B", "D#": "5B", "Bb": "6B", "A#": "6B", "F": "7B", "C": "8B", "G": "9B",
  "D": "10B", "A": "11B", "E": "12B",
};

export function toCamelot(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const direct = s.match(CAMELOT_RE);
  if (direct) return `${direct[1]}${direct[2]!.toUpperCase()}`;
  const norm = s.replace(/\s*(minor|min)\s*$/i, "m").replace(/\s*(major|maj)\s*$/i, "").replace(/\s+/g, "");
  const key = Object.keys(MUSICAL_TO_CAMELOT).find((k) => k.toLowerCase() === norm.toLowerCase());
  return key ? MUSICAL_TO_CAMELOT[key]! : null;
}

export function detectVersion(source: string): { version: TrackVersion; raw: string | null } {
  const brackets = [...source.matchAll(/[([]([^)\]]{2,60})[)\]]/g)].map((m) => m[1]!.trim());
  for (const chunk of brackets) {
    for (const [re, v] of VERSION_PATTERNS) if (re.test(chunk)) return { version: v, raw: chunk };
  }
  for (const [re, v] of VERSION_PATTERNS) {
    if (re.test(source)) return { version: v, raw: null };
  }
  return { version: "original", raw: null };
}

/** Чистим название от служебных скобок (BPM, ключ, бренд, качество). */
function cleanTitle(value: string): string {
  return stripBrand(value)
    .replace(/[([]\s*\d{2,3}\s*(bpm)?\s*(1[0-2]|[1-9])?[ABab]?\s*[)\]]/gi, " ")
    .replace(/[([]\s*(320|256|192)\s*k?bps?\s*[)\]]/gi, " ")
    .replace(/\s*[-–]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Разбор `Artist - Title (Extended Mix) [128 5A]`. */
export function parseFileName(fileName: string): { artist: string; title: string } {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ");
  const withoutIndex = base.replace(/^\s*\d{1,3}\s*[.\-)]\s*/, "");
  const parts = withoutIndex.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: cleanTitle(parts[0]!), title: cleanTitle(parts.slice(1).join(" - ")) };
  }
  return { artist: "", title: cleanTitle(withoutIndex) };
}

function detectLanguage(text: string): string | null {
  if (/[а-яё]/i.test(text)) return "Русский";
  if (/[a-z]/i.test(text)) return "Английский";
  return null;
}

function pickBpm(...values: (number | string | null | undefined)[]): number | null {
  for (const v of values) {
    const n = typeof v === "string" ? Number.parseFloat(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n >= 40 && n <= 300) return Math.round(n);
  }
  return null;
}

/** Полный разбор файла: ID3-теги + имя файла + путь папки. */
export async function parseAudioFile(file: File): Promise<ParsedTrack> {
  const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const format = (file.name.split(".").pop() ?? "mp3").toLowerCase();

  let common: Record<string, unknown> = {};
  let fmt: Record<string, unknown> = {};
  let native: { id: string; value: unknown }[] = [];
  try {
    const mm = await import("music-metadata");
    const parsed = await mm.parseBlob(file, { duration: true });
    common = parsed.common as unknown as Record<string, unknown>;
    fmt = parsed.format as unknown as Record<string, unknown>;
    native = Object.values(parsed.native ?? {}).flat() as { id: string; value: unknown }[];
  } catch {
    // Файл без тегов или нечитаемый контейнер — работаем по имени файла.
  }

  const fromName = parseFileName(file.name);
  const artist = stripBrand(
    String((common['artist'] as string) || (common['albumartist'] as string) || fromName.artist || "").trim(),
  ) || fromName.artist || "Unknown Artist";
  const rawTitle = String((common['title'] as string) || fromName.title || file.name);
  const title = cleanTitle(rawTitle) || fromName.title || "Untitled";

  const versionSource = `${rawTitle} ${file.name}`;
  const ver = detectVersion(versionSource);

  const nativeKey = native.find((t) => /INITIALKEY|TKEY|KEY/i.test(t.id))?.value;
  const nativeBpm = native.find((t) => /BPM|TBPM/i.test(t.id))?.value;
  const nameBpm = file.name.match(/\b(\d{2,3})\s*bpm\b/i)?.[1]
    ?? file.name.match(/[[(]\s*(\d{2,3})\s+(?:1[0-2]|[1-9])[ABab]\s*[)\]]/)?.[1];

  const durationSec = typeof fmt['duration'] === "number" ? Math.round(fmt['duration'] as number) : null;
  const bitrate = typeof fmt['bitrate'] === "number" ? Math.round((fmt['bitrate'] as number) / 1000) : null;

  const pics = common['picture'] as { data: Uint8Array; format: string }[] | undefined;
  const picture = pics && pics[0]
    ? { data: new Uint8Array(pics[0].data), mime: pics[0].format || "image/jpeg" }
    : null;

  const genreList = common['genre'] as string[] | undefined;

  return {
    artist,
    title,
    version: ver.version,
    versionRaw: ver.raw,
    album: (common['album'] as string) ?? null,
    genre: genreList?.[0] ?? null,
    year: typeof common['year'] === "number" ? (common['year'] as number) : null,
    bpm: pickBpm(nativeBpm as string, common['bpm'] as number, nameBpm),
    key_camelot: toCamelot((nativeKey as string) ?? (common['key'] as string) ?? file.name.match(/[[(][^)\]]*\b((?:1[0-2]|[1-9])[ABab])\b[^)\]]*[)\]]/)?.[1]),
    language: detectLanguage(`${artist} ${title}`),
    durationSec,
    bitrateKbps: bitrate,
    format,
    section: guessSection(relPath, durationSec),
    formats: guessFormats(`${relPath} ${artist} ${title}`),
    picture,
    sourceFilename: file.name,
  };
}
