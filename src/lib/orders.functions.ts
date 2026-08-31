import { assertPermission } from "@/lib/authz";
// submitOrder: создаёт заявку с позициями. Возвращает id заявки.
// SECURITY:
//  - цены позиций перепроверяются из каталога (pricing.from) — клиентские игнорируются;
//  - HTML-поля в Telegram-уведомлениях экранируются;
//  - инкремент used_count промокода выполняется атомарно только при создании заказа.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyAdminOrderEmail, notifyClientOrderConfirmedEmail, buildClientOrderConfirmedEmail, stripActiveLinks, sendAccountAccessEmail } from "@/lib/admin-email.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionalSupabaseAuth } from "@/lib/optional-auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const EntityType = z.enum(["zones", "tech_equipment", "services", "production_items"]);

const ItemSchema = z.object({
  entity_type: EntityType,
  entity_id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  price: z.number().min(0).max(10_000_000), // hint only — server re-computes
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
  event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  promo_code: z.string().min(2).max(40).optional().nullable(),
  // Реквизиты компании (для подготовки документов)
  company_legal_name: z.string().max(240).optional().nullable(),
  company_unp: z.string().max(40).optional().nullable(),
  company_address: z.string().max(300).optional().nullable(),
  company_bank: z.string().max(300).optional().nullable(),
  contact_person_name: z.string().max(160).optional().nullable(),
  contact_person_position: z.string().max(160).optional().nullable(),
  acting_basis: z.string().max(200).optional().nullable(),
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

function tgEsc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Извлекает каноническую базовую цену из pricing JSON.
function extractBasePrice(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== "object") return null;
  const p = pricing as Record<string, unknown>;
  for (const key of ["from", "base", "price", "value", "amount"]) {
    const v = p[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

type ResolvedItem = {
  entity_type: string;
  entity_id: string;
  title: string;
  price: number;
  client_price: number;
  qty: number;
  start_date: string | null;
  end_date: string | null;
  discrepancy: boolean;
};

async function resolveServerPrice(
  entity_type: string,
  entity_id: string,
): Promise<{ price: number | null; title: string | null }> {
  if (!isUuid(entity_id)) {
    // slug-based: ищем по slug
    const { data } = await supabaseAdmin
      .from(entity_type as "zones")
      .select("title, pricing")
      .eq("slug", entity_id)
      .eq("published", true)
      .maybeSingle();
    if (!data) return { price: null, title: null };
    return { price: extractBasePrice(data.pricing), title: data.title };
  }
  const { data } = await supabaseAdmin
    .from(entity_type as "zones")
    .select("title, pricing")
    .eq("id", entity_id)
    .eq("published", true)
    .maybeSingle();
  if (!data) return { price: null, title: null };
  return { price: extractBasePrice(data.pricing), title: data.title };
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
  .middleware([optionalSupabaseAuth])
  .inputValidator((input) => OrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 0. Серверная валидация даты — не позволяем прошлые даты.
    if (data.event_date) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const ev = new Date(`${data.event_date}T00:00:00Z`);
      if (Number.isFinite(ev.getTime()) && ev.getTime() < today.getTime()) {
        throw new Error("Дата мероприятия не может быть в прошлом.");
      }
    }
    if (data.event_end_date && data.event_date && data.event_end_date < data.event_date) {
      throw new Error("Дата окончания не может быть раньше даты начала.");
    }
    for (const i of data.items) {
      if (i.start_date && i.end_date && i.end_date < i.start_date) {
        throw new Error("Некорректные даты позиции.");
      }
    }

    // 1. Серверная перепроверка цен — клиентские price используются только как hint.
    const resolved: ResolvedItem[] = await Promise.all(
      data.items.map(async (i) => {
        const { price: canonical, title } = await resolveServerPrice(i.entity_type, i.entity_id);
        const finalPrice = canonical ?? i.price;
        const discrepancy =
          canonical == null ||
          (canonical > 0 && Math.abs(canonical - i.price) / canonical > 0.2);
        return {
          entity_type: i.entity_type,
          entity_id: i.entity_id,
          title: title ?? i.title,
          price: finalPrice,
          client_price: i.price,
          qty: i.qty,
          start_date: i.start_date ?? null,
          end_date: i.end_date ?? null,
          discrepancy,
        };
      }),
    );

    const total = resolved.reduce((s, i) => s + i.qty * i.price, 0);
    const hasDiscrepancy = resolved.some((r) => r.discrepancy);

    const requisitesBlock = [
      data.company_legal_name ? `Юр. название: ${data.company_legal_name}` : "",
      data.company_unp ? `УНП: ${data.company_unp}` : "",
      data.company_address ? `Юр. адрес: ${data.company_address}` : "",
      data.company_bank ? `Банк. реквизиты: ${data.company_bank}` : "",
      data.contact_person_name ? `Ответственное лицо: ${data.contact_person_name}` : "",
      data.contact_person_position ? `Должность: ${data.contact_person_position}` : "",
      data.acting_basis ? `Действует на основании: ${data.acting_basis}` : "",
    ].filter(Boolean).join("\n");

    // Внутренние заметки (только для менеджера): период, реквизиты, расхождения.
    const internalNotes = [
      data.event_end_date && data.event_end_date !== data.event_date
        ? `Период мероприятия: ${data.event_date ?? "?"} — ${data.event_end_date}`
        : "",
      requisitesBlock ? `--- Реквизиты ---\n${requisitesBlock}` : "",
      hasDiscrepancy ? "⚠ Ценовое расхождение с каталогом — проверить!" : "",
    ].filter(Boolean).join("\n\n") || null;

    // 2. Создаём заказ.
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId ?? null,
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_email: data.client_email,
        client_company: data.client_company ?? data.company_legal_name ?? null,
        event_date: data.event_date ?? null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        source: data.source ?? "cart",
        utm_source: data.utm_source ?? null,
        utm_medium: data.utm_medium ?? null,
        utm_campaign: data.utm_campaign ?? null,
        utm_term: data.utm_term ?? null,
        utm_content: data.utm_content ?? null,
        status: "new",
        total,
      })
      .select("id, order_number, clarification_token")
      .single();


    if (error || !order) {
      console.error("[submitOrder] DB error:", error);
      throw new Error("Не удалось создать заявку. Попробуйте ещё раз.");
    }

    // 2b. Внутренние заметки — staff-only таблица, клиенту недоступна.
    if (internalNotes) {
      await supabaseAdmin
        .from("order_internal_notes")
        .upsert({ order_id: order.id, notes: internalNotes }, { onConflict: "order_id" });
    }

    // 3. Позиции — если упало, откатываем заказ, чтобы не оставлять «голый» order.
    const rows = resolved.map((i) => ({
      order_id: order.id,
      entity_type: i.entity_type,
      entity_id: isUuid(i.entity_id) ? i.entity_id : null,
      title: i.title,
      price: i.price,
      qty: i.qty,
      start_date: i.start_date ?? data.event_date ?? null,
      end_date: i.end_date ?? data.event_end_date ?? data.event_date ?? null,
      meta: {
        ...(isUuid(i.entity_id) ? {} : { slug: i.entity_id }),
        ...(i.discrepancy ? { client_price: i.client_price, server_price: i.price } : {}),
      },
    }));

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(rows);
    if (itemsErr) {
      console.error("[submitOrder] items insert error:", itemsErr);
      // Rollback: удаляем «голый» заказ
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("Не удалось сохранить позиции заявки.");
    }

    // Сигнал спроса: заказанные позиции поднимаются в рекомендациях и калькуляторе.
    try {
      const { recordDemand } = await import("@/lib/demand.server");
      await recordDemand(
        rows
          .filter((r) => r.entity_id)
          .map((r) => ({
            entity_type: r.entity_type as "zones",
            entity_id: r.entity_id as string,
            event: "order" as const,
            qty: r.qty,
          })),
      );
    } catch (err) {
      console.error("[submitOrder] demand signal failed:", err);
    }


    // 4. Промокод — инкрементируем ТОЛЬКО после успешного создания позиций.
    let promoApplied: string | null = null;
    if (data.promo_code) {
      const code = data.promo_code.trim().toUpperCase();
      const { data: upd } = await supabaseAdmin.rpc("increment_promo_usage", { p_code: code });
      if (upd && upd.length > 0) {
        promoApplied = code;
        // Дописываем промокод во внутренние заметки.
        await supabaseAdmin
          .from("order_internal_notes")
          .upsert({
            order_id: order.id,
            notes: [internalNotes, `Промокод: ${promoApplied}`].filter(Boolean).join("\n\n"),
          }, { onConflict: "order_id" });
      }
    }


    await supabaseAdmin.from("order_timeline").insert({
      order_id: order.id,
      event: "order_created",
      payload: { items: resolved.length, total, promo: promoApplied, discrepancy: hasDiscrepancy },
    });

    // База знаний: контакт и позиции заявки становятся подсказками в КП/сметах.
    try {
      const { harvestFromOrder } = await import("@/lib/doc-knowledge.server");
      await harvestFromOrder(
        {
          client_name: data.client_name,
          client_company: data.client_company ?? data.company_legal_name ?? "",
          client_phone: data.client_phone,
          client_email: data.client_email,
          notes: data.notes ?? "",
        },
        resolved.map((i) => ({ entity_type: i.entity_type, title: i.title, price: i.price })),
      );
    } catch (e) {
      console.error("[submitOrder] knowledge harvest failed:", e);
    }


    const lines = resolved.map((i) => `• ${tgEsc(i.title)} × ${i.qty} — ${i.price * i.qty} BYN`).join("\n");

    const tgRequisites = requisitesBlock
      ? `\n\n<b>Реквизиты:</b>\n${tgEsc(requisitesBlock)}`
      : "";
    const text =
      `<b>Новая заявка (корзина)</b>\n` +
      `Имя: ${tgEsc(data.client_name)}\n` +
      `Тел: ${tgEsc(data.client_phone)}\n` +
      `Email: ${tgEsc(data.client_email)}\n` +
      (data.client_company ? `Компания: ${tgEsc(data.client_company)}\n` : "") +
      (data.event_date ? `Дата: ${tgEsc(data.event_date)}\n` : "") +
      `\n${lines}\n\n<b>Итого: ${total} BYN</b>` +
      (promoApplied ? `\nПромокод: ${tgEsc(promoApplied)}` : "") +
      (hasDiscrepancy ? `\n⚠ <b>Ценовое расхождение</b>` : "") +
      tgRequisites +
      (data.notes ? `\n\nКомментарий: ${tgEsc(data.notes)}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      order_id: order.id,
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { text },
    });

    // Email-фолбэк: если Telegram не настроен/упал — шлём уведомление на ADMIN_EMAIL.
    if (!tg.ok) {
      await notifyAdminOrderEmail({
        orderId: order.id,
        orderNumber: order.order_number,
        clientName: data.client_name,
        clientPhone: data.client_phone,
        clientEmail: data.client_email,
        clientCompany: data.client_company ?? null,
        total,
        eventDate: data.event_date ?? null,
        source: "cart",
        notes: data.notes ?? null,
        items: resolved.map(i => ({ title: i.title, qty: i.qty, price: i.price })),
      }).catch((e) => console.error("[submitOrder] email fallback failed:", e));
    }

    // 5. Личный кабинет: если заказ оформлен гостем — заводим аккаунт по email
    //    и отправляем данные для входа. Сбой не влияет на созданный заказ.
    if (!userId) {
      try {
        const { ensureClientAccount } = await import("@/lib/account-provision.server");
        const acc = await ensureClientAccount({
          email: data.client_email,
          fullName: data.client_name,
          phone: data.client_phone,
          company: data.client_company ?? data.company_legal_name ?? null,
        });
        if (acc.userId) {
          await supabaseAdmin.from("orders").update({ user_id: acc.userId }).eq("id", order.id);
          await supabaseAdmin.from("order_timeline").insert({
            order_id: order.id,
            event: acc.created ? "account_created" : "account_linked",
            payload: { email: data.client_email },
          });
          // Антидубль: одно письмо с доступом на заказ и не чаще раза в 15 минут
          // на адрес — повторные заказы не спамят и не «палят» пароль лишний раз.
          const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const { data: recent } = await supabaseAdmin
            .from("email_send_log")
            .select("id, message_id, created_at")
            .eq("template_name", "account-access")
            .eq("recipient_email", data.client_email.trim().toLowerCase())
            .or(`created_at.gte.${since},message_id.eq.account-access-${order.id}`)
            .limit(1);
          if (recent && recent.length > 0) {
            console.warn("[submitOrder] account access email skipped (duplicate/cooldown)");
          } else {
            await sendAccountAccessEmail({
              to: data.client_email,
              clientName: data.client_name,
              orderId: order.id,
              orderNumber: order.order_number,
              tempPassword: acc.tempPassword,
            });
          }
        }
      } catch (e) {
        console.error("[submitOrder] account provisioning failed:", e);
      }
    }

    return { id: order.id, total, token: order.clarification_token ?? null };
  });

// ===== Гостевой кабинет заказа по токену из письма/ссылки =====

export const getOrderByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, total, paid, event_date, created_at, client_name, client_email, notes")
      .eq("clarification_token", data.token)
      .maybeSingle();
    if (!order) return null;

    const [{ data: items }, { data: timeline }, { data: attachments }, { data: quotes }] = await Promise.all([
      supabaseAdmin.from("order_items").select("id, title, qty, price, start_date, end_date").eq("order_id", order.id),
      supabaseAdmin.from("order_timeline").select("id, event, created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
      supabaseAdmin.from("order_attachments").select("id, kind, file_name, file_path, created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("quotes").select("id, quote_number, title, public_token, sent_at").eq("order_id", order.id).not("sent_at", "is", null),
    ]);

    const documents: { id: string; name: string; url: string }[] = [];
    for (const a of attachments ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("order-attachments")
        .createSignedUrl(a.file_path, 60 * 60);
      if (signed?.signedUrl) {
        documents.push({ id: a.id, name: a.file_name || a.kind, url: signed.signedUrl });
      }
    }
    for (const q of quotes ?? []) {
      documents.push({
        id: q.id,
        name: `Коммерческое предложение ${q.quote_number ?? ""}`.trim(),
        url: `/kp/${q.public_token}`,
      });
    }

    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status as string,
      total: Number(order.total ?? 0),
      paid: Number(order.paid ?? 0),
      eventDate: order.event_date,
      createdAt: order.created_at,
      clientName: order.client_name,
      clientEmail: order.client_email,
      notes: order.notes,
      items: (items ?? []).map((i) => ({
        id: i.id, title: i.title, qty: i.qty, price: Number(i.price ?? 0),
        start_date: i.start_date, end_date: i.end_date,
      })),
      timeline: (timeline ?? []).map((t) => ({ id: t.id, event: t.event, created_at: t.created_at })),
      documents,
    };
  });



// ===== User self-service: edit / cancel own order =====

const EDITABLE_STATUSES = ["new", "consultation", "estimate"];

const UpdateOrderSchema = z.object({
  id: z.string().uuid(),
  client_name: z.string().min(2).max(120),
  client_phone: z.string().min(5).max(40),
  client_email: z.string().email().max(160),
  client_company: z.string().max(160).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateOwnOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, user_id, status, client_name, client_phone, client_email, client_company, event_date, notes, total")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !existing) throw new Error("Заявка не найдена");
    if (existing.user_id !== userId) throw new Error("Нет доступа к этой заявке");
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new Error("Заявку нельзя редактировать на текущем статусе");
    }

    if (data.event_date) {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const ev = new Date(`${data.event_date}T00:00:00Z`);
      if (Number.isFinite(ev.getTime()) && ev.getTime() < today.getTime()) {
        throw new Error("Дата мероприятия не может быть в прошлом.");
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_email: data.client_email,
        client_company: data.client_company ?? null,
        event_date: data.event_date ?? null,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (updErr) throw new Error("Не удалось сохранить изменения");

    await supabaseAdmin.from("order_timeline").insert({
      order_id: data.id,
      actor_id: userId,
      event: "order_edited_by_client",
      payload: {
        before: {
          client_name: existing.client_name,
          client_phone: existing.client_phone,
          client_email: existing.client_email,
          client_company: existing.client_company,
          event_date: existing.event_date,
          notes: existing.notes,
        },
        after: {
          client_name: data.client_name,
          client_phone: data.client_phone,
          client_email: data.client_email,
          client_company: data.client_company ?? null,
          event_date: data.event_date ?? null,
          notes: data.notes ?? null,
        },
      },
    });

    const text =
      `<b>✏ Клиент изменил заявку</b>\n` +
      `ID: <code>${tgEsc(existing.order_number ?? data.id.slice(0, 8))}</code>\n` +
      `Имя: ${tgEsc(data.client_name)}\n` +
      `Тел: ${tgEsc(data.client_phone)}\n` +
      `Email: ${tgEsc(data.client_email)}\n` +
      (data.client_company ? `Компания: ${tgEsc(data.client_company)}\n` : "") +
      (data.event_date ? `Дата: ${tgEsc(data.event_date)}\n` : "") +
      `\n<b>Итого: ${Number(existing.total ?? 0)} BYN</b>` +
      (data.notes ? `\n\nКомментарий: ${tgEsc(data.notes)}` : "");

    const tg = await notifyTelegram(text);
    await supabaseAdmin.from("telegram_logs").insert({
      order_id: data.id,
      status: tg.ok ? "sent" : "skipped",
      error: tg.error ?? null,
      payload: { text, kind: "order_edited_by_client" },
    });

    return { ok: true };
  });

const DeleteOrderSchema = z.object({ id: z.string().uuid() });

export const deleteOwnOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, user_id, status, client_name, client_phone, client_email, client_company, event_date, total")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !existing) throw new Error("Заявка не найдена");
    if (existing.user_id !== userId) throw new Error("Нет доступа к этой заявке");
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new Error("Заявку нельзя удалить на текущем статусе");
    }

    // cascade delete: items, timeline, attachments. RLS bypassed via admin client.
    await supabaseAdmin.from("order_items").delete().eq("order_id", data.id);
    await supabaseAdmin.from("availability").delete().eq("order_id", data.id);
    await supabaseAdmin.from("order_attachments").delete().eq("order_id", data.id);
    await supabaseAdmin.from("order_timeline").delete().eq("order_id", data.id);

    const { error: delErr } = await supabaseAdmin.from("orders").delete().eq("id", data.id);
    if (delErr) throw new Error("Не удалось удалить заявку");

    const text =
      `<b>🗑 Клиент удалил заявку</b>\n` +
      `ID: <code>${tgEsc(existing.order_number ?? existing.id.slice(0, 8))}</code>\n` +
      `Имя: ${tgEsc(existing.client_name)}\n` +
      `Тел: ${tgEsc(existing.client_phone)}\n` +
      `Email: ${tgEsc(existing.client_email)}\n` +
      (existing.client_company ? `Компания: ${tgEsc(existing.client_company)}\n` : "") +
      (existing.event_date ? `Дата: ${tgEsc(existing.event_date)}\n` : "") +
      `Сумма: ${Number(existing.total ?? 0)} BYN`;

    await notifyTelegram(text);
    return { ok: true };
  });

// ===== Admin: delete any order =====

export const deleteOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Verify admin role via security-definer has_role RPC
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Доступ запрещён");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, client_name, client_phone, client_email, client_company, event_date, total")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !existing) throw new Error("Заявка не найдена");

    // cascade cleanup (no FK cascades defined in DB)
    await supabaseAdmin.from("order_items").delete().eq("order_id", data.id);
    await supabaseAdmin.from("availability").delete().eq("order_id", data.id);
    await supabaseAdmin.from("order_attachments").delete().eq("order_id", data.id);
    await supabaseAdmin.from("order_timeline").delete().eq("order_id", data.id);

    const { error: delErr } = await supabaseAdmin.from("orders").delete().eq("id", data.id);
    if (delErr) throw new Error("Не удалось удалить заявку");

    const text =
      `<b>🗑 Админ удалил заявку</b>\n` +
      `ID: <code>${tgEsc(existing.order_number ?? existing.id.slice(0, 8))}</code>\n` +
      `Имя: ${tgEsc(existing.client_name)}\n` +
      `Тел: ${tgEsc(existing.client_phone)}\n` +
      `Email: ${tgEsc(existing.client_email)}\n` +
      (existing.client_company ? `Компания: ${tgEsc(existing.client_company)}\n` : "") +
      (existing.event_date ? `Дата: ${tgEsc(existing.event_date)}\n` : "") +
      `Сумма: ${Number(existing.total ?? 0)} BYN`;

    await notifyTelegram(text);
    return { ok: true };
  });

// ===== Admin: confirm order (status -> confirmed) + email the client =====

type DocKind = "quote" | "invoice" | "contract" | "act";
type DocStatus = { kind: DocKind; label: string; ok: boolean; stage?: "build" | "upload" | "sign"; error?: string; url?: string };
type OrderPdfAttachment = { kind: DocKind; label: string; filename: string; bytes: Uint8Array };

// Возвращает PDF-байты документов (для приложения к письму клиенту) +
// статусы загрузки в Storage (для админской истории / повторного скачивания).
async function generateAndUploadOrderDocuments(
  orderId: string,
): Promise<{ pdfs: OrderPdfAttachment[]; statuses: DocStatus[] }> {
  const statuses: DocStatus[] = [];
  const pdfs: OrderPdfAttachment[] = [];
  const fallbackLabels: Record<DocKind, string> = { quote: "КП", invoice: "Счёт", contract: "Договор", act: "Акт" };
  try {
    const [{ DOC_LABELS }, { loadDocumentSettings }, { buildOrderDocPdf, buildAttachmentFilename }] = await Promise.all([
      import("@/lib/documents/build.server"),
      import("@/lib/documents/render.server"),
      import("@/lib/documents/pdf.server"),
    ]);

    const [{ data: order }, { data: items }, settings] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_number, client_name, client_company, client_phone, client_email, event_date, notes, paid")
        .eq("id", orderId)
        .maybeSingle(),
      supabaseAdmin.from("order_items").select("title, qty, price").eq("order_id", orderId),
      loadDocumentSettings(supabaseAdmin as never),
    ]);
    if (!order) {
      for (const kind of ["quote", "invoice", "contract", "act"] as const) {
        statuses.push({ kind, label: DOC_LABELS[kind], ok: false, stage: "build", error: "Заявка не найдена" });
      }
      return { pdfs: [], statuses };
    }

    const itemRows = (items ?? []).map((i) => ({
      title: String(i.title),
      qty: Number(i.qty ?? 1),
      price: Number(i.price ?? 0),
    }));

    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    for (const kind of ["quote", "invoice", "contract", "act"] as const) {
      const label = DOC_LABELS[kind] ?? fallbackLabels[kind];
      try {
        let bytes: Uint8Array;
        try {
          bytes = await buildOrderDocPdf(kind, order as never, itemRows, settings);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "build error";
          console.error("[order-docs] build failed", kind, msg);
          statuses.push({ kind, label, ok: false, stage: "build", error: msg });
          continue;
        }
        const filename = buildAttachmentFilename(kind, order as never);
        const path = `orders/${orderId}/${kind}-${datePart}.pdf`;
        // pdf-lib иногда возвращает Uint8Array поверх большего буфера; берём slice
        // чтобы Blob получил ровно нужные байты.
        const blob = new Blob([bytes.slice()], { type: "application/pdf" });
        const up = await supabaseAdmin.storage
          .from("order-attachments")
          .upload(path, blob, { upsert: true, contentType: "application/pdf" });
        if (up.error) {
          console.error("[order-docs] upload failed", kind, up.error.message);
          statuses.push({ kind, label, ok: false, stage: "upload", error: up.error.message });
          // Письмо клиенту приложим даже если в Storage не записалось.
          pdfs.push({ kind, label, filename, bytes });
          continue;
        }
        const signed = await supabaseAdmin.storage
          .from("order-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        if (signed.error || !signed.data?.signedUrl) {
          const msg = signed.error?.message ?? "no signed url";
          console.error("[order-docs] sign failed", kind, msg);
          statuses.push({ kind, label, ok: false, stage: "sign", error: msg });
          pdfs.push({ kind, label, filename, bytes });
          continue;
        }
        pdfs.push({ kind, label, filename, bytes });
        statuses.push({ kind, label, ok: true, url: signed.data.signedUrl });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        console.error("[order-docs] failed", kind, e);
        statuses.push({ kind, label, ok: false, error: msg });
      }
    }
    return { pdfs, statuses };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fatal";
    console.error("[order-docs] fatal", e);
    if (statuses.length === 0) {
      for (const kind of ["quote", "invoice", "contract", "act"] as const) {
        statuses.push({ kind, label: fallbackLabels[kind], ok: false, error: msg });
      }
    }
    return { pdfs: [], statuses };
  }
}

// Грузит заказ+позиции, шлёт письмо клиенту и пишет результат в order_timeline
// (events: confirmation_email_sent / confirmation_email_failed). Возвращает
// { ok, error? } чтобы вызывающий код мог показать UI-фидбек и предложить ретрай.
async function sendOrderConfirmationEmailAndLog(
  orderId: string,
  actorId: string | null,
  trigger: "confirm" | "resend",
): Promise<{ ok: boolean; error?: string }> {
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, client_name, client_email, client_phone, client_company, event_date, total, paid, notes")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchErr || !order) {
    const msg = fetchErr?.message ?? "order not found";
    console.error("[order-confirm-email] fetch failed", orderId, msg);
    return { ok: false, error: msg };
  }
  if (!order.client_email) {
    const msg = "У клиента не указан email";
    await supabaseAdmin.from("order_timeline").insert({
      order_id: orderId,
      actor_id: actorId,
      event: "confirmation_email_failed",
      payload: { trigger, error: msg },
    });
    return { ok: false, error: msg };
  }

  const { data: items = [] } = await supabaseAdmin
    .from("order_items")
    .select("title, qty, price, entity_type, start_date, end_date")
    .eq("order_id", orderId);

  // Документы (КП/Счёт/Договор/Акт) релевантны только для оформленных заказов.
  // Для статуса `consultation` (запрос на консультацию) их не генерируем —
  // нечего выставлять, пока менеджер не уточнил детали.
  const isInquiry = order.status === "consultation";
  const { pdfs: documentPdfs, statuses: docStatuses } = isInquiry
    ? { pdfs: [] as Array<{ kind: DocKind; label: string; filename: string; bytes: Uint8Array }>, statuses: [] as DocStatus[] }
    : await generateAndUploadOrderDocuments(orderId);
  if (!isInquiry) {
    const docsAllOk = docStatuses.length > 0 && docStatuses.every((s) => s.ok);
    await supabaseAdmin.from("order_timeline").insert({
      order_id: orderId,
      actor_id: actorId,
      event: docsAllOk ? "documents_attached" : "documents_attach_failed",
      payload: { trigger, statuses: docStatuses },
    });
  }

  let res: { ok: boolean; error?: string };
  try {
    res = await notifyClientOrderConfirmedEmail({
      orderId: order.id,
      orderNumber: order.order_number,
      clientName: order.client_name,
      clientEmail: order.client_email,
      clientPhone: order.client_phone,
      clientCompany: order.client_company,
      total: Number(order.total ?? 0),
      paid: Number(order.paid ?? 0),
      status: order.status ?? "confirmed",
      eventDate: order.event_date,
      notes: order.notes,
      items: (items ?? []).map((i) => ({
        title: String(i.title),
        qty: Number(i.qty ?? 1),
        price: Number(i.price ?? 0),
        entityType: i.entity_type ?? null,
        startDate: i.start_date ?? null,
        endDate: i.end_date ?? null,
      })),
      documents: docStatuses
        .filter((s): s is DocStatus & { url: string } => Boolean(s.ok && s.url))
        .map((s) => ({
          label: s.label,
          filename: documentPdfs.find((p) => p.kind === s.kind)?.filename ?? `${s.kind}.pdf`,
          url: s.url,
        })),
    });
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }

  if (res.ok) {
    await supabaseAdmin.from("order_timeline").insert({
      order_id: orderId,
      actor_id: actorId,
      event: "confirmation_email_sent",
      payload: { trigger, recipient: order.client_email },
    });
  } else {
    console.error("[order-confirm-email] send failed", orderId, res.error);
    await supabaseAdmin.from("order_timeline").insert({
      order_id: orderId,
      actor_id: actorId,
      event: "confirmation_email_failed",
      payload: { trigger, recipient: order.client_email, error: res.error ?? "unknown" },
    });
  }
  return res;
}

async function assertAdminOrManager(supabase: SupabaseClient<Database>, userId: string) {
  await assertPermission({ supabase, userId } as never, "orders.manage");
}

export const confirmOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, client_name, client_email, event_date, total")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !order) throw new Error("Заявка не найдена");
    if (order.status === "cancelled") throw new Error("Отменённый заказ нельзя подтвердить");

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "confirmed" as never })
      .eq("id", data.id);
    if (updErr) throw new Error("Не удалось обновить статус");

    await supabaseAdmin.from("order_timeline").insert({
      order_id: data.id,
      actor_id: userId,
      event: "order_confirmed_by_admin",
      payload: { previous_status: order.status },
    });

    const emailRes = await sendOrderConfirmationEmailAndLog(data.id, userId, "confirm");

    const tg =
      `<b>✅ Заказ подтверждён</b>\n` +
      `ID: <code>${tgEsc(order.order_number ?? order.id.slice(0, 8))}</code>\n` +
      `Клиент: ${tgEsc(order.client_name)}\n` +
      `Email: ${tgEsc(order.client_email)}\n` +
      (order.event_date ? `Дата: ${tgEsc(order.event_date)}\n` : "") +
      `Сумма: ${Number(order.total ?? 0)} BYN` +
      (emailRes.ok ? "" : `\n⚠️ Письмо клиенту НЕ отправлено: ${tgEsc(emailRes.error ?? "unknown")}`);
    await notifyTelegram(tg);

    return { ok: true, emailSent: emailRes.ok, emailError: emailRes.ok ? null : emailRes.error ?? null };
  });

// ===== Admin: повторная отправка письма-подтверждения (без смены статуса) =====

export const resendOrderConfirmationEmailAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdminOrManager(supabase, userId);
    const emailRes = await sendOrderConfirmationEmailAndLog(data.id, userId, "resend");
    return { ok: emailRes.ok, emailSent: emailRes.ok, emailError: emailRes.ok ? null : emailRes.error ?? null };
  });

// ===== Admin: предпросмотр клиентского письма подтверждения + PDF-вложения =====

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const previewOrderConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, client_name, client_email, client_phone, client_company, event_date, total, paid, notes")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !order) throw new Error("Заявка не найдена");

    const { data: items = [] } = await supabaseAdmin
      .from("order_items")
      .select("title, qty, price, entity_type, start_date, end_date")
      .eq("order_id", data.id);

    const itemRows = (items ?? []).map((i) => ({
      title: String(i.title),
      qty: Number(i.qty ?? 1),
      price: Number(i.price ?? 0),
      entityType: i.entity_type ?? null,
      startDate: i.start_date ?? null,
      endDate: i.end_date ?? null,
    }));

    // Соберём те же PDF-вложения, что отправятся клиенту (без записи в Storage).
    type PreviewAttachment = { kind: string; label: string; filename: string; base64: string; size: number };
    const attachments: PreviewAttachment[] = [];
    const isInquiry = order.status === "consultation";
    if (!isInquiry) {
      try {
        const [{ loadDocumentSettings }, { buildOrderDocPdf, buildAttachmentFilename }, { DOC_LABELS }] = await Promise.all([
          import("@/lib/documents/render.server"),
          import("@/lib/documents/pdf.server"),
          import("@/lib/documents/build.server"),
        ]);
        const settings = await loadDocumentSettings(supabaseAdmin as never);
        const buildItems = itemRows.map((i) => ({ title: i.title, qty: i.qty, price: i.price }));
        for (const kind of ["quote", "invoice", "contract", "act"] as const) {
          try {
            const bytes = await buildOrderDocPdf(kind, order as never, buildItems, settings);
            attachments.push({
              kind,
              label: DOC_LABELS[kind] ?? kind,
              filename: buildAttachmentFilename(kind, order as never),
              base64: uint8ToBase64(bytes),
              size: bytes.byteLength,
            });
          } catch (e) {
            console.error("[email-preview] pdf build failed", kind, e);
          }
        }
      } catch (e) {
        console.error("[email-preview] pdf pipeline failed", e);
      }
    }

    const { subject, html } = buildClientOrderConfirmedEmail({
      orderId: order.id,
      orderNumber: order.order_number,
      clientName: order.client_name,
      clientEmail: order.client_email ?? "",
      clientPhone: order.client_phone,
      clientCompany: order.client_company,
      total: Number(order.total ?? 0),
      paid: Number(order.paid ?? 0),
      status: order.status ?? "confirmed",
      eventDate: order.event_date,
      notes: order.notes,
      items: itemRows,
      // В превью показываем тот же блок «Документы по заказу» со ссылками-плейсхолдерами,
      // чтобы админ видел финальный вид письма. Реальные подписанные URL генерируются при отправке.
      documents: attachments.map((a) => ({
        label: a.label,
        filename: a.filename,
        url: `#preview-${a.kind}`,
      })),
    });

    // Чистим тело письма от активных ссылок ровно так же, как при отправке.
    const sanitized = stripActiveLinks(html);

    return { subject, html: sanitized, to: order.client_email ?? null, attachments };
  });



