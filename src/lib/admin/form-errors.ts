// Единый контракт ошибок админ-форм: zod-ошибки и ошибки БД приводятся
// к виду { field, message }, чтобы подсветить конкретное поле, а не только тост.
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

/** Плоская карта «путь поля → сообщение» из результата zod. */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

const FIELD_LABELS: Record<string, string> = {
  slug: "URL (slug)",
  code: "Код",
  title: "Заголовок",
  client_name: "Имя клиента",
  email: "E-mail",
  name: "Название",
};

const label = (field: string) => FIELD_LABELS[field] ?? field;

type DbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Достаёт имя колонки из текста Postgres-ошибки: Key (slug)=(...) already exists. */
function columnFromDetails(text: string): string | null {
  const key = /Key \(([^)]+)\)=/.exec(text);
  if (key?.[1]) return key[1].split(",")[0]!.trim().replace(/"/g, "");
  // fallback: имя ограничения вида "cases_slug_key" / "promo_codes_code_key"
  const constraint = /"([a-z0-9_]+)_(?:key|unique|check|fkey)"/i.exec(text);
  if (constraint?.[1]) {
    const parts = constraint[1].split("_");
    return parts.length > 1 ? parts[parts.length - 1]! : null;
  }
  return null;
}

export interface MappedServerError {
  /** Поле формы, если удалось определить. */
  field: string | null;
  /** Человеческий текст для тоста и подписи под полем. */
  message: string;
}

/**
 * Приводит ошибку сохранения (PostgrestError / Error) к полю формы и русскому тексту.
 * Неизвестные ошибки возвращаются как есть, без поля.
 */
export function mapServerError(error: unknown): MappedServerError {
  const e = (error ?? {}) as DbError;
  const raw = e.message ?? (error instanceof Error ? error.message : String(error ?? "Неизвестная ошибка"));
  const text = `${raw} ${e.details ?? ""} ${e.hint ?? ""}`;
  const field = columnFromDetails(text);

  switch (e.code) {
    case "23505":
      return {
        field,
        message: field ? `${label(field)}: такое значение уже занято` : "Такая запись уже существует",
      };
    case "23503":
      return { field, message: "Нельзя сохранить: связанная запись не найдена или используется" };
    case "23514":
      return { field, message: field ? `${label(field)}: значение вне допустимого диапазона` : "Значение вне допустимого диапазона" };
    case "23502":
      return { field, message: field ? `${label(field)}: поле обязательно` : "Не заполнено обязательное поле" };
    case "22P02":
      return { field, message: "Некорректный формат значения" };
    case "42501":
      return { field: null, message: "Недостаточно прав для этого действия" };
    default:
      return { field: null, message: raw };
  }
}
