// Транспорт и протокол навыка Алисы («Диалоги Яндекса»). Только серверный код.

const PUSH_URL = (skillId: string) => `https://dialogs.yandex.net/api/v1/skills/${skillId}/callback/push`;

/** Тело запроса от Диалогов (используем только нужные поля). */
export interface AliceRequest {
  version?: string;
  session?: {
    new?: boolean;
    session_id?: string;
    skill_id?: string;
    user_id?: string;
    user?: { user_id?: string };
    application?: { application_id?: string };
  };
  request?: {
    command?: string;
    original_utterance?: string;
    type?: string;
  };
  state?: { session?: Record<string, unknown> };
}

export interface AliceReply {
  /** Текст на экране. */
  text: string;
  /** Что произносит Алиса (по умолчанию — text). */
  tts?: string;
  endSession?: boolean;
  buttons?: string[];
  sessionState?: Record<string, unknown>;
}

/** Ответ в формате протокола Диалогов. */
export function aliceResponse(reply: AliceReply): Response {
  return Response.json({
    version: "1.0",
    session_state: reply.sessionState ?? {},
    response: {
      text: reply.text.slice(0, 1024),
      tts: (reply.tts ?? reply.text).slice(0, 1024),
      end_session: Boolean(reply.endSession),
      buttons: (reply.buttons ?? []).map((title) => ({ title, hide: true })),
    },
  });
}

/** Стабильный идентификатор пользователя Яндекса (авторизованный или устройство). */
export function aliceUserId(body: AliceRequest): string | null {
  return body.session?.user?.user_id ?? body.session?.user_id ?? body.session?.application?.application_id ?? null;
}

export function aliceUtterance(body: AliceRequest): string {
  const cmd = (body.request?.command ?? "").trim();
  return cmd || (body.request?.original_utterance ?? "").trim();
}

export function alicePushConfigured(): boolean {
  return Boolean(process.env.YANDEX_DIALOGS_OAUTH_TOKEN);
}

/**
 * Push-уведомление навыка. Работает только для опубликованного навыка
 * и пользователей, разрешивших уведомления. Возвращает false с причиной в логе.
 */
export async function sendAlicePush(
  skillId: string,
  userId: string,
  text: string,
  title = "Планер",
): Promise<boolean> {
  const token = process.env.YANDEX_DIALOGS_OAUTH_TOKEN;
  if (!token || !skillId || !userId) return false;
  const res = await fetch(PUSH_URL(skillId), {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: skillId,
      signed_user_id: userId,
      payload: { title: title.slice(0, 64), text: text.slice(0, 256) },
    }),
  });
  if (!res.ok) {
    console.error(`[alice-push] ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}
