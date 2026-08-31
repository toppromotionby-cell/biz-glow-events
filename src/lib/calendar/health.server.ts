// Здоровье интеграции с Google: отслеживаем проблемы доступа и предупреждаем в Telegram.
// Только серверный код.
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Не чаще одного предупреждения в сутки. */
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface GoogleHealth {
  state: "ok" | "scope" | "unknown";
  detail: string | null;
  alertedAt: string | null;
}

export async function getGoogleHealth(db: Admin): Promise<GoogleHealth> {
  const { data } = await db
    .from("assistant_prefs")
    .select("google_health_state, google_health_alert_at")
    .eq("id", 1)
    .maybeSingle();
  const row = (data ?? {}) as { google_health_state?: string | null; google_health_alert_at?: string | null };
  const raw = row.google_health_state ?? null;
  if (!raw) return { state: "unknown", detail: null, alertedAt: row.google_health_alert_at ?? null };
  const [state, ...rest] = raw.split("|");
  return {
    state: state === "ok" ? "ok" : state === "scope" ? "scope" : "unknown",
    detail: rest.join("|") || null,
    alertedAt: row.google_health_alert_at ?? null,
  };
}

/** Доступ к Google снова работает — снимаем флаг проблемы. */
export async function reportGoogleOk(db: Admin): Promise<void> {
  const current = await getGoogleHealth(db);
  if (current.state === "ok") return;
  await db
    .from("assistant_prefs")
    .update({ google_health_state: "ok", google_health_alert_at: null } as never)
    .eq("id", 1);
}

/**
 * Проблема с правами Google: сохраняем состояние и один раз в сутки
 * предупреждаем владельца в Telegram.
 */
export async function reportGoogleIssue(db: Admin, detail: string): Promise<void> {
  const current = await getGoogleHealth(db);
  await db
    .from("assistant_prefs")
    .update({ google_health_state: `scope|${detail.slice(0, 200)}` } as never)
    .eq("id", 1);

  const last = current.alertedAt ? new Date(current.alertedAt).getTime() : 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;

  try {
    const { getPrefs } = await import("@/lib/calendar/store.server");
    const { tgSend } = await import("@/lib/calendar/telegram.server");
    const prefs = await getPrefs(db);
    if (prefs.tg_chat_id) {
      await tgSend(
        prefs.tg_chat_id,
        [
          "⚠️ <b>Google: нет доступа</b>",
          "Синхронизация задач и встреч приостановлена — подключение Google потеряло права.",
          "Откройте настройки подключений и переподключите Google Календарь.",
          `<i>${detail.slice(0, 150)}</i>`,
        ].join("\n"),
      );
    }
  } catch (e) {
    console.warn("[planner-health] не удалось отправить предупреждение", e);
  }

  await db
    .from("assistant_prefs")
    .update({ google_health_alert_at: new Date().toISOString() } as never)
    .eq("id", 1);
}
