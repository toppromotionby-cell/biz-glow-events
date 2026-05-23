// Server function: submit a lead from a public form.
// Creates an order in Supabase, logs to order_timeline, and (best-effort) notifies Telegram.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyAdminLeadEmail } from "@/lib/admin-email.server";

const LeadSchema = z.object({
  client_name: z.string().min(2).max(120),
  client_phone: z.string().min(5).max(40),
  client_email: z.string().email().max(160),
  client_company: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_term: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(120).optional().nullable(),
  consent_pd: z.literal(true),
});

// Escape user-supplied text before inserting into Telegram HTML-mode messages.
function tgEsc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  // Lovable note: requires Telegram connector linked (TELEGRAM_API_KEY) +
  // TELEGRAM_CHAT_ID secret. Best-effort, never blocks lead creation.
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

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input) => LeadSchema.parse(input))
  .handler(async ({ data }) => {
    const { consent_pd: _consent, ...payload } = data;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        client_name: payload.client_name,
        client_phone: payload.client_phone,
        client_email: payload.client_email,
        client_company: payload.client_company ?? null,
        notes: payload.notes ?? null,
        event_date: payload.event_date ?? null,
        source: payload.source ?? "website",
        utm_source: payload.utm_source ?? null,
        utm_medium: payload.utm_medium ?? null,
        utm_campaign: payload.utm_campaign ?? null,
        utm_term: payload.utm_term ?? null,
        utm_content: payload.utm_content ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (error || !order) {
      console.error("[submitLead] DB error:", error);
      throw new Error("Не удалось создать заявку. Попробуйте ещё раз.");
    }

    await supabaseAdmin.from("order_timeline").insert({
      order_id: order.id,
      event: "lead_created",
      payload: { source: payload.source ?? "website" },
    });

    const text =
      `<b>Новая заявка</b>\n` +
      `Имя: ${tgEsc(payload.client_name)}\n` +
      `Телефон: ${tgEsc(payload.client_phone)}\n` +
      `Email: ${tgEsc(payload.client_email)}\n` +
      (payload.client_company ? `Компания: ${tgEsc(payload.client_company)}\n` : "") +
      (payload.event_date ? `Дата: ${tgEsc(payload.event_date)}\n` : "") +
      (payload.notes ? `Сообщение: ${tgEsc(payload.notes)}\n` : "") +
      (payload.utm_source ? `UTM: ${tgEsc(payload.utm_source)}/${tgEsc(payload.utm_medium ?? "-")}/${tgEsc(payload.utm_campaign ?? "-")}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      order_id: order.id,
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { text },
    });

    // Email-фолбэк: если Telegram не сработал — шлём уведомление на ADMIN_EMAIL.
    if (!tg.ok) {
      await notifyAdminLeadEmail({
        leadId: order.id,
        clientName: payload.client_name,
        clientPhone: payload.client_phone,
        clientEmail: payload.client_email,
        source: payload.source ?? "website",
        notes: payload.notes ?? null,
      }).catch((e) => console.error("[submitLead] email fallback failed:", e));
    }

    return { id: order.id };
  });
