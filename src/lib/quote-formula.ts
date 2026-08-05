// Валидация текстов КП: плейсхолдеры и формулы {{= ... }}.
// Browser-safe: используется в редакторе конструктора и (при желании) на сервере.
import { QUOTE_PLACEHOLDERS, evaluateFormula, formatMoney, type NumericMap } from "./quote-blocks";

/** Переменные, которые можно использовать внутри формул {{= ... }}. */
export const FORMULA_VARIABLES: Array<{ key: string; label: string }> = [
  { key: "subtotal", label: "Стоимость позиций" },
  { key: "discount", label: "Скидка" },
  { key: "delivery", label: "Доставка" },
  { key: "total", label: "Итого" },
  { key: "prepayment", label: "Предоплата" },
  { key: "advance", label: "Аванс (= предоплата)" },
  { key: "balance", label: "Остаток к оплате" },
  { key: "vat_rate", label: "Ставка НДС, %" },
  { key: "vat_amount", label: "Сумма НДС" },
  { key: "total_with_vat", label: "Итого с НДС" },
  { key: "items_count", label: "Количество позиций" },
  { key: "items_qty", label: "Суммарное количество единиц" },
];

export const FORMULA_VARIABLE_KEYS = FORMULA_VARIABLES.map((v) => v.key);

/** Демо-значения — для мгновенного предпросмотра результата формулы в редакторе. */
export const FORMULA_SAMPLE: NumericMap = {
  subtotal: 5000,
  discount: 500,
  delivery: 300,
  total: 4800,
  prepayment: 1440,
  advance: 1440,
  balance: 3360,
  vat_rate: 20,
  vat_amount: 960,
  total_with_vat: 5760,
  items_count: 6,
  items_qty: 14,
};

/** Ключи обычных плейсхолдеров {{key}} (без формул). */
export const PLACEHOLDER_KEYS = QUOTE_PLACEHOLDERS.map((p) => p.key).filter((k) => !k.startsWith("="));

export type TextIssue = {
  level: "error" | "warning";
  message: string;
  /** Позиция проблемного фрагмента в исходном тексте. */
  start: number;
  end: number;
  excerpt: string;
};

/** Проверка синтаксиса формулы. Возвращает null, если ошибок нет. */
export function checkFormulaSyntax(expr: string, knownVars: string[] = FORMULA_VARIABLE_KEYS): string | null {
  const src = String(expr ?? "").trim();
  if (!src) return "Пустая формула: укажите выражение, например total - advance";

  const bad = src.match(/[^0-9a-z_+\-*/%().,\s]/i);
  if (bad) return `Недопустимый символ «${bad[0]}». Доступны + - * / % ( ) и переменные`;

  const tokens = src.match(/\d+(?:[.,]\d+)?|[a-z_][a-z0-9_]*|[()+\-*/%]/gi) ?? [];
  if (!tokens.length) return "Не удалось разобрать выражение";

  // Неизвестные переменные
  for (const t of tokens) {
    if (/^[a-z_]/i.test(t)) {
      const key = t.toLowerCase();
      if (!knownVars.includes(key)) {
        const hint = closestVariable(key, knownVars);
        return `Неизвестная переменная «${key}»${hint ? `. Возможно, вы имели в виду «${hint}»` : ""}`;
      }
    }
  }

  // Баланс скобок
  let depth = 0;
  for (const t of tokens) {
    if (t === "(") depth++;
    else if (t === ")") {
      depth--;
      if (depth < 0) return "Лишняя закрывающая скобка «)»";
    }
  }
  if (depth > 0) return `Не закрыта скобка: не хватает ${depth} × «)»`;

  // Структура: значение / оператор чередуются
  let expectValue = true;
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    const isValue = /^[0-9]/.test(t) || /^[a-z_]/.test(t);
    if (isValue) {
      if (!expectValue) return `Пропущен оператор перед «${t}»`;
      expectValue = false;
    } else if (t === "(") {
      if (!expectValue) return "Пропущен оператор перед «(»";
    } else if (t === ")") {
      if (expectValue) return "Перед «)» нет значения";
    } else {
      // оператор
      if (expectValue && t !== "-" && t !== "+") return `Оператор «${t}» стоит не на месте`;
      expectValue = true;
    }
  }
  if (expectValue) return "Выражение обрывается на операторе";

  if (/\/\s*0(?![.,\d])/.test(src)) return "Деление на ноль";

  if (evaluateFormula(src, FORMULA_SAMPLE) === null) return "Выражение не вычисляется — проверьте синтаксис";
  return null;
}

