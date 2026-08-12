// Общий кэш подписанных ссылок на приватный бакет `media`.
// Один и тот же файл встречается в списках, слайдах и превью десятки раз —
// без кэша каждый монтаж компонента заново дёргает storage API.
import { supabase } from "@/integrations/supabase/client";

/** Единый TTL для всех подписанных ссылок в приложении. */
export const MEDIA_URL_TTL_SECONDS = 3600;
/** Обновляем ссылку заранее, чтобы она не протухла прямо во время показа. */
const REFRESH_MARGIN_MS = 120_000;

type Entry = { url: string; expiresAt: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

export function isAbsoluteMediaUrl(src: string): boolean {
  return /^(https?:|blob:|data:)/i.test(src);
}

/** Подписанная ссылка с кэшированием; `null`, если файл недоступен. */
export async function signedMediaUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (isAbsoluteMediaUrl(path)) return path;

  const hit = cache.get(path);
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.url;

  const pending = inflight.get(path);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await supabase.storage
      .from("media")
      .createSignedUrl(path, MEDIA_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      if (import.meta.env.DEV) console.error("createSignedUrl failed:", error);
      return null;
    }
    cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + MEDIA_URL_TTL_SECONDS * 1000 });
    return data.signedUrl;
  })().finally(() => inflight.delete(path));

  inflight.set(path, task);
  return task;
}
