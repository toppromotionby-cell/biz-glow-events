// Telegram webhook: admin replies in Telegram → write into the user's thread.
// Expectation: admin replies (reply_to_message) to the bot's notification, which
// carries telegram_message_id we previously stored on the user's support_message.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export const Route = createFileRoute("/api/public/telegram-support")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = process.env.TELEGRAM_API_KEY;
        if (!tgKey) return new Response("not configured", { status: 500 });
        const expected = deriveSecret(tgKey);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("unauthorized", { status: 401 });

        const update = await request.json().catch(() => null) as
          | {
              message?: {
                text?: string;
                chat?: { id?: number };
                voice?: { file_id?: string };
                audio?: { file_id?: string };
                reply_to_message?: { message_id?: number };
              };
              callback_query?: { id?: string; data?: string; message?: { message_id?: number; chat?: { id?: number } } };
            }
          | null;
        const msg = update?.message;
        const text = msg?.text?.trim();
        const replyToId = msg?.reply_to_message?.message_id;

        // Не ответ на уведомление поддержки — отдаём планеру-ассистенту.
        if (!replyToId) {
          try {
            const { handleCallback, handleTelegramText, handleTelegramVoice } = await import("@/lib/calendar/agent.server");
            const cb = update?.callback_query;
            if (cb?.id && cb.data && cb.message?.chat?.id && cb.message.message_id) {
              await handleCallback(supabaseAdmin as never, cb.message.chat.id, cb.message.message_id, cb.id, cb.data);
              return Response.json({ ok: true, planner: true });
            }
            const chatId = msg?.chat?.id;
            const fileId = msg?.voice?.file_id ?? msg?.audio?.file_id;
            if (chatId && fileId) {
              await handleTelegramVoice(supabaseAdmin as never, chatId, fileId);
              return Response.json({ ok: true, planner: true });
            }
            if (chatId && text) {
              await handleTelegramText(supabaseAdmin as never, chatId, text, { source: "telegram" });
              return Response.json({ ok: true, planner: true });
            }
          } catch (e) {
            console.error("[planner-webhook] failed", e);
          }
          return Response.json({ ok: true, ignored: true });
        }
        if (!text) return Response.json({ ok: true, ignored: true });

        // find thread by the original telegram_message_id
        const { data: orig } = await supabaseAdmin
          .from("support_messages")
          .select("thread_id")
          .eq("telegram_message_id", replyToId)
          .maybeSingle();
        if (!orig?.thread_id) return Response.json({ ok: true, no_thread: true });

        await supabaseAdmin.from("support_messages").insert({
          thread_id: orig.thread_id,
          sender: "admin",
          content: text.slice(0, 4000),
        });
        await supabaseAdmin
          .from("support_threads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", orig.thread_id);

        return Response.json({ ok: true });
      },
    },
  },
});
