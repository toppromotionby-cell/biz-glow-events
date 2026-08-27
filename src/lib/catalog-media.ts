// Хелперы каталога вынесены из *.functions.ts: файлы с createServerFn должны
// оставаться тонкими обёртками (иначе сплиттинг удаляет рантайм-соседей).
import { mediaPublicUrl } from "@/lib/media-url";

/** Максимум фото в списочной выдаче — карточка показывает слайдер из первых кадров. */
export const LIST_PHOTO_LIMIT = 4;

/** Каталог публичный: пути хранилища превращаются в постоянные публичные ссылки. */
export function signMediaUrls<T extends { photo_urls?: string[] | null; video_urls?: string[] | null }>(
  rows: T[],
  photoLimit?: number,
): T[] {
  return rows.map((r) => {
    const photos = (r.photo_urls ?? []).map((u) => (u ? mediaPublicUrl(u) : u));
    const videos = (r.video_urls ?? []).map((u) => (u ? mediaPublicUrl(u) : u));
    return {
      ...r,
      photo_urls: photoLimit ? photos.slice(0, photoLimit) : photos,
      video_urls: photoLimit ? videos.slice(0, 1) : videos,
    };
  });
}

/** Полный набор полей — для карточки товара. */
export const CATALOG_SELECT_FULL =
  "id,slug,title,description,photo_urls,video_urls,pricing,features,extras,faq,requirements,seo_title,seo_description,category";

/** Облегчённый набор для списков: без faq/extras/requirements/seo — их не показывают в сетке. */
export const CATALOG_SELECT_LIST = "id,slug,title,description,photo_urls,video_urls,pricing,category";

/** Защита от неограниченной выдачи, если каталог сильно вырастет. */
export const CATALOG_LIST_MAX = 500;
