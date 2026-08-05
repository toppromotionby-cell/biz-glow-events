// Настраиваемый отправитель писем (Настройки → Письма → Отправители).
// Физическая отправка всегда идёт с проверенного домена event-hub.by;
// внешний адрес попадает в Reply-To, чтобы не ломать доставляемость.
// Server-only: не импортировать в клиентский код.

export const VERIFIED_FROM_DOMAIN = "event-hub.by";
export const FALLBACK_FROM_EMAIL = `noreply@${VERIFIED_FROM_DOMAIN}`;
export const FALLBACK_FROM_NAME = "event-hub.by";

export const SENDER_KINDS = [
  "default",
  "orders",
  "quotes",
  "leads",
  "auth",
  "campaigns",
  "admin",
] as const;

export type SenderKind = (typeof SENDER_KINDS)[number];

export type SenderRow = {
  kind: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  inherit_default: boolean;
};

export type ResolvedSender = {
  /** Готовая строка для поля From: `Имя <адрес>`. */
  from: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (v: string): boolean => EMAIL_RE.test(v.trim());

const onVerifiedDomain = (email: string): boolean => {
  const d = email.trim().toLowerCase().split("@")[1] ?? "";
  return d === VERIFIED_FROM_DOMAIN || d.endsWith(`.${VERIFIED_FROM_DOMAIN}`);
};

/** Экранирование имени отправителя для заголовка From. */
const quoteName = (name: string): string => {
  const clean = name.replace(/[\r\n"\\]/g, " ").trim();
  if (!clean) return "";
  return /[<>@,;:]/.test(clean) ? `"${clean}"` : clean;
};

/**
 * Собирает From/Reply-To по настройкам.
 * Внешний адрес не ставится в From — вместо него технический адрес
 * проверенного домена, а внешний уходит в Reply-To.
 */
export function buildSender(input: {
  fromName: string;
  fromEmail: string;
  replyTo: string;
}): ResolvedSender {
  const name = (input.fromName || FALLBACK_FROM_NAME).trim();
  const wanted = input.fromEmail.trim();
  const explicitReply = input.replyTo.trim();

  const valid = wanted && isValidEmail(wanted) ? wanted : FALLBACK_FROM_EMAIL;
  const external = !onVerifiedDomain(valid);
  const fromEmail = external ? FALLBACK_FROM_EMAIL : valid;

  let replyTo = explicitReply && isValidEmail(explicitReply) ? explicitReply : "";
  if (!replyTo) replyTo = external ? valid : fromEmail;

  const displayName = quoteName(name);
  return {
    from: displayName ? `${displayName} <${fromEmail}>` : fromEmail,
    fromName: name,
    fromEmail,
    replyTo,
  };
}

export const DEFAULT_SENDER: ResolvedSender = buildSender({
  fromName: FALLBACK_FROM_NAME,
  fromEmail: FALLBACK_FROM_EMAIL,
  replyTo: FALLBACK_FROM_EMAIL,
});

type CacheEntry = { at: number; rows: Map<string, SenderRow> };
let cache: CacheEntry | null = null;
const TTL_MS = 60_000;

async function loadRows(): Promise<Map<string, SenderRow>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = new Map<string, SenderRow>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_senders")
      .select("kind, from_name, from_email, reply_to, inherit_default");
    for (const r of (data ?? []) as SenderRow[]) rows.set(r.kind, r);
  } catch {
    // Не валим отправку — используем фолбэк.
  }
  cache = { at: Date.now(), rows };
  return rows;
}

/** Сбросить кэш после сохранения настроек. */
export function invalidateSenderCache(): void {
  cache = null;
}

/** Итоговый отправитель для типа писем с наследованием от `default`. */
export async function resolveSender(kind: SenderKind): Promise<ResolvedSender> {
  const rows = await loadRows();
  const fallback = rows.get("default");
  const own = rows.get(kind);
  const row = !own || own.inherit_default || kind === "default" ? fallback : own;
  if (!row) return DEFAULT_SENDER;
  return buildSender({
    fromName: row.from_name || fallback?.from_name || FALLBACK_FROM_NAME,
    fromEmail: row.from_email || fallback?.from_email || FALLBACK_FROM_EMAIL,
    replyTo: row.reply_to || fallback?.reply_to || "",
  });
}
