// Единые правила паролей для всего сайта: регистрация, сброс, смена пароля,
// создание кабинета при заказе. Клиент-безопасный модуль (используется и в тестах).

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72; // ограничение bcrypt на стороне авторизации

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string, ctx?: PasswordContext) => boolean;
}

export interface PasswordContext {
  /** Почта пользователя — пароль не должен её повторять. */
  email?: string | null;
}

const COMMON = [
  "password", "пароль", "qwerty", "йцукен", "123456", "12345678", "123456789",
  "1234567890", "admin", "letmein", "welcome", "iloveyou", "abc123", "qwerty123",
  "eventhub", "event-hub", "111111", "000000", "zaq12wsx", "passw0rd",
];

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Не короче ${PASSWORD_MIN_LENGTH} символов`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH,
  },
  { id: "lower", label: "Есть строчная буква (a–z, а–я)", test: (v) => /[a-zа-яё]/.test(v) },
  { id: "upper", label: "Есть заглавная буква (A–Z, А–Я)", test: (v) => /[A-ZА-ЯЁ]/.test(v) },
  { id: "digit", label: "Есть цифра (0–9)", test: (v) => /\d/.test(v) },
  {
    id: "special",
    label: "Есть спецсимвол (!@#$%^&*-_?)",
    test: (v) => /[^A-Za-zА-Яа-яЁё0-9]/.test(v),
  },
  {
    id: "nospace",
    label: "Без пробелов в начале и в конце",
    test: (v) => v === v.trim() && v.length > 0,
  },
  {
    id: "notcommon",
    label: "Не простой и не совпадает с почтой",
    test: (v, ctx) => {
      const low = v.toLowerCase();
      if (!low) return false;
      if (COMMON.some((c) => low === c || low.includes(c))) return false;
      const local = (ctx?.email ?? "").split("@")[0]?.toLowerCase() ?? "";
      if (local.length >= 3 && low.includes(local)) return false;
      return true;
    },
  },
];

export interface PasswordCheck {
  ok: boolean;
  failed: PasswordRule[];
  passed: string[];
  /** 0..4 — для полосы надёжности. */
  score: number;
  message: string | null;
}

/** Проверяет пароль по единым правилам портала. */
export function checkPassword(value: string, ctx?: PasswordContext): PasswordCheck {
  const v = value ?? "";
  const failed = PASSWORD_RULES.filter((r) => !r.test(v, ctx));
  const passed = PASSWORD_RULES.filter((r) => r.test(v, ctx)).map((r) => r.id);
  const base = Math.round((passed.length / PASSWORD_RULES.length) * 3);
  const bonus = v.length >= 14 ? 1 : 0;
  return {
    ok: failed.length === 0,
    failed,
    passed,
    score: Math.min(4, failed.length ? base : base + bonus),
    message: failed.length ? (failed[0] as PasswordRule).label : null,
  };
}

export const PASSWORD_STRENGTH_LABEL = ["Очень слабый", "Слабый", "Средний", "Надёжный", "Отличный"] as const;

/** Текст ошибки для форм (или null, если пароль подходит). */
export function passwordError(value: string, ctx?: PasswordContext): string | null {
  const res = checkPassword(value, ctx);
  return res.ok ? null : `Пароль не подходит: ${res.message?.toLowerCase()}`;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const SPECIAL = "!@#$%^&*-_?";

function pick(pool: string, rnd: () => number) {
  return pool[Math.floor(rnd() * pool.length)] as string;
}

/** Генерирует надёжный пароль, гарантированно проходящий все правила. */
export function generatePassword(length = 16, rnd?: () => number): string {
  const random =
    rnd ??
    (() => {
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        return (crypto.getRandomValues(new Uint32Array(1))[0] as number) / 2 ** 32;
      }
      return Math.random();
    });
  const len = Math.max(PASSWORD_MIN_LENGTH + 2, Math.min(length, 32));
  const chars = [pick(UPPER, random), pick(LOWER, random), pick(DIGIT, random), pick(SPECIAL, random)];
  const all = UPPER + LOWER + DIGIT + SPECIAL;
  while (chars.length < len) chars.push(pick(all, random));
  // Перемешиваем (Фишер–Йетс)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  const out = chars.join("");
  return checkPassword(out).ok ? out : generatePassword(length, rnd);
}
