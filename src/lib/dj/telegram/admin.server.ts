// Админские операции диджей-бота: статус, регистрация вебхука, тестовое сообщение.
import { createHash } from "crypto";
import { djBotConfigured, djTgKey, tgGetMe, tgSend, tgSetMyCommands, tgSetWebhook, tgWebhookInfo } from "./transport.server";
import { getSettings, linksByUser, recentOutbox, type DjTgLink } from "./store.server";
import { admin } from "./store.server";

const PROJECT_ID = "8e78edb2-4da2-4eba-a854-c653075850d6";

export function webhookUrl(): string {
  return `https://project--${PROJECT_ID}-dev.lovable.app/api/public/dj/telegram`;
}

export function webhookSecret(key: string): string {
  return createHash("sha256").update(`dj-telegram-webhook:${key}`).digest("base64url");
}

export async function botStatus(userId: string) {
  const configured = djBotConfigured();
  const [settings, myLinks, outbox] = await Promise.all([getSettings(), linksByUser(userId), recentOutbox(20)]);
  const db = await admin();
  const { data: allLinks } = await db
    .from("dj_tg_links")
    .select("id, user_id, chat_id, tg_username, tg_first_name, muted_until, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const me = configured ? await tgGetMe() : null;
  const hook = configured ? await tgWebhookInfo() : null;
  return {
    configured,
    bot: me,
    webhook: hook,
    expectedWebhook: webhookUrl(),
    settings,
    myLinks,
    links: (allLinks ?? []) as unknown as DjTgLink[],
    outbox: outbox.map((o) => ({
      id: o.id,
      kind: o.kind as string,
      status: o.status as string,
      attempts: o.attempts,
      error: o.last_error ?? null,
      created_at: o.created_at,
    })),
  };
}

export async function registerWebhook() {
  const key = djTgKey();
  if (!key) return { ok: false, error: "DJ_TELEGRAM_API_KEY не подключён" };
  const ok = await tgSetWebhook(webhookUrl(), webhookSecret(key));
  await tgSetMyCommands();
  return { ok, url: webhookUrl() };
}

export async function sendTestMessage(userId: string) {
  const links = await linksByUser(userId);
  if (!links.length) return { ok: false, error: "Ваш Telegram ещё не привязан" };
  for (const l of links) await tgSend(l.chat_id, "✅ Тест: диджей-бот на связи. /help — список команд.");
  return { ok: true, sent: links.length };
}
