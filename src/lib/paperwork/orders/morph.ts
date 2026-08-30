// Склонение ФИО и должностей для текстов приказов + числительные словами.
// Правила упрощённые, но покрывают русские/белорусские фамилии из кадрового архива.

export type Gender = "m" | "f" | "unknown";

/** Пол по отчеству (надёжнее, чем по фамилии). */
export function guessGender(fullName: string): Gender {
  const parts = fullName.trim().split(/\s+/);
  const patronymic = parts[2] ?? "";
  if (/(вна|чна)$/i.test(patronymic)) return "f";
  if (/(вич|ич)$/i.test(patronymic)) return "m";
  const first = parts[1] ?? "";
  if (/(а|я)$/i.test(first)) return "f";
  if (first) return "m";
  return "unknown";
}

const dativeWord = (word: string, gender: Gender, kind: "surname" | "name"): string => {
  const w = word;
  if (!w) return w;
  const low = w.toLowerCase();

  if (kind === "surname") {
    if (gender === "f") {
      if (/(ова|ева|ёва|ина|ына|ская|цкая|ая)$/.test(low)) {
        if (/ая$/.test(low)) return w.slice(0, -2) + "ой";
        return w.slice(0, -1) + "ой";
      }
      if (/а$/.test(low)) return w.slice(0, -1) + "е";
      return w; // несклоняемая женская фамилия (Расолько, Бондаренко)
    }
    if (/(ов|ев|ёв|ин|ын)$/.test(low)) return w + "у";
    if (/(ский|цкий|ый|ий)$/.test(low)) return w.slice(0, -2) + "ому";
    if (/(о|е|и|у|ы|э|ю)$/.test(low)) return w; // Расолько, Шевченко
    if (/а$/.test(low)) return w.slice(0, -1) + "е";
    if (/ь$/.test(low)) return w.slice(0, -1) + "ю";
    return w + "у";
  }

  // Имя / отчество
  if (gender === "f") {
    if (/(ия|ья|ья)$/.test(low)) return w.slice(0, -1) + "и";
    if (/(а|я)$/.test(low)) return w.slice(0, -1) + (/я$/.test(low) ? "е" : "е");
    return w;
  }
  if (/(ий|й)$/.test(low)) return w.slice(0, -1) + "ю";
  if (/а$/.test(low)) return w.slice(0, -1) + "е";
  if (/я$/.test(low)) return w.slice(0, -1) + "е";
  if (/ь$/.test(low)) return w.slice(0, -1) + "ю";
  return w + "у";
};

const accusativeWord = (word: string, gender: Gender, kind: "surname" | "name"): string => {
  const w = word;
  if (!w) return w;
  const low = w.toLowerCase();
  if (kind === "surname") {
    if (gender === "f") {
      if (/ая$/.test(low)) return w.slice(0, -2) + "ую";
      if (/а$/.test(low)) return w.slice(0, -1) + "у";
      return w;
    }
    if (/(ов|ев|ёв|ин|ын)$/.test(low)) return w + "а";
    if (/(ский|цкий|ый|ий)$/.test(low)) return w.slice(0, -2) + "ого";
    if (/(о|е|и|у|ы|э|ю)$/.test(low)) return w;
    if (/а$/.test(low)) return w.slice(0, -1) + "у";
    if (/ь$/.test(low)) return w.slice(0, -1) + "я";
    return w + "а";
  }
  if (gender === "f") {
    if (/ия$/.test(low)) return w.slice(0, -1) + "ю";
    if (/(а|я)$/.test(low)) return w.slice(0, -1) + (/я$/.test(low) ? "ю" : "у");
    return w;
  }
  if (/(ий|й)$/.test(low)) return w.slice(0, -1) + "я";
  if (/а$/.test(low)) return w.slice(0, -1) + "у";
  if (/я$/.test(low)) return w.slice(0, -1) + "ю";
  if (/ь$/.test(low)) return w.slice(0, -1) + "я";
  return w + "а";
};

const genitiveWord = (word: string, gender: Gender, kind: "surname" | "name"): string =>
  // Родительный для мужчин совпадает с винительным, для женщин — с дательным.
  gender === "f" ? dativeWord(word, gender, kind) : accusativeWord(word, gender, kind);

function declineFullName(
  fullName: string,
  fn: (w: string, g: Gender, k: "surname" | "name") => string,
): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const gender = guessGender(fullName);
  return parts
    .map((p, i) => fn(p, gender, i === 0 ? "surname" : "name"))
    .join(" ");
}

