// Расстановка переносов по правилам русского языка (и базово — латиницы).
// Один и тот же модуль используется в HTML-документах (мягкий перенос \u00AD)
// и в PDF (перенос со вставкой дефиса), поэтому превью и печать совпадают.
//
// Правила, которые соблюдаем:
//  • переносим только по границам слогов (в каждой части должна быть гласная);
//  • нельзя оставлять/переносить меньше двух букв;
//  • нельзя отрывать ь, ъ, й от предыдущей буквы (не начинаем часть с них);
//  • не переносим короткие слова (<6 букв), числа, аббревиатуры и артикулы.

export const SOFT_HYPHEN = "\u00ad";

const VOWELS = "аеёиоуыэюяaeiouy";
const NO_START = "ьъй"; // с этих букв часть слова начинаться не может

const isLetter = (ch: string) => /[a-zA-Zа-яА-ЯёЁ]/.test(ch);
const isVowel = (ch: string) => VOWELS.includes(ch.toLowerCase());
const isCons = (ch: string) => isLetter(ch) && !isVowel(ch);

/** Слово вообще подлежит переносу? */
function hyphenable(word: string): boolean {
  if (word.length < 6) return false;
  if (![...word].every(isLetter)) return false; // числа, артикулы, url
  // аббревиатуры (ООО, PDF, УНП) не переносим
  if (word === word.toUpperCase() && word.length <= 6) return false;
  let vowels = 0;
  for (const ch of word) if (isVowel(ch)) vowels++;
  return vowels >= 2;
}

/**
 * Допустимые точки переноса: индекс i означает разрыв между word[i] и word[i+1].
 * Возвращается по возрастанию.
 */
export function hyphenPoints(word: string): number[] {
  if (!hyphenable(word)) return [];
  const l = [...word];
  const n = l.length;
  const vowelAfter = new Array<boolean>(n + 1).fill(false);
  for (let i = n - 1; i >= 0; i--) vowelAfter[i] = vowelAfter[i + 1] || isVowel(l[i]!);

  const out: number[] = [];
  let vowelBefore = false;
  for (let i = 0; i < n - 1; i++) {
    if (isVowel(l[i]!)) vowelBefore = true;
    // минимум по две буквы с каждой стороны
    if (i < 1 || n - i - 1 < 2) continue;
    if (!vowelBefore || !vowelAfter[i + 1]) continue;

    const cur = l[i]!;
    const next = l[i + 1]!;
    if (NO_START.includes(next.toLowerCase())) continue; // ...й-... нельзя
    if (isVowel(cur) && isVowel(next)) continue; // не рвём стечение гласных

    const curIsSoft = NO_START.includes(cur.toLowerCase());
    const ok =
      (isVowel(cur) && isCons(next)) || // мо-роз
      (curIsSoft && isCons(next)) || // поль-за
      (isCons(cur) && isCons(next) && isVowel(l[i - 1]!)); // вер-стка
    if (!ok) continue;
    out.push(i);
  }
  return out;
}

/** Разбить строку на слова/разделители с сохранением исходного текста. */
function mapWords(text: string, fn: (word: string) => string): string {
  return text.replace(/[a-zA-Zа-яА-ЯёЁ]+/g, (w) => fn(w));
}

/** Вставить мягкие переносы (для HTML: hyphens: manual). */
export function softHyphenate(text: string): string {
  if (!text) return text;
  return mapWords(text, (word) => {
    const points = hyphenPoints(word);
    if (!points.length) return word;
    let out = "";
    const chars = [...word];
    for (let i = 0; i < chars.length; i++) {
      out += chars[i];
      if (points.includes(i)) out += SOFT_HYPHEN;
    }
    return out;
  });
}

/**
 * Наибольший префикс слова, который влезает в ширину вместе с дефисом.
 * measure — фактические метрики шрифта (PDF) или приближённые (превью).
 * Возвращает null, если допустимой точки переноса нет.
 */
export function splitWordForWidth(
  word: string,
  maxWidth: number,
  measure: (s: string) => number,
): { head: string; tail: string } | null {
  const points = hyphenPoints(word);
  if (!points.length) return null;
  for (let k = points.length - 1; k >= 0; k--) {
    const i = points[k]!;
    const head = word.slice(0, i + 1) + "-";
    if (measure(head) <= maxWidth) return { head, tail: word.slice(i + 1) };
  }
  return null;
}
