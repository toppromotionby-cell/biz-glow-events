// Вебхук диджей-бота: текст, голос, кнопки. Секрет — X-Telegram-Bot-Api-Secret-Token.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { handleCallback, handleText, handleVoice } from "@/lib/dj/telegram/agent.server";
import { djTgKey } from "@/lib/dj/telegram/transport.server";
import { claimUpdate } from "@/lib/dj/telegram/store.server";

function deriveSecret(key: string): string {
  return createHash("sha256").update(`dj-telegram-webhook:${key}`).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

interface TgUpdate {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    from?: { username?: string; first_name?: string };
    text?: string;
    caption?: string;
    voice?: { file_id?: string };
    audio?: { file_id?: string };
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: { message_id?: number; chat?: { id?: number } };
  };
}

export const Route = createFileRoute("/api/public/dj/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = djTgKey();
        if (!key) return new Response("not configured", { status: 503 });
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, deriveSecret(key))) return new Response("unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as TgUpdate | null;
        if (!update) return Response.json({ ok: true, ignored: true });

        try {
          // Идемпотентность: Telegram ретраит доставку.
          if (typeof update.update_id === "number" && !(await claimUpdate(update.update_id))) {
            return Response.json({ ok: true, duplicate: true });
          }
          const cb = update.callback_query;
          if (cb?.id && cb.data && cb.message?.chat?.id) {
            await handleCallback(cb.message.chat.id, cb.id, cb.data, cb.message.message_id);
            return Response.json({ ok: true });
          }
          const msg = update.message;
          const chatId = msg?.chat?.id;
          if (!chatId) return Response.json({ ok: true, ignored: true });
          const fileId = msg?.voice?.file_id ?? msg?.audio?.file_id;
          if (fileId) await handleVoice(chatId, fileId);
          else if (msg?.text) await handleText(chatId, msg.text, msg.from);
        } catch (e) {
          console.error("[dj-telegram-webhook] failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
