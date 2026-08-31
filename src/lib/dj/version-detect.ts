// РОЛЬ «ОРИГИНАЛ ИЛИ РЕМИКС».
//
// Задача: по названию/тегам понять, оригинальная это запись или чужая версия,
// и кто её автор. Логика повторяет то, как размечают релизы Beatport и
// DJ-пулы: сначала скобки в названии, затем сверка с музыкальным каталогом.
//
// Итоговое имя всегда одно и то же:
//   Оригинал: `Artist - Title (Оригинал) [event-hub.by]`
//   Ремикс:   `Artist - Title (Dj Smash Remix) [event-hub.by]`
//
// Файл client-safe: чистые функции без сети и без БД.
import { BRAND, BRAND_TAG, sanitizeFileName, stripBrand } from "./branding";
import type { TrackVersion } from "./types";

export const ORIGINAL_LABEL = "Оригинал";

/** Слова, которые сами по себе НЕ являются именем ремиксера. */
const GENERIC_WORDS = [
  "original", "оригинал", "extended", "radio", "club", "dub", "vocal", "main",
  "clean", "dirty", "explicit", "instrumental", "acapella", "a capella",
  "intro", "outro", "short", "long", "full", "album", "single", "version",
  "edit", "mix", "remix", "rmx", "rework", "bootleg", "mashup", "mash up",
  "vip", "flip", "cut", "transition", "quick hit", "segue", "remaster",
  "remastered", "official", "master", "live", "cover", "sped up", "slowed",
];

/** Что именно за версия — по ключевому слову внутри скобок. */
const KIND_PATTERNS: [RegExp, TrackVersion][] = [
  [/mash ?up/i, "mashup"],
  [/acapella|a ?capella|vocal only/i, "acapella"],
  [/instrumental|\binstr\b|minus/i, "instrumental"],
  [/transition/i, "transition"],
  [/quick ?hit/i, "quick_hit"],
  [/segue/i, "segue"],
  [/\bintro\b|starter/i, "intro"],
  [/\boutro\b|ending/i, "outro"],
  [/extended|ext\.? ?mix|long ?version/i, "extended"],
  [/radio ?(edit|mix|version)/i, "radio"],
  [/\bclean\b/i, "clean"],
  [/\bdirty\b|explicit/i, "dirty"],
  [/remix|rmx|bootleg|rework|\bvip\b|\bflip\b|\bedit\b|\bmix\b/i, "remix"],
];

/** Признак чужой версии: «<кто-то> Remix / Edit / Bootleg / Rework / VIP / Flip / Mix». */
const REMIXER_RE =
  /^(.{2,60}?)\s+(remix|rmx|bootleg|rework|re-?edit|edit|vip(?:\s+mix)?|flip|mashup|mash ?up|mix|dub|refix|remake)$/i;

export type VersionVerdict = {
  /** Нормализованный тип версии для колонки `version`. */
  version: TrackVersion;
  isRemix: boolean;
  /** Каноничное имя ремиксера, если это чужая версия. */
  remixer: string | null;
  /** Что печатаем в скобках: «Оригинал» или «Dj Smash Remix». */
  label: string;
  /** Исходный текст скобок, если был. */
  raw: string | null;
  /** Откуда взята информация. */
  source: "brackets" | "tags" | "catalog" | "default";
  /** 0..1 — насколько уверены. */
  confidence: number;
};

function isGeneric(value: string): boolean {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return true;
  if (GENERIC_WORDS.includes(v)) return true;
  // «Extended», «Radio Edit», «Club Mix» — целиком из служебных слов.
  return v.split(/\s+/).every((w) => GENERIC_WORDS.includes(w));
}

/** Приводит имя артиста/ремиксера к аккуратному виду: `dj smash` → `Dj Smash`. */
export function canonicalName(value: string): string {
  const cleaned = stripBrand(value).replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return "";
  // Уже смешанный регистр (Avicii, DJ SNAKE) — не ломаем осмысленное написание.
  const hasLower = /[a-zа-яё]/.test(cleaned);
  const hasUpper = /[A-ZА-ЯЁ]/.test(cleaned);
  if (hasLower && hasUpper) return cleaned;
  return cleaned
    .split(/(\s+|&|,)/)
    .map((part) =>
      /^[a-zа-яё]/i.test(part)
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part,
    )
    .join("");
}

function bracketChunks(source: string): string[] {
  return [...source.matchAll(/[([]([^)\]]{2,70})[)\]]/g)]
    .map((m) => stripBrand(m[1]!).trim())
    .filter((c) => c.length >= 2 && !/^\d{2,3}\s*(bpm)?\s*$/i.test(c));
}

