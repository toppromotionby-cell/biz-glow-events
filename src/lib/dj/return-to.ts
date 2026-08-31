// Куда возвращать диджея после входа/регистрации и после одобрения заявки.
// Единая точка правды: белый список DJ-маршрутов + безопасный разбор пути.
import { safeRedirect } from "@/lib/auth-redirect";

/** Раздел по умолчанию — библиотека треков. */
export const DJ_DEFAULT_RETURN = "/dj/pool";

/** Публичные и закрытые страницы DJ-раздела, на которые допустим возврат. */
export const DJ_RETURN_ROUTES = ["/dj", "/dj/pool", "/dj/software"] as const;

export type DjReturnRoute = (typeof DJ_RETURN_ROUTES)[number];

function isAllowedPath(pathname: string): boolean {
  return (DJ_RETURN_ROUTES as readonly string[]).includes(pathname);
}

/**
 * Строит безопасный путь возврата из текущего pathname (+ query).
 * Внешние ссылки, protocol-relative и неизвестные пути отбрасываются
 * на `/dj/pool`, query-строка сохраняется (фильтры, выбранный трек).
 */
export function djReturnTo(pathname?: string | null, search?: string | null): string {
  const rawPath = typeof pathname === "string" ? pathname.trim() : "";
  const normalized = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const safe = safeRedirect(normalized);
  if (!safe || !isAllowedPath(safe)) return DJ_DEFAULT_RETURN;

  const q = typeof search === "string" ? search.trim() : "";
  if (!q || q === "?") return safe;
  const query = q.startsWith("?") ? q : `?${q}`;
  // В query недопустимы переводы строк и кавычки — режем на всякий случай.
  if (/[\s"'<>]/.test(query)) return safe;
  return `${safe}${query}`;
}

/** Ссылка для писем и Telegram: абсолютный URL на DJ-раздел. */
export function djAbsoluteUrl(path: string = DJ_DEFAULT_RETURN, origin = "https://event-hub.by"): string {
  const safe = safeRedirect(path);
  const target = safe && isAllowedPath(safe.split("?")[0] ?? "") ? safe : DJ_DEFAULT_RETURN;
  return `${origin.replace(/\/+$/, "")}${target}`;
}