/** «Кузнецов Дмитрий Владимирович» → «Кузнецову Дмитрию Владимировичу». */
export const fioDative = (fullName: string) => declineFullName(fullName, dativeWord);
/** «Трубина Полина Егоровна» → «Трубину Полину Егоровну». */
export const fioAccusative = (fullName: string) => declineFullName(fullName, accusativeWord);
/** «Расолько Елена Сергеевна» → «Расолько Елены Сергеевны». */
export const fioGenitive = (fullName: string) => declineFullName(fullName, genitiveWord);

/** Должность в дательном: «директор» → «директору», «менеджер по рекламе» → «менеджеру по рекламе». */
export function positionDative(position: string): string {
  const p = position.trim();
  if (!p) return p;
  const [head, ...rest] = p.split(/\s+/);
  const low = head.toLowerCase();
  let out = head;
  if (/(ий|й)$/.test(low)) out = head.slice(0, -1) + "ю";
  else if (/а$/.test(low)) out = head.slice(0, -1) + "е";
  else if (/я$/.test(low)) out = head.slice(0, -1) + "е";
  else if (/ь$/.test(low)) out = head.slice(0, -1) + "ю";
  else out = head + "у";
  return [out, ...rest].join(" ");
}

/** Должность в винительном: «на должность директора». */
export function positionGenitive(position: string): string {
  const p = position.trim();
  if (!p) return p;
  const [head, ...rest] = p.split(/\s+/);
  const low = head.toLowerCase();
  let out = head;
  if (/(ий|й)$/.test(low)) out = head.slice(0, -1) + "я";
  else if (/а$/.test(low)) out = head.slice(0, -1) + "ы";
  else if (/я$/.test(low)) out = head.slice(0, -1) + "и";
  else if (/ь$/.test(low)) out = head.slice(0, -1) + "я";
  else out = head + "а";
  return [out, ...rest].join(" ");
}

/** «Кузнецов Дмитрий Владимирович» → «Д.В. Кузнецов». */
export function initialsAfter(fullName: string): string {
  const [s = "", n = "", p = ""] = fullName.trim().split(/\s+/);
  const ini = [n, p].filter(Boolean).map((x) => x[0]!.toUpperCase() + ".").join("");
  return ini ? `${ini} ${s}` : s;
}

/** «Кузнецов Дмитрий Владимирович» → «Кузнецов Д.В.». */
export function initialsBefore(fullName: string): string {
  const [s = "", n = "", p = ""] = fullName.trim().split(/\s+/);
  const ini = [n, p].filter(Boolean).map((x) => x[0]!.toUpperCase() + ".").join("");
  return ini ? `${s} ${ini}` : s;
}

/** Фамилия заглавными + имя/отчество как есть: «КУЗНЕЦОВУ Дмитрию Владимировичу». */
export function surnameUpper(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return [parts[0]!.toUpperCase(), ...parts.slice(1)].join(" ");
}

const ONES_F = [
  "", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const ONES_M = [...ONES_F];
ONES_M[1] = "один";
ONES_M[2] = "два";
const TENS = [
  "", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят",
  "восемьдесят", "девяносто",
];
const HUNDREDS = [
  "", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот",
  "восемьсот", "девятьсот",
];

/** Число словами до 999: «25» → «двадцать пять». */
export function numberWords(n: number, gender: "m" | "f" = "m"): string {
  const v = Math.abs(Math.trunc(n));
  if (v === 0) return "ноль";
  if (v > 999) return String(v);
  const ones = gender === "f" ? ONES_F : ONES_M;
  const out: string[] = [];
  const h = Math.floor(v / 100);
  const rest = v % 100;
  if (h) out.push(HUNDREDS[h]!);
  if (rest < 20) {
    if (rest) out.push(ones[rest]!);
  } else {
    out.push(TENS[Math.floor(rest / 10)]!);
    if (rest % 10) out.push(ones[rest % 10]!);
  }
  return out.join(" ");
}

/** «25 (Двадцать пять) календарных дней». */
export function countWithWords(n: number, gender: "m" | "f" = "m"): string {
  const w = numberWords(n, gender);
  return `${n} (${w.charAt(0).toUpperCase()}${w.slice(1)})`;
}

/** Правильная форма слова: 1 день / 2 дня / 5 дней. */
export function plural(n: number, one: string, few: string, many: string): string {
  const v = Math.abs(n) % 100;
  const d = v % 10;
  if (v > 10 && v < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
