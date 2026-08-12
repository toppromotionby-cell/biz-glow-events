// Измерение текста для слайдов: одна и та же математика в превью и в PDF.
//
// Точные метрики TTF доступны только на сервере, поэтому используем таблицу
// средних ширин символов для Inter / Space Grotesk. Ширина считается по
// классам символов (кириллица шире латиницы, цифры моноширинные, пробелы и
// пунктуация узкие) — это заметно точнее прежнего единого коэффициента 0.52
// и даёт одинаковый перенос строк в превью и в экспорте.

/** Доля от кегля для разных классов символов. */
const W_SPACE = 0.26;
const W_NARROW = 0.3; // i l j ! . , : ; ' ( ) [ ] | I
const W_WIDE = 0.82; // M W m w Ш Щ Ж Ю
const W_DIGIT = 0.56;
const W_LATIN = 0.52;
const W_CYRILLIC = 0.56;
const W_UPPER_K = 1.08; // прописные шире строчных

const NARROW = new Set("iljtfr!.,:;'\"`|()[]{}/\\-IЁёіїґ".split(""));
const WIDE = new Set("MWmw@%ШЩЖЮшщжюфФЫы".split(""));

/** Ширина одного символа в долях кегля. */
function charWidth(ch: string): number {
  if (ch === " " || ch === "\u00a0" || ch === "\t") return W_SPACE;
  if (NARROW.has(ch)) return W_NARROW;
  if (WIDE.has(ch)) return W_WIDE;
  if (ch >= "0" && ch <= "9") return W_DIGIT;
  const cyr = /[\u0400-\u04FF]/.test(ch);
  const base = cyr ? W_CYRILLIC : W_LATIN;
  const upper = ch !== ch.toLowerCase() && ch === ch.toUpperCase();
  return upper ? base * W_UPPER_K : base;
}

/** Ширина строки в px при заданном кегле. */
export function measureText(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * size;
}

/**
 * Перенос по словам в заданную ширину. Слово длиннее строки режется —
 * так же ведут себя и браузер, и наш PDF-рендер.
 */
export function wrapText(text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const limit = Math.max(size, maxWidth);
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, size) <= limit) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // Слишком длинное слово — режем по символам.
      if (measureText(word, size) > limit) {
        let chunk = "";
        for (const ch of word) {
          if (measureText(chunk + ch, size) > limit && chunk) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Количество строк после переноса. */
export function countLines(text: string, size: number, maxWidth: number): number {
  if (!text.trim()) return 0;
  return wrapText(text, size, maxWidth).length;
}

/**
 * «Висячее» слово: последняя строка заголовка состоит из одного короткого
 * слова — типографски некрасиво, выносим в предупреждение.
 */
export function hasOrphanWord(text: string, size: number, maxWidth: number): boolean {
  const lines = wrapText(text, size, maxWidth);
  if (lines.length < 2) return false;
  const last = lines[lines.length - 1]!.trim();
  return last.length > 0 && !last.includes(" ") && last.length <= 6;
}

/** Максимальный кегль, при котором текст влезает в одну строку ширины maxWidth. */
export function fitSingleLineSize(text: string, maxWidth: number, maxSize: number): number {
  const w = measureText(text, 1);
  if (w <= 0) return maxSize;
  return Math.min(maxSize, maxWidth / w);
}
