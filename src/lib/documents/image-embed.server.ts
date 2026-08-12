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

export type ImageFormat = "png" | "jpg" | "webp" | "avif" | "gif" | "svg" | "unknown";

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
  // SVG — текст: пропускаем BOM/пробелы, допускаем XML-пролог и комментарии.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(b.slice(0, 512))
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (/^<(\?xml|!--|!DOCTYPE svg|svg[\s>])/i.test(head) && /<svg[\s>]/i.test(head)) return "svg";
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

/** Публичный image-прокси: перекодирует webp/avif/svg в JPEG или PNG. */
export function proxyUrl(url: string, width: number, output: "jpg" | "png" = "jpg"): string {
  const bare = url.replace(/^https?:\/\//i, "");
  const q = output === "jpg" ? "&q=82" : "";
  return `https://images.weserv.nl/?url=${encodeURIComponent(bare)}&output=${output}${q}&w=${width}`;
}

/**
 * Порядок попыток конвертации для исходника.
 * SVG трансформер хранилища не конвертирует (отдаёт тот же файл), поэтому для
 * векторных и прозрачных картинок сразу идём в прокси и просим PNG.
 */
export function conversionCandidates(url: string, width: number, format: ImageFormat): string[] {
  const transparent = format === "svg" || format === "avif" || format === "webp" || format === "unknown";
  const list: string[] = [];
  if (format !== "svg" && isStorageUrl(url)) list.push(storageTransformUrl(url, width));
  if (transparent) list.push(proxyUrl(url, width, "png"));
  list.push(proxyUrl(url, width, "jpg"));
  return list;
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
  const sourceFormat: ImageFormat = direct ? sniffImageFormat(direct) : "unknown";
  if (direct && (sourceFormat === "png" || sourceFormat === "jpg")) {
    return { bytes: direct, format: sourceFormat };
  }

  // Нужна конвертация: трансформер хранилища (для растра), затем прокси.
  const candidates = conversionCandidates(src, width, sourceFormat);

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
