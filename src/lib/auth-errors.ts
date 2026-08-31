// Человеческие тексты ошибок авторизации вместо технических английских сообщений.
// Клиент-безопасный модуль: используется формами входа/регистрации и тестами.

export interface AuthLikeError {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

const BY_CODE: Record<string, string> = {
  invalid_credentials: "Неверная почта или пароль. Проверьте раскладку и заглавные буквы.",
  invalid_login_credentials: "Неверная почта или пароль. Проверьте раскладку и заглавные буквы.",
  email_not_confirmed: "Почта ещё не подтверждена — откройте письмо со ссылкой подтверждения.",
  user_not_found: "Пользователь с такой почтой не найден.",
  user_banned: "Доступ к аккаунту заблокирован. Напишите администратору.",
  over_request_rate_limit: "Слишком много попыток. Подождите минуту и попробуйте снова.",
  over_email_send_rate_limit: "Слишком много писем за короткое время. Попробуйте через несколько минут.",
  same_password: "Новый пароль совпадает со старым — придумайте другой.",
  weak_password: "Пароль слишком простой: минимум 8 символов, буквы и цифры.",
  signup_disabled: "Регистрация закрыта. Аккаунт создаёт администратор.",
  email_exists: "Аккаунт с такой почтой уже существует — войдите или восстановите пароль.",
  validation_failed: "Проверьте правильность заполнения полей.",
  session_expired: "Сессия истекла. Войдите заново.",
  otp_expired: "Ссылка устарела. Запросите новую.",
};

const BY_TEXT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials as string],
  [/email not confirmed/i, BY_CODE.email_not_confirmed as string],
  [/rate limit|too many requests/i, BY_CODE.over_request_rate_limit as string],
  [/user not found/i, BY_CODE.user_not_found as string],
  [/password should be at least|weak password/i, BY_CODE.weak_password as string],
  [/already registered|user already exists/i, BY_CODE.email_exists as string],
  [/token has expired|otp_expired|expired/i, BY_CODE.otp_expired as string],
  [/unsupported provider/i, "Этот способ входа пока не подключён. Войдите по почте и паролю."],
  [/failed to fetch|network|load failed/i, "Нет связи с сервером. Проверьте интернет и попробуйте снова."],
];

/** Возвращает понятный русский текст ошибки авторизации. */
export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return "Не удалось выполнить действие. Попробуйте ещё раз.";
  const code = (error.code ?? "").toLowerCase();
  if (code && BY_CODE[code]) return BY_CODE[code] as string;
  const text = error.message ?? "";
  for (const [re, msg] of BY_TEXT) if (re.test(text)) return msg;
  if (error.status === 429) return BY_CODE.over_request_rate_limit as string;
  if (error.status && error.status >= 500) return "Сервис авторизации временно недоступен. Попробуйте через минуту.";
  return "Войти не удалось. Проверьте почту и пароль или восстановите доступ.";
}
