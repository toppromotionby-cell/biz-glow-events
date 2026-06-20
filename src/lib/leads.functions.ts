// Server functions for "inquiry" flow (consultation request, not a full order).
// Creates an order with status='consultation', notifies admin (Telegram + email)
// with a distinct "ЗАПРОС" template, and emails the client a confirmation +
// link to a clarification form keyed by `orders.clarification_token`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  notifyAdminInquiryEmail,
  notifyClientInquiryReceivedEmail,
} from "@/lib/admin-email.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LeadSchema = z.object({
  client_name: z.string().min(2).max(120),
  client_phone: z.string().min(5).max(40),
  client_email: z.string().email().max(160),
  client_company: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_term: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(120).optional().nullable(),
  consent_pd: z.literal(true),
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

// Backward-compat name; this is now the "submit inquiry / запрос на консультацию" handler.
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
        notes: [
          payload.event_end_date && payload.event_end_date !== payload.event_date
            ? `Период мероприятия: ${payload.event_date ?? "?"} — ${payload.event_end_date}`
            : "",
            payload.notes ?? "",
        ].filter(Boolean).join("\n\n") || null,
        event_date: payload.event_date ?? null,
        source: payload.source ?? "inquiry",
        utm_source: payload.utm_source ?? null,
        utm_medium: payload.utm_medium ?? null,
        utm_campaign: payload.utm_campaign ?? null,
        utm_term: payload.utm_term ?? null,
        utm_content: payload.utm_content ?? null,
        // Запрос на консультацию — это не оформленный заказ. Менеджер должен
        // связаться с клиентом, уточнить детали, и только потом превратить в
        // заказ (см. promoteInquiryToOrder).
        status: "consultation",
      })
      .select("id, clarification_token")
      .single();

    if (error || !order) {
      console.error("[submitLead] DB error:", error);
      throw new Error("Не удалось создать заявку. Попробуйте ещё раз.");
    }

    await supabaseAdmin.from("order_timeline").insert({
      order_id: order.id,
      event: "inquiry_created",
      payload: { source: payload.source ?? "inquiry" },
    });

    const text =
      `<b>🟡 ЗАПРОС на консультацию</b>\n` +
      `<i>Нужно связаться с клиентом и уточнить детали.</i>\n\n` +
      `Имя: ${tgEsc(payload.client_name)}\n` +
      `Телефон: ${tgEsc(payload.client_phone)}\n` +
      `Email: ${tgEsc(payload.client_email)}\n` +
      (payload.client_company ? `Компания: ${tgEsc(payload.client_company)}\n` : "") +
      (payload.event_date ? `Дата: ${tgEsc(payload.event_date)}${payload.event_end_date && payload.event_end_date !== payload.event_date ? ` — ${tgEsc(payload.event_end_date)}` : ""}\n` : "") +
      (payload.notes ? `Сообщение: ${tgEsc(payload.notes)}\n` : "") +
      (payload.utm_source ? `UTM: ${tgEsc(payload.utm_source)}/${tgEsc(payload.utm_medium ?? "-")}/${tgEsc(payload.utm_campaign ?? "-")}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      order_id: order.id,
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { text },
    });

    // Админ-email с явной пометкой «ЗАПРОС» — отличается от уведомления о заказе.
    await notifyAdminInquiryEmail({
      inquiryId: order.id,
      clientName: payload.client_name,
      clientPhone: payload.client_phone,
      clientEmail: payload.client_email,
      clientCompany: payload.client_company ?? null,
      eventDate: payload.event_date ?? null,
      source: payload.source ?? "inquiry",
      notes: payload.notes ?? null,
    }).catch((e) => console.error("[submitLead] admin email failed:", e));

    // Клиенту — короткое письмо «Мы получили ваш запрос» + ссылка на анкету уточнений.
    await notifyClientInquiryReceivedEmail({
      inquiryId: order.id,
      clientName: payload.client_name,
      clientEmail: payload.client_email,
      clarificationToken: (order as { clarification_token: string | null }).clarification_token,
    }).catch((e) => console.error("[submitLead] client email failed:", e));

    return { id: order.id };
  });

// Публичная server fn для дозаполнения анкеты по токену. Не требует auth —
// единственный «секрет» это сам токен (uuid с уникальным индексом).
const ClarificationSchema = z.object({
  token: z.string().uuid(),
  event_format: z.string().max(200).optional().nullable(),
  guests_count: z.string().max(50).optional().nullable(),
  budget: z.string().max(100).optional().nullable(),
  venue: z.string().max(200).optional().nullable(),
  extra: z.string().max(2000).optional().nullable(),
});

export const submitInquiryClarification = createServerFn({ method: "POST" })
  .inputValidator((input) => ClarificationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, notes, client_name")
      .eq("clarification_token", data.token)
      .maybeSingle();
    if (error || !order) throw new Error("Ссылка устарела или недействительна");

    const lines: string[] = ["", "── Ответы из анкеты ──"];
    if (data.event_format) lines.push(`Формат: ${data.event_format}`);
    if (data.guests_count) lines.push(`Гостей: ${data.guests_count}`);
    if (data.budget) lines.push(`Бюджет: ${data.budget}`);
    if (data.venue) lines.push(`Площадка: ${data.venue}`);
    if (data.extra) lines.push(`Доп.: ${data.extra}`);
    const appended = lines.length > 2 ? lines.join("\n") : "";

    await supabaseAdmin
      .from("orders")
      .update({
        notes: [order.notes ?? "", appended].filter(Boolean).join("\n"),
      })
      .eq("id", order.id);

    await supabaseAdmin.from("order_timeline").insert({
      order_id: order.id,
      event: "inquiry_clarified",
      payload: { ...data, token: undefined },
    });

    // Telegram пинг менеджеру: клиент уточнил детали.
    await notifyTelegram(
      `<b>📝 Клиент уточнил запрос</b>\n` +
      `Имя: ${tgEsc(order.client_name)}\n` +
      (data.event_format ? `Формат: ${tgEsc(data.event_format)}\n` : "") +
      (data.guests_count ? `Гостей: ${tgEsc(data.guests_count)}\n` : "") +
      (data.budget ? `Бюджет: ${tgEsc(data.budget)}\n` : "") +
      (data.venue ? `Площадка: ${tgEsc(data.venue)}\n` : "") +
      (data.extra ? `Комментарий: ${tgEsc(data.extra)}` : ""),
    );

    return { ok: true };
  });

// Лукап для страницы анкеты — отдаёт только публично-безопасные поля.
export const getInquiryByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, client_name, event_date, status")
      .eq("clarification_token", data.token)
      .maybeSingle();
    if (!order) return null;
    return {
      clientName: order.client_name,
      eventDate: order.event_date,
      // Был ли уже превращён в заказ?
      promoted: order.status !== "consultation",
    };
  });

// Admin: превратить запрос в заказ (status: consultation → new).
const PromoteSchema = z.object({ id: z.string().uuid() });
export const promoteInquiryToOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PromoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isManager } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isAdmin && !isManager) throw new Error("Доступ запрещён");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "new" as never })
      .eq("id", data.id)
      .eq("status", "consultation");
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("order_timeline").insert({
      order_id: data.id,
      actor_id: userId,
      event: "inquiry_promoted",
      payload: {},
    });
    return { ok: true };
  });
