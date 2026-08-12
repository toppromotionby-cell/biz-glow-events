/**
 * Общая загрузка растровых картинок для всех PDF (презентации, КП, договоры).
 *
 * Зачем: pdf-lib умеет встраивать только JPEG и PNG, а часть фотографий
 * каталога лежит на внешнем сайте в формате .webp — такие кадры молча
 * пропадали из PDF, хотя в браузерном превью были видны.
 *
 * Порядок работы:
 *  1. Скачиваем файл, явно прося JPEG/PNG в Accept.
 *  2. Определяем формат по сигнатуре, а не по расширению.
 *  3. webp/avif/gif конвертируем на лету: для Storage — через встроенный
 *     трансформер картинок, для публичных ссылок — через image-прокси.
 *  4. Не получилось — возвращаем null, вызывающий рисует заглушку.
 *
 * Результат кешируется в памяти воркера на время сборки документа,
 * поэтому одно и то же фото не качается дважды.
 */

import type { PDFDocument, PDFImage } from "pdf-lib";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT = 8000;
/** Accept без image/webp — Storage-трансформер тогда отдаёт JPEG. */
const ACCEPT = "image/jpeg,image/png;q=0.9,*/*;q=0.1";

export type ImageFormat = "png" | "jpg" | "webp" | "avif" | "gif" | "unknown";

/** Определяет формат по сигнатуре файла. */
export function sniffImageFormat(b: Uint8Array): ImageFormat {
  if (b.length < 12) return "unknown";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  const ascii = (i: number, s: string) =>
    s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "avif";
  return "unknown";
}

/** Ссылка на файл в нашем хранилище? */
function isStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\//.test(url);
}

/**
 * Storage умеет отдавать сконвертированный кадр через render/image.
 * Формат зависит от Accept: без image/webp приходит JPEG.
 */
function storageTransformUrl(url: string, width: number): string {
  const converted = url.replace("/storage/v1/object/", "/storage/v1/render/image/");
  const sep = converted.includes("?") ? "&" : "?";
  return `${converted}${sep}width=${width}&quality=82&resize=contain`;
}

/** Публичный image-прокси: перекодирует webp/avif в JPEG. */
function proxyUrl(url: string, width: number): string {
  const bare = url.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(bare)}&output=jpg&q=82&w=${width}`;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: ACCEPT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Возвращает байты картинки в PNG или JPEG, конвертируя при необходимости.
 * `width` — желаемая ширина при перекодировании (px).
 */
export async function loadEmbeddableImageBytes(
  url: string,
  width = 1600,
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" } | null> {
  const src = url.trim();
  if (!src || !/^https?:\/\//i.test(src)) return null;

  const direct = await fetchBytes(src);
  if (direct) {
    const fmt = sniffImageFormat(direct);
    if (fmt === "png" || fmt === "jpg") return { bytes: direct, format: fmt };
  }

  // Нужна конвертация: сначала родной трансформер Storage, затем прокси.
  const candidates = isStorageUrl(src)
    ? [storageTransformUrl(src, width)]
    : [proxyUrl(src, width)];

  for (const candidate of candidates) {
    const bytes = await fetchBytes(candidate);
    if (!bytes) continue;
    const fmt = sniffImageFormat(bytes);
    if (fmt === "png" || fmt === "jpg") return { bytes, format: fmt };
  }
  return null;
}

/** Кеш на время одной сборки документа: url -> встроенная картинка. */
export type ImageCache = Map<string, PDFImage | null>;

export function createImageCache(): ImageCache {
  return new Map();
}

/**
 * Скачивает и встраивает картинку в PDF. Любая ошибка — null,
 * документ из-за одного битого фото не падает.
 */
export async function embedImageUrl(
  pdf: PDFDocument,
  url: string | null | undefined,
  opts: { width?: number; cache?: ImageCache } = {},
): Promise<PDFImage | null> {
  const src = (url ?? "").trim();
  if (!src) return null;
  const cache = opts.cache;
  if (cache?.has(src)) return cache.get(src) ?? null;

  let img: PDFImage | null = null;
  try {
    const loaded = await loadEmbeddableImageBytes(src, opts.width ?? 1600);
    if (loaded) {
      img = loaded.format === "png"
        ? await pdf.embedPng(loaded.bytes)
        : await pdf.embedJpg(loaded.bytes);
    }
  } catch {
    img = null;
  }
  cache?.set(src, img);
  return img;
}