/** Результат формулы на демо-данных (для подсказки «≈ 3 360,00 BYN»). */
export function previewFormula(expr: string): string | null {
  const res = evaluateFormula(expr, FORMULA_SAMPLE);
  return res === null ? null : formatMoney(res);
}

function closestVariable(input: string, list: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const v of list) {
    const d = levenshtein(input, v);
    if (d < bestScore) {
      bestScore = d;
      best = v;
    }
  }
  return best && bestScore <= Math.max(2, Math.floor(input.length / 3)) ? best : null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

/**
 * Полная проверка текста блока: незакрытые скобки {{, неизвестные плейсхолдеры,
 * синтаксис формул. Показывается в редакторе до сохранения.
 */
export function validateQuoteText(text: string): TextIssue[] {
  const src = String(text ?? "");
  const issues: TextIssue[] = [];
  if (!src.trim()) return issues;

  // Незакрытые / лишние двойные скобки
  const opens = [...src.matchAll(/\{\{/g)];
  const closes = [...src.matchAll(/\}\}/g)];
  if (opens.length !== closes.length) {
    const pos = opens.length > closes.length ? (opens[closes.length]?.index ?? 0) : (closes[opens.length]?.index ?? 0);
    issues.push({
      level: "error",
      message:
        opens.length > closes.length
          ? "Не закрыт плейсхолдер: нет «}}»"
          : "Лишняя закрывающая скобка «}}»",
      start: pos,
      end: pos + 2,
      excerpt: src.slice(pos, pos + 24),
    });
  }

  const re = /\{\{\s*(=?)\s*([^{}]*?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [full, eq, body] = [m[0], m[1] ?? "", m[2] ?? ""];
    const start = m.index;
    const end = start + full.length;

    if (eq === "=") {
      const err = checkFormulaSyntax(body);
      if (err) issues.push({ level: "error", message: `Формула: ${err}`, start, end, excerpt: full });
      continue;
    }

    const key = body.trim().toLowerCase();
    if (!key) {
      issues.push({ level: "error", message: "Пустой плейсхолдер {{ }}", start, end, excerpt: full });
      continue;
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      issues.push({
        level: "error",
        message: `«${body}» — недопустимое имя. Для вычислений используйте {{= ${body} }}`,
        start,
        end,
        excerpt: full,
      });
      continue;
    }
    if (!PLACEHOLDER_KEYS.includes(key)) {
      const hint = closestVariable(key, PLACEHOLDER_KEYS);
      issues.push({
        level: "warning",
        message: `Неизвестный плейсхолдер «${key}»${hint ? `. Возможно: «${hint}»` : ""} — в документе он останется как есть`,
        start,
        end,
        excerpt: full,
      });
    }
  }

  // Одиночные скобки: {total} вместо {{total}}
  const single = src.match(/(^|[^{])\{[a-z_][a-z0-9_]*\}([^}]|$)/i);
  if (single && single.index !== undefined) {
    issues.push({
      level: "warning",
      message: "Похоже на плейсхолдер с одинарными скобками — нужны двойные: {{ключ}}",
      start: single.index,
      end: single.index + single[0].length,
      excerpt: single[0].trim(),
    });
  }

  return issues;
}
