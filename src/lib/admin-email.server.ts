// Email-фолбэк уведомлений администратору. Используется когда Telegram не настроен
// или вернул ошибку. Рендерит простой HTML и пихает напрямую в pgmq-очередь
// (transactional_emails) через service-role admin клиент.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_NAME = "event-hub.by";
const SENDER_DOMAIN = "z.event-hub.by";
const FROM_DOMAIN = "event-hub.by";
const FROM_ADDRESS = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`;

function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fmtBYN = (n: number) =>
  new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);

async function enqueue(opts: {
  to: string;
  subject: string;
  html: string;
  label: string;
  messageId: string;
}) {
  const payload = {
    to: opts.to,
    from: FROM_ADDRESS,
    sender_domain: SENDER_DOMAIN,
    subject: opts.subject,
    html: opts.html,
    label: opts.label,
    message_id: opts.messageId,
    idempotency_key: opts.messageId,
    purpose: "transactional",
    queued_at: new Date().toISOString(),
  };
  await supabaseAdmin.from("email_send_log").insert({
    message_id: opts.messageId,
    template_name: opts.label,
    recipient_email: opts.to,
    status: "pending",
  });
  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload,
  });
  if (error) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: opts.messageId,
      template_name: opts.label,
      recipient_email: opts.to,
      status: "failed",
      error_message: error.message ?? "enqueue failed",
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type AdminOrderPayload = {
  orderId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientCompany?: string | null;
  total: number;
  eventDate?: string | null;
  source?: string;
  notes?: string | null;
  items: Array<{ title: string; qty: number; price: number }>;
};

export async function notifyAdminOrderEmail(p: AdminOrderPayload): Promise<{ ok: boolean; error?: string }> {
  const to = adminEmail();
  if (!to) return { ok: false, error: "ADMIN_EMAIL not set" };
  const subject = `Новый заказ от ${p.clientName} — ${fmtBYN(p.total)}`;
  const itemsHtml = p.items.map(i =>
    `<li>${escapeHtml(i.title)} — ${i.qty} × ${i.price > 0 ? fmtBYN(i.price) : "по запросу"}</li>`
  ).join("");
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px">
<div style="max-width:600px;margin:0 auto">
  <h1 style="color:#a78bfa;margin:0 0 16px">Новый заказ</h1>
  <p><strong>ID:</strong> ${escapeHtml(p.orderId)}</p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#333"/>
  <h2 style="font-size:18px">Клиент</h2>
  <p>${escapeHtml(p.clientName)}${p.clientCompany ? " · " + escapeHtml(p.clientCompany) : ""}</p>
  <p>Тел: ${escapeHtml(p.clientPhone)}
     · Email: <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:#a78bfa">${escapeHtml(p.clientEmail)}</a></p>
  ${p.eventDate ? `<p>Дата: ${escapeHtml(p.eventDate)}</p>` : ""}
  ${p.notes ? `<p>Комментарий: ${escapeHtml(p.notes)}</p>` : ""}
  <hr style="border-color:#333"/>
  <h2 style="font-size:18px">Позиции (${p.items.length})</h2>
  <ul>${itemsHtml}</ul>
  <p style="font-size:18px;font-weight:bold">Итого: ${fmtBYN(p.total)}</p>
</div></body></html>`;
  return enqueue({ to, subject, html, label: "admin-order", messageId: `order-${p.orderId}` });
}

export type AdminLeadPayload = {
  leadId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  source?: string;
  notes?: string | null;
};

export async function notifyAdminLeadEmail(p: AdminLeadPayload): Promise<{ ok: boolean; error?: string }> {
  const to = adminEmail();
  if (!to) return { ok: false, error: "ADMIN_EMAIL not set" };
  const subject = `Новая заявка от ${p.clientName}`;
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px">
<div style="max-width:600px;margin:0 auto">
  <h1 style="color:#a78bfa;margin:0 0 16px">Новая заявка</h1>
  <p><strong>ID:</strong> ${escapeHtml(p.leadId)}</p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#333"/>
  <p>${escapeHtml(p.clientName)}</p>
  <p>Тел: ${escapeHtml(p.clientPhone)}
  ${p.clientEmail ? ` · Email: <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:#a78bfa">${escapeHtml(p.clientEmail)}</a>` : ""}</p>
  ${p.notes ? `<p>Комментарий: ${escapeHtml(p.notes)}</p>` : ""}
</div></body></html>`;
  return enqueue({ to, subject, html, label: "admin-lead", messageId: `lead-${p.leadId}` });
}

// ===== Client-facing: order confirmation email =====

export type ClientOrderConfirmedPayload = {
  orderId: string;
  clientName: string;
  clientEmail: string;
  total: number;
  eventDate?: string | null;
  items: Array<{ title: string; qty: number; price: number }>;
};

export async function notifyClientOrderConfirmedEmail(
  p: ClientOrderConfirmedPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!p.clientEmail) return { ok: false, error: "no client email" };
  const subject = `Ваш заказ подтверждён — ${SITE_NAME}`;
  const itemsHtml = p.items.map(i =>
    `<tr>
       <td style="padding:8px 0;border-bottom:1px solid #2a2a35">${escapeHtml(i.title)}</td>
       <td style="padding:8px 0;border-bottom:1px solid #2a2a35;text-align:right;white-space:nowrap">${i.qty} × ${i.price > 0 ? fmtBYN(i.price) : "по запросу"}</td>
       <td style="padding:8px 0;border-bottom:1px solid #2a2a35;text-align:right;white-space:nowrap;font-weight:600">${i.price > 0 ? fmtBYN(i.qty * i.price) : "—"}</td>
     </tr>`
  ).join("");
  const orderUrl = `https://${FROM_DOMAIN}/profile`;
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px;margin:0">
<div style="max-width:600px;margin:0 auto;background:#11111a;border-radius:12px;padding:28px">
  <h1 style="color:#a78bfa;margin:0 0 8px;font-size:22px">Заказ подтверждён ✅</h1>
  <p style="margin:0 0 20px;color:#b8b8c8">Здравствуйте, ${escapeHtml(p.clientName)}! Мы подтвердили ваш заказ и приступаем к подготовке.</p>

  <div style="background:#1a1a26;border-radius:8px;padding:16px;margin:0 0 20px">
    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Номер заказа</div>
    <div style="font-size:14px;font-family:monospace;margin:4px 0 12px">${escapeHtml(p.orderId.slice(0, 8))}</div>
    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Статус</div>
    <div style="display:inline-block;margin:4px 0 0;padding:4px 10px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);font-size:13px;font-weight:500">Подтверждён</div>
    ${p.eventDate ? `<div style="margin-top:12px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Дата мероприятия</div><div style="margin-top:4px">${escapeHtml(p.eventDate)}</div>` : ""}
  </div>

  <h2 style="font-size:16px;margin:0 0 12px;color:#e5e5e5">Состав заказа</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
    <tbody>${itemsHtml}</tbody>
  </table>
  <p style="font-size:18px;font-weight:bold;text-align:right;margin:0 0 24px;color:#fff">Итого: ${fmtBYN(p.total)}</p>

  <a href="${orderUrl}" style="display:inline-block;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500">Открыть личный кабинет</a>

  <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5">
    Если у вас есть вопросы — ответьте на это письмо или напишите нам в чат на сайте.<br/>
    С уважением, команда ${SITE_NAME}.
  </p>
</div></body></html>`;
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-order-confirmed",
    messageId: `order-confirmed-${p.orderId}`,
  });
}

