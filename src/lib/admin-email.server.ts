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
  <p>Тел: <a href="tel:${escapeHtml(p.clientPhone)}" style="color:#a78bfa">${escapeHtml(p.clientPhone)}</a>
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
  <p>Тел: <a href="tel:${escapeHtml(p.clientPhone)}" style="color:#a78bfa">${escapeHtml(p.clientPhone)}</a>
  ${p.clientEmail ? ` · Email: <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:#a78bfa">${escapeHtml(p.clientEmail)}</a>` : ""}</p>
  ${p.notes ? `<p>Комментарий: ${escapeHtml(p.notes)}</p>` : ""}
</div></body></html>`;
  return enqueue({ to, subject, html, label: "admin-lead", messageId: `lead-${p.leadId}` });
}
