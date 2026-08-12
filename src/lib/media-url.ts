// Единая точка получения ссылки на медиа каталога.
//
// Каталог публичный: все фото и видео лежат в бакете `catalog-media`, который
// отдаётся по постоянным публичным URL. Никаких подписанных ссылок, TTL и
// кэшей — ссылка детерминирована по пути файла и одинаково строится в браузере
// и на сервере (SSR, PDF-рендер).
export const MEDIA_BUCKET = "catalog-media";

export function isAbsoluteMediaUrl(src: string): boolean {
  return /^(https?:|blob:|data:)/i.test(src);
}

function baseUrl(): string {
  const fromVite =
    typeof import.meta !== "undefined" ? (import.meta.env?.VITE_SUPABASE_URL as string | undefined) : undefined;
  const fromNode = typeof process !== "undefined" ? process.env?.["SUPABASE_URL"] : undefined;
  return (fromVite || fromNode || "").replace(/\/+$/, "");
}

/** Путь в хранилище → публичный URL. Абсолютные ссылки возвращаются как есть. */
export function mediaPublicUrl(path: string): string {
  if (!path) return "";
  if (isAbsoluteMediaUrl(path)) return path;
  const clean = path.replace(/^\/+/, "");
  return `${baseUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/${clean
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Массив путей → публичные ссылки (порядок сохраняется). */
export function mediaPublicUrls(paths: (string | null | undefined)[]): string[] {
  return paths.filter(Boolean).map((p) => mediaPublicUrl(p as string));
}
