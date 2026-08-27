// Единый расчёт ширины колонок таблиц корпоративных документов.
// Один источник истины для HTML-превью, PDF и DOCX — иначе превью и файл
// расходятся, а короткие колонки («№», «Кол-во») забирают лишнее место
// и длинные наименования начинают переноситься по слогам без нужды.

/** Максимум «символов» на колонку, дальше текст переносится по строкам. */
const CHAR_CAP = 46;
/** Минимальная ширина колонки в символах — чтобы не схлопнулась в нитку. */
const CHAR_FLOOR = 3;
/** До какой длины слово считаем неразрывным при подборе минимума. */
const WORD_CAP = 14;

const lines = (s: string): string[] => String(s ?? "").split(/\r?\n/);

function longestLine(s: string): number {
  return lines(s).reduce((m, l) => Math.max(m, l.trim().length), 0);
}

function longestWord(s: string): number {
  return String(s ?? "")
    .split(/\s+/)
    .reduce((m, w) => Math.max(m, w.length), 0);
}

/**
 * Доли ширины колонок (в сумме 1) по содержимому.
 * Узкие числовые колонки получают ровно необходимое, остаток уходит тексту.
 */
export function tableColFractions(header: string[], rows: string[][], cols?: number): number[] {
  const n = Math.max(cols ?? 0, header.length, ...rows.map((r) => r.length), 1);
  const desired: number[] = [];
  const floors: number[] = [];

  for (let i = 0; i < n; i++) {
    const cells = [header[i] ?? "", ...rows.map((r) => r[i] ?? "")];
    const content = cells.reduce((m, c) => Math.max(m, longestLine(c)), 0);
    const word = cells.reduce((m, c) => Math.max(m, longestWord(c)), 0);
    // +2 — запас на внутренние отступы ячейки.
    desired.push(Math.max(CHAR_FLOOR, Math.min(content + 2, CHAR_CAP)));
    floors.push(Math.max(CHAR_FLOOR, Math.min(word, WORD_CAP), Math.min(longestLine(header[i] ?? ""), WORD_CAP)));
  }

  const sumDesired = desired.reduce((a, b) => a + b, 0);
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  const budget = Math.max(sumDesired, sumFloors) || 1;
  const minFrac = floors.map((f) => f / budget);

  const out = new Array<number>(n).fill(0);
  const open = new Set<number>(Array.from({ length: n }, (_, i) => i));
  let free = 1;

  // Итеративно фиксируем колонки, которым не хватает минимума.
  for (let guard = 0; guard < n + 1 && open.size > 0; guard++) {
    let poolDesired = 0;
    for (const i of open) poolDesired += desired[i]!;
    const k = poolDesired > 0 ? free / poolDesired : 0;
    let clamped = false;
    for (const i of Array.from(open)) {
      const w = desired[i]! * k;
      if (w < minFrac[i]!) {
        out[i] = minFrac[i]!;
        free -= minFrac[i]!;
        open.delete(i);
        clamped = true;
      }
    }
    if (!clamped) {
      for (const i of open) out[i] = desired[i]! * k;
      break;
    }
    if (free <= 0) {
      // Крайний случай: минимумы не влезают — делим пропорционально минимумам.
      const total = minFrac.reduce((a, b) => a + b, 0) || 1;
      return minFrac.map((f) => f / total);
    }
  }

  const total = out.reduce((a, b) => a + b, 0) || 1;
  return out.map((v) => v / total);
}

/** Доли колонок для блока позиций (№ / Наименование / Кол-во / Ед. / Цена / Сумма). */
export function lineItemColFractions(
  lines_: Array<{ name: string; qty: number | string; unit: string; price: number | string; total: number | string }>,
): number[] {
  return tableColFractions(
    ["№", "Наименование", "Кол-во", "Ед.", "Цена", "Сумма"],
    lines_.map((l, i) => [
      String(i + 1),
      l.name,
      String(l.qty),
      String(l.unit),
      String(l.price),
      String(l.total),
    ]),
    6,
  );
}

/** `<colgroup>` для HTML-превью — те же доли, что уходят в PDF и DOCX. */
export function colgroupHtml(fractions: number[]): string {
  const cols = fractions
    .map((f) => `<col style="width:${(f * 100).toFixed(3)}%" />`)
    .join("");
  return `<colgroup>${cols}</colgroup>`;
}
