// Server functions for the in-site support chat.
// User sends a message → stored in DB and forwarded to Telegram admin chat.
// Admin reply in Telegram → handled by /api/public/telegram-support webhook.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function tgEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendToTelegram(text: string): Promise<{ message_id: number | null }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const tgKey = process.env.TELEGRAM_API_KEY;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!lovableKey || !tgKey || !chatId) return { message_id: null };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) return { message_id: null };
    const data = await res.json() as { result?: { message_id?: number } };
    return { message_id: data.result?.message_id ?? null };
  } catch {
    return { message_id: null };
  }
}

async function ensureThread(userId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("support_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabaseAdmin
    .from("support_threads")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error || !created) throw new Error("thread create failed");
  return created.id as string;
}

export const getMyThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const threadId = await ensureThread(userId);
    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("id, sender, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(200);
    return { threadId, messages: messages ?? [] };
  });

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ content: z.string().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const threadId = await ensureThread(userId);

    // fetch profile for context
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", userId)
      .maybeSingle();

    // insert user message
    const { data: inserted, error } = await supabaseAdmin
      .from("support_messages")
      .insert({ thread_id: threadId, sender: "user", content: data.content })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("insert failed");

    // forward to Telegram
    const header = `💬 <b>Новое сообщение в чат</b>\n👤 ${tgEsc(profile?.full_name || "")} ${profile?.email ? `&lt;${tgEsc(profile.email)}&gt;` : ""}\n📞 ${tgEsc(profile?.phone || "—")}\n🧵 thread: <code>${threadId}</code>\n\n${tgEsc(data.content)}\n\n<i>Ответьте на это сообщение, чтобы написать клиенту.</i>`;
    const tg = await sendToTelegram(header);

    // update thread + record telegram message id (used for reply mapping)
    await supabaseAdmin.from("support_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
    if (tg.message_id) {
      await supabaseAdmin
        .from("support_messages")
        .update({ telegram_message_id: tg.message_id })
        .eq("id", inserted.id);
    }
    return { ok: true, threadId };
  });
