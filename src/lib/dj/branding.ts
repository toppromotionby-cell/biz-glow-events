// Единые правила брендирования event-hub.by. Client-safe.

export const BRAND = "event-hub.by";
export const BRAND_URL = "https://event-hub.by/dj";
export const BRAND_TAG = `[${BRAND}]`;

/** Убирает ранее наклеенный бренд, чтобы не плодить суффиксы. */
export function stripBrand(value: string): string {
  return value
    .replace(/\[?\s*event-?hub\.by\s*\]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 150);
}

/** `Artist - Title (Version) [event-hub.by].mp3` */
export function brandedTrackFileName(input: {
  artist: string;
  title: string;
  versionLabel?: string | null;
  ext: string;
}): string {
  const artist = sanitizeFileName(stripBrand(input.artist)) || "Unknown";
  const title = sanitizeFileName(stripBrand(input.title)) || "Untitled";
  const version = input.versionLabel && input.versionLabel.toLowerCase() !== "original"
    ? ` (${sanitizeFileName(stripBrand(input.versionLabel))})`
    : "";
  const ext = input.ext.startsWith(".") ? input.ext : `.${input.ext}`;
  return `${artist} - ${title}${version} ${BRAND_TAG}${ext.toLowerCase()}`;
}

/** `Product 2024.1.3 (Windows) [event-hub.by].zip` */
export function brandedSoftwareFileName(input: {
  name: string;
  version?: string | null;
  platform?: string | null;
  ext: string;
}): string {
  const name = sanitizeFileName(stripBrand(input.name)) || "Software";
  const version = input.version ? ` ${sanitizeFileName(input.version)}` : "";
  const platform = input.platform ? ` (${sanitizeFileName(input.platform)})` : "";
  const ext = input.ext.startsWith(".") ? input.ext : `.${input.ext}`;
  return `${name}${version}${platform} ${BRAND_TAG}${ext.toLowerCase()}`;
}

/** ID3-поля, в которые вшивается источник (артист/название не трогаем). */
export function brandedId3Fields(input: { artist: string; title: string; year?: number | null }) {
  return {
    comment: { description: "Source", text: `${BRAND} — DJ Hub` },
    publisher: BRAND,
    url: BRAND_URL,
    albumArtist: BRAND,
    copyright: `${BRAND}`,
  };
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}
