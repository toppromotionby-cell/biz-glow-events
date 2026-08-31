// Дедупликация треков. Чистые функции — работают и в браузере, и на сервере.
import { stripBrand } from "./branding";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

const NOISE = [
  /official\s*(music\s*)?video/g,
  /lyrics?\s*video/g,
  /audio\s*only/g,
  /\bhq\b/g, /\bhd\b/g, /\b320\s*kbps\b/g, /\bfree\s*download\b/g,
  /\bexplicit\b/g, /\bofficial\b/g, /\bpromo\b/g,
];

/** Нормализация строки: регистр, транслит, мусор, пунктуация. */
export function normalizeText(value: string): string {
  let s = stripBrand(value).toLowerCase();
  s = s.replace(/ё/g, "е");
  for (const re of NOISE) s = s.replace(re, " ");
  s = s.replace(/\b(feat\.?|ft\.?|featuring|prod\.?|with)\b/g, " ");
  s = s.replace(/[\u2018\u2019\u201c\u201d`'"]/g, "");
  s = s.split("").map((ch) => TRANSLIT[ch] ?? ch).join("");
  s = s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}

/** Ключ «одной песни» — без версии: артист + название. */
export function workKey(artist: string, title: string): string {
  return `${normalizeText(artist)}|${normalizeText(title)}`;
}

/**
 * Ключ дубликата: артист + название + версия + длительность,
 * округлённая до 5 секунд (перекодировки дают расхождение ±2 с).
 */
export function dedupeKey(input: {
  artist: string;
  title: string;
  version?: string | null;
  durationSec?: number | null;
}): string {
  const bucket = input.durationSec && input.durationSec > 0
    ? Math.round(input.durationSec / 5)
    : 0;
  return `${workKey(input.artist, input.title)}|${normalizeText(input.version ?? "original") || "original"}|${bucket}`;
}

/** SHA-256 файла (WebCrypto — доступен и в браузере, и в воркере). */
export async function hashFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Оценка «качества» файла — чтобы предложить замену лучшей версией. */
export function qualityScore(input: {
  format?: string | null;
  bitrateKbps?: number | null;
  durationSec?: number | null;
  fileSize?: number | null;
}): number {
  const lossless = /wav|flac|aif/i.test(input.format ?? "");
  const bitrate = input.bitrateKbps ?? (lossless ? 1411 : 128);
  return (lossless ? 100_000 : 0) + bitrate * 10 + Math.round((input.fileSize ?? 0) / 1_000_000);
}
