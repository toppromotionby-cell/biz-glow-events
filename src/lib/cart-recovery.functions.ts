// Уведомление о брошенной корзине — клиент вызывает спустя ~1 час бездействия.
// Шлёт сообщение в Telegram админу + (если нет TG) email-фолбэк.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  title: z.string().min(1).max(240),
  qty: z.number().int().min(1).max(999),
  price: z.number().min(0).max(10_000_000),
});

const Schema = z.object({
  cart_hash: z.string().min(4).max(80),
  client_name: z.string().max(160).optional().nullable(),
  client_email: z.string().email().max(160).optional().nullable(),
  client_phone: z.string().max(40).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  items: z.array(ItemSchema).min(1).max(50),
  total: z.number().min(0).max(100_000_000),
  page_url: z.string().max(500).optional().nullable(),
});

function tgEsc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const tgKey = process.env.TELEGRAM_API_KEY;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!lovableKey || !tgKey || !chatId) return { ok: false, error: "telegram not configured" };
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
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export const notifyAbandonedCart = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    // Дедуп: если для этого cart_hash уже было уведомление за последние 24 часа — игнор.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: prev } = await supabaseAdmin
      .from("telegram_logs")
      .select("id")
      .eq("payload->>kind", "abandoned_cart")
      .eq("payload->>cart_hash", data.cart_hash)
      .gte("created_at", since)
      .limit(1);
    if (prev && prev.length > 0) return { ok: true, deduped: true };

    const lines = data.items
      .map((i) => `• ${tgEsc(i.title)} × ${i.qty} — ${Math.round(i.price * i.qty)} BYN`)
      .join("\n");

    const text =
      `<b>🛒 Брошенная корзина (1ч)</b>\n` +
      (data.client_name ? `Имя: ${tgEsc(data.client_name)}\n` : "") +
      (data.client_phone ? `Тел: ${tgEsc(data.client_phone)}\n` : "") +
      (data.client_email ? `Email: ${tgEsc(data.client_email)}\n` : "") +
      (!data.client_name && !data.client_email && !data.client_phone ? `Гость\n` : "") +
      `\n${lines}\n\n<b>Сумма: ${Math.round(data.total)} BYN</b>` +
      (data.page_url ? `\n${tgEsc(data.page_url)}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { kind: "abandoned_cart", cart_hash: data.cart_hash, text, user_id: data.user_id ?? null },
    });

    return { ok: tg.ok };
  });
