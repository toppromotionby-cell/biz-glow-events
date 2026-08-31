// Оформление ответов для Telegram: Markdown → безопасный HTML, чистка тегов,
// разбиение длинных сообщений и единая строка статуса синхронизации.
// Клиент-безопасный модуль (используется и в тестах, и на сервере).

export const TG_LIMIT = 3500;

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "s", "code", "pre", "a"]);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Текст модели (обычно с Markdown) → HTML, который принимает Telegram.
 * Всё, что не является поддерживаемой разметкой, экранируется.
 */
export function mdToTgHtml(input: string): string {
  let out = esc(input.replace(/\r\n/g, "\n"));
  // Код в обратных кавычках — раньше остальных правил.
  out = out.replace(/```([\s\S]*?)```/g, (_m, code: string) => `<pre>${code.trim()}</pre>`);
  out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Ссылки [текст](url)
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  // Жирный / курсив
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/__([^_\n]+)__/g, "<b>$1</b>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  // Заголовки → жирная строка
  out = out.replace(/^\s{0,3}#{1,6}\s*(.+)$/gm, "<b>$1</b>");
  // Списки и горизонтальные линии
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
  out = out.replace(/^\s*(---|\*\*\*|___)\s*$/gm, "");
  // Не больше одной пустой строки подряд
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Убирает недопустимые и незакрытые теги: такое сообщение Telegram отклоняет целиком.
 */
export function sanitizeTgHtml(html: string): string {
  const stack: string[] = [];
  const out = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)\/?>/g, (match, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED.has(name)) return esc(match);
    const closing = match.startsWith("</");
    if (closing) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) return ""; // закрывающий без открывающего — выбрасываем
      stack.splice(idx, 1);
      return `</${name}>`;
    }
    stack.push(name);
    if (name === "a") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? /href\s*=\s*'([^']*)'/i.exec(attrs)?.[1] ?? "";
      const safe = /^(https?:|tg:)/i.test(href) ? href : "";
      return safe ? `<a href="${safe}">` : "<a>";
    }
    return `<${name}>`;
  });
  // Закрываем всё, что осталось открытым.
  const tail = stack.reverse().map((t) => `</${t}>`).join("");
  return `${out}${tail}`;
}

/** Готовый к отправке HTML из произвольного ответа модели. */
export function toTgHtml(input: string): string {
  return sanitizeTgHtml(mdToTgHtml(input));
}

/** Разбивает длинный текст на части по границам строк (лимит Telegram — 4096). */
export function splitTgText(text: string, limit = TG_LIMIT): string[] {
  if (text.length <= limit) return text.trim() ? [text] : [];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

export type SyncState = "ok" | "skipped" | "failed";

export interface SyncStatus {
  target: "calendar" | "tasks";
  state: SyncState;
  /** Причина для skipped/failed или подпись (например, список задач). */
  detail?: string | null;
  reminderLabel?: string | null;
}

function humanMinutes(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} сут`;
  if (min % 60 === 0) return `${min / 60} ч`;
  return `${min} мин`;
}

export function reminderLabel(minutes: number[]): string | null {
  if (!minutes.length) return null;
  return `напоминание за ${humanMinutes(Math.max(...minutes))}`;
}

/** Одна строка под карточкой: где именно оказалась запись. */
export function syncFooter(statuses: SyncStatus[]): string {
  if (!statuses.length) return "⚠️ Только в планере — Google не подключён";
  const parts = statuses.map((s) => {
    const name = s.target === "calendar" ? "Google Календарь" : "Календарь задач";
    if (s.state === "ok") {
      const extra = [s.detail, s.reminderLabel].filter(Boolean).join(" · ");
      return `${s.target === "calendar" ? "📅" : "✅"} ${name}${extra ? ` · ${extra}` : ""}`;
    }
    if (s.state === "skipped") return `⚠️ ${name} — ${s.detail ?? "пропущено"}`;
    return `⚠️ В ${name} не ушло: ${s.detail ?? "ошибка"}`;
  });
  return parts.join("\n");
}