function kindOf(chunk: string): TrackVersion | null {
  for (const [re, v] of KIND_PATTERNS) if (re.test(chunk)) return v;
  return null;
}

/**
 * Первый уровень каскада: разбор скобок в названии/имени файла.
 * Работает офлайн и покрывает подавляющее большинство файлов.
 */
export function detectVersionFromText(source: string): VersionVerdict {
  const chunks = bracketChunks(stripBrand(source));

  for (const chunk of chunks) {
    const kind = kindOf(chunk);
    if (!kind) continue;

    const m = chunk.match(REMIXER_RE);
    const candidate = m?.[1]?.trim() ?? "";
    if (candidate && !isGeneric(candidate)) {
      const remixer = canonicalName(candidate);
      const suffix = canonicalName(m![2]!.trim());
      return {
        version: kind === "remix" || kind === "mashup" ? kind : "remix",
        isRemix: true,
        remixer,
        label: `${remixer} ${suffix}`,
        raw: chunk,
        source: "brackets",
        confidence: 0.9,
      };
    }

    // Служебная версия без автора: Extended, Radio Edit, Clean…
    if (kind !== "remix") {
      return {
        version: kind,
        isRemix: false,
        remixer: null,
        label: canonicalName(chunk),
        raw: chunk,
        source: "brackets",
        confidence: 0.75,
      };
    }
  }

  // Формат «Title (Artist Remix)» без скобок: «Title - Dj Smash Remix».
  const tail = stripBrand(source).split(/\s+[-–—]\s+/).pop() ?? "";
  const tailMatch = tail.match(REMIXER_RE);
  if (tailMatch && !isGeneric(tailMatch[1]!)) {
    const remixer = canonicalName(tailMatch[1]!);
    return {
      version: "remix",
      isRemix: true,
      remixer,
      label: `${remixer} ${canonicalName(tailMatch[2]!)}`,
      raw: tail,
      source: "brackets",
      confidence: 0.7,
    };
  }

  return {
    version: "original",
    isRemix: false,
    remixer: null,
    label: ORIGINAL_LABEL,
    raw: null,
    source: "default",
    confidence: 0.5,
  };
}

/** Подтверждение/уточнение по данным музыкального каталога. */
export type CatalogMatch = {
  artist: string;
  title: string;
  /** Полное название релиза из каталога — может содержать имя ремиксера. */
  fullTitle: string;
  durationSec: number | null;
  provider: string;
};

/**
 * Второй уровень каскада: сверка с каталогом. Если каталог знает такой трек и
 * в его названии нет ремиксера — это оригинал (уверенность растёт). Если есть —
 * берём каноничное написание ремиксера из каталога.
 */
export function reconcileWithCatalog(
  local: VersionVerdict,
  match: CatalogMatch | null,
): VersionVerdict {
  if (!match) return local;

  const catalogVerdict = detectVersionFromText(match.fullTitle);

  if (catalogVerdict.isRemix && catalogVerdict.remixer) {
    return { ...catalogVerdict, source: "catalog", confidence: 0.95 };
  }

  if (!local.isRemix && local.version === "original") {
    return { ...local, source: "catalog", confidence: 0.95 };
  }

  return local;
}

/** Финальная подпись в скобках. */
export function versionLabel(v: Pick<VersionVerdict, "isRemix" | "remixer" | "label" | "version">): string {
  if (v.isRemix && v.remixer) return v.label || `${v.remixer} Remix`;
  if (v.version === "original") return ORIGINAL_LABEL;
  return v.label || ORIGINAL_LABEL;
}

/** `Artist - Title (Оригинал) [event-hub.by]` — без расширения. */
export function brandedDisplayTitle(input: {
  artist: string;
  title: string;
  label: string;
}): string {
  const artist = stripBrand(input.artist).trim() || BRAND;
  const title = stripBrand(input.title).trim() || "Untitled";
  const label = stripBrand(input.label).trim() || ORIGINAL_LABEL;
  return `${artist} - ${title} (${label}) ${BRAND_TAG}`;
}

/** `Artist - Title (Оригинал) [event-hub.by].mp3` */
export function brandedVersionFileName(input: {
  artist: string;
  title: string;
  label: string;
  ext: string;
}): string {
  const ext = input.ext.startsWith(".") ? input.ext : `.${input.ext}`;
  return `${sanitizeFileName(brandedDisplayTitle(input))}${ext.toLowerCase()}`;
}
