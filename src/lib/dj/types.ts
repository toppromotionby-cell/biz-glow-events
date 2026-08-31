// Общие типы и справочники DJ-раздела. Файл client-safe: никакого серверного кода.

export type DjMemberStatus = "pending" | "approved" | "trusted" | "blocked" | "rejected";
export type DjContentStatus = "draft" | "pending" | "published" | "rejected";

export const MEMBER_STATUS_LABEL: Record<DjMemberStatus, string> = {
  pending: "Ожидает",
  approved: "Одобрен",
  trusted: "Проверенный",
  blocked: "Заблокирован",
  rejected: "Отклонён",
};

export const CONTENT_STATUS_LABEL: Record<DjContentStatus, string> = {
  draft: "Черновик",
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
};

/** Версии трека — как в мировых DJ-пулах. */
export const TRACK_VERSIONS = [
  "original",
  "extended",
  "radio",
  "clean",
  "dirty",
  "intro",
  "outro",
  "acapella",
  "instrumental",
  "remix",
  "mashup",
  "transition",
  "quick_hit",
  "segue",
] as const;
export type TrackVersion = (typeof TRACK_VERSIONS)[number];

export const TRACK_VERSION_LABEL: Record<TrackVersion, string> = {
  original: "Original",
  extended: "Extended",
  radio: "Radio Edit",
  clean: "Clean",
  dirty: "Dirty",
  intro: "Intro",
  outro: "Outro",
  acapella: "Acapella",
  instrumental: "Instrumental",
  remix: "Remix",
  mashup: "Mashup",
  transition: "Transition",
  quick_hit: "Quick Hit",
  segue: "Segue",
};

export const GENRES = [
  "House", "Deep House", "Tech House", "Techno", "Progressive", "Melodic",
  "EDM", "Future House", "Bass House", "Dance Pop", "Pop", "Hip-Hop", "R&B",
  "Latin", "Reggaeton", "Afro House", "Disco", "Funk", "Retro 80s", "Retro 90s",
  "Retro 2000s", "Chill / Lounge", "Wedding", "Corporate", "Russian Pop", "Shanson",
] as const;

export const LANGUAGES = ["Английский", "Русский", "Испанский", "Инструментал", "Другой"] as const;

/** Camelot wheel — 1A..12A / 1B..12B. */
export const CAMELOT_KEYS: string[] = Array.from({ length: 12 }, (_, i) => i + 1)
  .flatMap((n) => [`${n}A`, `${n}B`]);

export const SOFTWARE_CATEGORIES = [
  { value: "dj", label: "DJ-софт" },
  { value: "daw", label: "DAW и редакторы" },
  { value: "plugin", label: "Плагины и VST" },
  { value: "library", label: "Библиотеки и сэмплы" },
  { value: "video", label: "Видео и визуал" },
  { value: "utility", label: "Утилиты" },
] as const;

export const PLATFORMS = [
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
] as const;

export type DjTrack = {
  id: string;
  artist: string;
  title: string;
  version: string;
  genre: string | null;
  bpm: number | null;
  key_camelot: string | null;
  year: number | null;
  language: string | null;
  energy: number | null;
  duration_sec: number | null;
  tags: string[];
  artwork_url: string | null;
  section?: string | null;
  category_id?: string | null;
  cover_palette?: string | null;
  cover_spec_version?: number;
  status: DjContentStatus;
  reject_reason?: string | null;
  uploaded_by: string | null;
  play_count: number;
  download_count: number;
  rating_avg: number;
  rating_count: number;
  published_at: string | null;
  created_at: string;
  my_rating?: number | null;
  is_favorite?: boolean;
};

export type DjTrackFilters = {
  q?: string;
  /** Раздел библиотеки (music, jingles, host…). */
  section?: string;
  /** Подкатегория из dj_categories. */
  categoryId?: string;
  /** Формат мероприятия (wedding, corporate, newyear…). */
  formatSlug?: string;
  /** Мультивыбор жанров. */
  genres?: string[];
  genre?: string;
  version?: string;
  language?: string;
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
  yearMin?: number;
  yearMax?: number;
  freshDays?: number;
  favoritesOnly?: boolean;
  sort?: "new" | "rating" | "popular" | "artist" | "bpm";
  page?: number;
  pageSize?: number;
  status?: DjContentStatus | "all";
};

export const TRACK_SORTS: { value: NonNullable<DjTrackFilters["sort"]>; label: string }[] = [
  { value: "new", label: "Сначала новые" },
  { value: "rating", label: "По рейтингу" },
  { value: "popular", label: "По популярности" },
  { value: "artist", label: "По артисту" },
  { value: "bpm", label: "По BPM" },
];

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function trackFullTitle(t: Pick<DjTrack, "artist" | "title" | "version">): string {
  const v = TRACK_VERSION_LABEL[t.version as TrackVersion] ?? t.version;
  return `${t.artist} — ${t.title}${v && t.version !== "original" ? ` (${v})` : ""}`;
}

/** Соседние по Camelot тональности — гармонично сводятся. */
export function compatibleKeys(key: string | null | undefined): string[] {
  if (!key) return [];
  const m = key.match(/^(\d{1,2})([AB])$/i);
  if (!m) return [];
  const n = Number(m[1]);
  const letter = m[2]!.toUpperCase();
  const prev = ((n + 10) % 12) + 1;
  const next = (n % 12) + 1;
  const other = letter === "A" ? "B" : "A";
  return [`${prev}${letter}`, `${next}${letter}`, `${n}${other}`];
}

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff", ".aif", ".m4a"];
export const SOFTWARE_EXTENSIONS = [".zip", ".rar", ".7z", ".dmg", ".exe", ".msi", ".pkg"];
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

export function hasAllowedExtension(name: string, allowed: string[]): boolean {
  const lower = name.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}
