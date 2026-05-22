// submitOrder: создаёт заявку с позициями. Возвращает id заявки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EntityType = z.enum(["zones", "tech_equipment", "services", "production_items"]);

const ItemSchema = z.object({
  entity_type: EntityType,
  entity_id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  price: z.number().min(0).max(10_000_000),
  qty: z.number().int().min(1).max(999),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const OrderSchema = z.object({
  client_name: z.string().min(2).max(120),
  client_phone: z.string().min(5).max(40),
  client_email: z.string().email().max(160),
  client_company: z.string().max(160).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_term: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(120).optional().nullable(),
  consent_pd: z.literal(true),
  items: z.array(ItemSchema).min(1).max(50),
});

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
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

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => OrderSchema.parse(input))
  .handler(async ({ data }) => {
    const total = data.items.reduce((s, i) => s + i.qty * i.price, 0);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_email: data.client_email,
        client_company: data.client_company ?? null,
        event_date: data.event_date ?? null,
        notes: data.notes ?? null,
        source: data.source ?? "cart",
        utm_source: data.utm_source ?? null,
        utm_medium: data.utm_medium ?? null,
        utm_campaign: data.utm_campaign ?? null,
        utm_term: data.utm_term ?? null,
        utm_content: data.utm_content ?? null,
        status: "new",
        total,
      })
      .select("id")
      .single();

    if (error || !order) throw new Error(`Не удалось создать заявку: ${error?.message ?? "unknown"}`);

    const rows = data.items.map((i) => ({
      order_id: order.id,
      entity_type: i.entity_type,
      entity_id: isUuid(i.entity_id) ? i.entity_id : null,
      title: i.title,
      price: i.price,
      qty: i.qty,
      start_date: i.start_date ?? data.event_date ?? null,
      end_date: i.end_date ?? data.event_date ?? null,
      meta: isUuid(i.entity_id) ? {} : { slug: i.entity_id },
    }));

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(rows);
    if (itemsErr) throw new Error(`Не удалось сохранить позиции: ${itemsErr.message}`);

    await supabaseAdmin.from("order_timeline").insert({
      order_id: order.id,
      event: "order_created",
      payload: { items: data.items.length, total },
    });

    const lines = data.items.map((i) => `• ${i.title} × ${i.qty} — ${i.price * i.qty} BYN`).join("\n");
    const text =
      `<b>Новая заявка (корзина)</b>\n` +
      `Имя: ${data.client_name}\n` +
      `Тел: ${data.client_phone}\n` +
      `Email: ${data.client_email}\n` +
      (data.client_company ? `Компания: ${data.client_company}\n` : "") +
      (data.event_date ? `Дата: ${data.event_date}\n` : "") +
      `\n${lines}\n\n<b>Итого: ${total} BYN</b>` +
      (data.notes ? `\n\nКомментарий: ${data.notes}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      order_id: order.id,
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { text },
    });

    return { id: order.id, total };
  });
