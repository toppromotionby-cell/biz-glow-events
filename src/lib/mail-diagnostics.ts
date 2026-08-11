// Общие типы и русские подсказки для диагностики почтовых подключений.
// Клиент-безопасный модуль: используется и в server fn, и в админ-UI.

export type MailStep = {
  step: "imap" | "smtp";
  ok: boolean;
  detail?: string;
  kind?: string;
  code?: string | null;
  message?: string;
  response?: string | null;
  tried?: Record<string, unknown>;
};

export type MailSuggestion = {
  username: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_port: number;
  smtp_secure: boolean;
  allow_invalid_cert?: boolean;
};

export type MailTestResult = {
  ok: boolean;
  status_code: number | null;
  message: string;
  hint?: string | null;
  steps?: MailStep[];
  suggestion?: MailSuggestion | null;
  applied?: boolean;
  duration_ms: number;
  error?: string | null;
};

/** Человеческое объяснение технической ошибки IMAP/SMTP. */
export function mailErrorHint(kind: string | undefined, step?: string): string {
  const where = step === "smtp" ? "SMTP (отправка)" : "IMAP (входящие)";
  switch (kind) {
    case "auth":
      return `${where}: сервер не принял логин или пароль. Для hoster.by логин — полный адрес ящика (name@domain.by), пароль — от самого ящика (создаётся в панели «Почта»), а не от личного кабинета. Проверьте также, что для ящика включён доступ по IMAP/SMTP.`;
    case "command_failed":
      return `${where}: сервер отклонил команду входа. Чаще всего это неверный пароль ящика либо выключенный IMAP-доступ. Пересоздайте пароль ящика в панели хостинга и повторите.`;
    case "dns":
      return `${where}: не найден почтовый сервер — проверьте адрес хоста (для hoster.by обычно mail.hoster.by или mail.ваш-домен).`;
    case "refused":
      return `${where}: сервер отклонил соединение на этом порту. Попробуйте стандартные порты: IMAP 993 (SSL), SMTP 465 (SSL) или 587 (STARTTLS).`;
    case "timeout":
      return `${where}: сервер не ответил вовремя. Возможно, порт закрыт или сервис почты недоступен — повторите через минуту.`;
    case "tls":
      return `${where}: проблема с сертификатом или шифрованием. Проверьте соответствие порта и режима SSL/STARTTLS.`;
    default:
      return `${where}: соединение не удалось. Проверьте хост, порт, режим SSL и пароль ящика.`;
  }
}

export const MAIL_PRESETS: Array<{
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  /** Логин = полный email. */
  loginIsEmail: boolean;
  note?: string;
}> = [
  {
    id: "hoster",
    label: "hoster.by",
    imap_host: "mail.hoster.by",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "mail.hoster.by",
    smtp_port: 465,
    smtp_secure: true,
    loginIsEmail: true,
    note: "Логин — полный адрес ящика. Пароль — от почтового ящика (панель hoster.by → Почта → ящик → сменить пароль), не от личного кабинета. IMAP-доступ должен быть включён. Если ящик на своём домене, хост может быть mail.ваш-домен.by — тогда впишите его вручную.",
  },
  {
    id: "yandex",
    label: "Яндекс.Почта",
    imap_host: "imap.yandex.ru",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "smtp.yandex.ru",
    smtp_port: 465,
    smtp_secure: true,
    loginIsEmail: true,
    note: "Нужен пароль приложения, обычный пароль не подойдёт.",
  },
  {
    id: "gmail",
    label: "Gmail",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_secure: true,
    loginIsEmail: true,
    note: "Нужен пароль приложения (App password) и включённый IMAP.",
  },
  {
    id: "mailru",
    label: "Mail.ru",
    imap_host: "imap.mail.ru",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "smtp.mail.ru",
    smtp_port: 465,
    smtp_secure: true,
    loginIsEmail: true,
    note: "Нужен пароль для внешнего приложения.",
  },
];
