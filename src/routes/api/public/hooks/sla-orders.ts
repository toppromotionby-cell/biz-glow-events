// SLA-уведомление: раз в час ищем заказы в статусе 'new' старше 72 часов,
// и шлём одно Telegram-уведомление администратору с дедупом 24ч через telegram_logs.
//
// Вызывается pg_cron. Авторизация — server-only секрет CRON_SECRET, переданный
// в заголовке `x-cron-secret`. Публичный anon-ключ для аутентификации НЕ
// используется, потому что он бандлится в клиентский JS и доступен всем.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SLA_HOURS = 72;
const DEDUP_HOURS = 24;

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

export const Route = createFileRoute("/api/public/hooks/sla-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Проверяем, что вызов идёт с валидным anon-ключом (apikey-заголовок от pg_cron).
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const slaCutoff = new Date(Date.now() - SLA_HOURS * 3600 * 1000).toISOString();
        const dedupSince = new Date(Date.now() - DEDUP_HOURS * 3600 * 1000).toISOString();

        const { data: overdue, error } = await supabase
          .from("orders")
          .select("id, client_name, client_phone, client_email, total, created_at")
          .eq("status", "new")
          .lt("created_at", slaCutoff)
          .order("created_at", { ascending: true })
          .limit(50);

        if (error) {
          console.error("[sla-orders] orders query failed", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!overdue || overdue.length === 0) {
          return Response.json({ ok: true, overdue: 0, notified: 0 });
        }

        // Дедуп — не отправлять одно и то же чаще раза в 24 часа на конкретный заказ.
        const ids = overdue.map((o) => o.id);
        const { data: recent } = await supabase
          .from("telegram_logs")
          .select("payload")
          .eq("payload->>kind", "sla_overdue")
          .in("payload->>order_id", ids)
          .gte("created_at", dedupSince);

        const alreadyNotified = new Set(
          (recent ?? [])
            .map((r) => (r.payload as Record<string, unknown> | null)?.order_id)
            .filter((v): v is string => typeof v === "string"),
        );

        const toNotify = overdue.filter((o) => !alreadyNotified.has(o.id));
        let notified = 0;

        for (const o of toNotify) {
          const ageH = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 3600000);
          const text =
            `<b>⏰ Просроченная заявка (${ageH}ч в статусе new)</b>\n` +
            `Имя: ${tgEsc(o.client_name)}\n` +
            (o.client_phone ? `Тел: ${tgEsc(o.client_phone)}\n` : "") +
            (o.client_email ? `Email: ${tgEsc(o.client_email)}\n` : "") +
            `Сумма: ${Math.round(Number(o.total ?? 0))} BYN\n` +
            `ID: ${o.id}`;
          const tg = await notifyTelegram(text);
          await supabase.from("telegram_logs").insert({
            status: tg.ok ? "sent" : "skipped",
            error: tg.error ?? null,
            payload: { kind: "sla_overdue", order_id: o.id, age_hours: ageH, text },
          });
          if (tg.ok) notified += 1;
        }

        return Response.json({ ok: true, overdue: overdue.length, notified });
      },
    },
  },
});
