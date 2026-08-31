// Telegram-вебхук планера: текст, голос и нажатия кнопок.
// Авторизация — секрет из заголовка X-Telegram-Bot-Api-Secret-Token.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { admin } from "@/lib/calendar/store.server";
import { handleCallback, handleTelegramText, handleTelegramVoice } from "@/lib/calendar/agent.server";

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

interface TgUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
    voice?: { file_id?: string };
    audio?: { file_id?: string };
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: { message_id?: number; chat?: { id?: number } };
  };
}

export const Route = createFileRoute("/api/public/planner/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = plannerTgKey();
        if (!tgKey) return new Response("not configured", { status: 503 });
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, deriveSecret(tgKey))) return new Response("unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as TgUpdate | null;
        if (!update) return Response.json({ ok: true, ignored: true });

        try {
          const db = await admin();
          const cb = update.callback_query;
          if (cb?.id && cb.data && cb.message?.chat?.id && cb.message.message_id) {
            await handleCallback(db, cb.message.chat.id, cb.message.message_id, cb.id, cb.data);
            return Response.json({ ok: true });
          }
          const msg = update.message;
          const chatId = msg?.chat?.id;
          if (!chatId) return Response.json({ ok: true, ignored: true });
          const fileId = msg?.voice?.file_id ?? msg?.audio?.file_id;
          if (fileId) {
            await handleTelegramVoice(db, chatId, fileId);
          } else if (msg?.text) {
            await handleTelegramText(db, chatId, msg.text, { source: "telegram" });
          }
        } catch (e) {
          // Telegram ретраит при 5xx — отвечаем 200, ошибку пишем в лог.
          console.error("[planner-webhook] failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
