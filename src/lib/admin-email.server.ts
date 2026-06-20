// Email-фолбэк уведомлений администратору. Используется когда Telegram не настроен
// или вернул ошибку. Рендерит простой HTML и пихает напрямую в pgmq-очередь
// (transactional_emails) через service-role admin клиент.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ORDER_STATUS_LABEL, formatOrderBYN } from "@/lib/order-status";

const SITE_NAME = "event-hub.by";
const SENDER_DOMAIN = "notify.event-hub.by";
const FROM_DOMAIN = "event-hub.by";
// Единый отправитель для всех писем (админ-уведомления, клиентские письма, авто-письма).
// Менять только здесь — все шаблоны и пути отправки используют этот адрес.
const FROM_EMAIL = `noreply@${FROM_DOMAIN}`;
const FROM_ADDRESS = `${SITE_NAME} <${FROM_EMAIL}>`;
const REPLY_TO_ADDRESS = FROM_EMAIL;

function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Используем общий хелпер из order-status, чтобы валюта/формат в письме
// совпадали с тем, что показывает админка (`1 500 BYN`).
const fmtBYN = (n: number) => formatOrderBYN(n);


function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function resolveUnsubscribeToken(email: string): Promise<string | null> {
  // Reuse an existing unused token for this address, otherwise create one.
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", email)
    .is("used_at", null)
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
  const { error } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .insert({ email, token });
  if (error) return null;
  return token;
}

async function enqueue(opts: {
  to: string;
  subject: string;
  html: string;
  label: string;
  messageId: string;
}) {
  const to = opts.to.trim().toLowerCase();

  // Suppression check: don't enqueue for bounced/complained/unsubscribed recipients.
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("email")
    .eq("email", to)
    .limit(1)
    .maybeSingle();
  if (suppressed) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: opts.messageId,
      template_name: opts.label,
      recipient_email: to,
      status: "suppressed",
      error_message: "Recipient is on the suppression list",
    });
    return { ok: false, error: "suppressed" };
  }

  const unsubscribeToken = await resolveUnsubscribeToken(to);
  if (!unsubscribeToken) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: opts.messageId,
      template_name: opts.label,
      recipient_email: to,
      status: "failed",
      error_message: "Failed to provision unsubscribe token",
    });
    return { ok: false, error: "unsubscribe token failed" };
  }

  const payload = {
    message_id: opts.messageId,
    to,
    from: FROM_ADDRESS,
    sender_domain: SENDER_DOMAIN,
    subject: opts.subject,
    html: opts.html,
    text: htmlToPlainText(opts.html),
    label: opts.label,
    idempotency_key: opts.messageId,
    unsubscribe_token: unsubscribeToken,
    purpose: "transactional",
    queued_at: new Date().toISOString(),
  };
  await supabaseAdmin.from("email_send_log").insert({
    message_id: opts.messageId,
    template_name: opts.label,
    recipient_email: to,
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
      recipient_email: to,
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

// ===== Admin: inquiry / запрос на консультацию (отличный от заказа) =====

export type AdminInquiryPayload = {
  inquiryId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientCompany?: string | null;
  eventDate?: string | null;
  source?: string;
  notes?: string | null;
};

export async function notifyAdminInquiryEmail(p: AdminInquiryPayload): Promise<{ ok: boolean; error?: string }> {
  const to = adminEmail();
  if (!to) return { ok: false, error: "ADMIN_EMAIL not set" };
  const subject = `🟡 ЗАПРОС от ${p.clientName} — нужно связаться`;
  const adminUrl = `https://${FROM_DOMAIN}/admin/orders`;
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px;margin:0">
<div style="max-width:600px;margin:0 auto;background:#11111a;border-radius:12px;padding:28px">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px">ЗАПРОС · требуется связаться</div>
  <h1 style="color:#fbbf24;margin:0 0 8px;font-size:22px">Новый запрос на консультацию</h1>
  <p style="margin:0 0 20px;color:#b8b8c8">Клиент оставил запрос — не оформленный заказ. Нужно перезвонить и уточнить, что именно ему нужно.</p>
  <p><strong>ID:</strong> <span style="font-family:monospace">${escapeHtml(p.inquiryId.slice(0, 8))}</span></p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#2a2a35"/>
  <h2 style="font-size:16px;color:#e5e5e5">Контакты клиента</h2>
  <p style="margin:6px 0">${escapeHtml(p.clientName)}${p.clientCompany ? " · " + escapeHtml(p.clientCompany) : ""}</p>
  <p style="margin:6px 0">📞 <a href="tel:${escapeHtml(p.clientPhone)}" style="color:#fbbf24">${escapeHtml(p.clientPhone)}</a>
     · ✉ <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:#fbbf24">${escapeHtml(p.clientEmail)}</a></p>
  ${p.eventDate ? `<p style="margin:6px 0">📅 Дата: ${escapeHtml(p.eventDate)}</p>` : ""}
  ${p.notes ? `<div style="background:#1a1a26;border-left:3px solid #fbbf24;border-radius:6px;padding:12px 14px;margin:16px 0"><div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:6px">Сообщение клиента</div><div style="white-space:pre-wrap">${escapeHtml(p.notes)}</div></div>` : ""}
  <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0a0a0f;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Открыть в админке</a>
</div></body></html>`;
  return enqueue({ to, subject, html, label: "admin-inquiry", messageId: `inquiry-${p.inquiryId}` });
}

// ===== Client: подтверждение получения запроса + ссылка на анкету =====

export type ClientInquiryReceivedPayload = {
  inquiryId: string;
  clientName: string;
  clientEmail: string;
  clarificationToken: string | null;
};

export async function notifyClientInquiryReceivedEmail(
  p: ClientInquiryReceivedPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!p.clientEmail) return { ok: false, error: "no client email" };
  const subject = `Мы получили ваш запрос — ${SITE_NAME}`;
  const clarifyUrl = p.clarificationToken
    ? `https://${FROM_DOMAIN}/inquiry/${p.clarificationToken}`
    : null;
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px;margin:0">
<div style="max-width:600px;margin:0 auto;background:#11111a;border-radius:12px;padding:28px">
  <h1 style="color:#a78bfa;margin:0 0 12px;font-size:22px">Спасибо за запрос! 👋</h1>
  <p style="margin:0 0 14px;color:#d4d4dc">Здравствуйте, ${escapeHtml(p.clientName)}!</p>
  <p style="margin:0 0 14px;color:#b8b8c8">Мы получили ваш запрос и уже разбираем детали. Менеджер свяжется с вами в течение рабочего дня, чтобы уточнить задачу и подобрать оптимальное решение.</p>
  ${clarifyUrl ? `
  <div style="background:#1a1a26;border-radius:8px;padding:18px;margin:20px 0">
    <div style="font-weight:600;color:#a78bfa;margin-bottom:8px">Поможет ускорить ответ</div>
    <p style="margin:0 0 14px;color:#b8b8c8;font-size:14px">Если есть пара минут — заполните короткую анкету: дата, формат, число гостей, бюджет. Менеджер сразу подготовит подходящие варианты.</p>
    <a href="${clarifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:500">Уточнить детали</a>
  </div>` : ""}
  <p style="margin:18px 0 0;font-size:13px;color:#888;line-height:1.5">Если что-то срочно — просто ответьте на это письмо.<br/>С уважением, команда ${SITE_NAME}.</p>
</div></body></html>`;
  const salt = Date.now().toString(36);
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-inquiry-received",
    messageId: `inquiry-received-${p.inquiryId}-${salt}`,
  });
}

// ===== Client-facing: order confirmation email =====

export type ClientOrderConfirmedPayload = {
  orderId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientCompany?: string | null;
  total: number;
  paid?: number | null;
  status?: string | null;
  source?: string | null;
  eventDate?: string | null;
  notes?: string | null;
  items: Array<{
    title: string;
    qty: number;
    price: number;
    entityType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  documents?: Array<{ kind: "quote" | "invoice" | "contract" | "act"; label: string; url: string }>;
};

const ENTITY_LABEL_RU: Record<string, string> = {
  zone: "Зона",
  service: "Услуга",
  equipment: "Оборудование",
  tech_equipment: "Оборудование",
  production: "Продакшн",
  production_item: "Продакшн",
  extras: "Доп. услуга",
};


function fmtDateRu(d?: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("ru-BY"); } catch { return String(d); }
}

export function buildClientOrderConfirmedEmail(p: ClientOrderConfirmedPayload): { subject: string; html: string } {
  const subject = `Ваш заказ подтверждён — ${SITE_NAME}`;
  const statusKey = p.status ?? "confirmed";
  // Используем общий ORDER_STATUS_LABEL — единый источник правды с админкой.
  const statusLabel = ORDER_STATUS_LABEL[statusKey] ?? ORDER_STATUS_LABEL.confirmed;


  const itemsHtml = p.items.map(i => {
    const sub = [
      i.entityType ? escapeHtml(ENTITY_LABEL_RU[i.entityType] ?? i.entityType) : null,
      `${i.qty} шт.`,
      (i.startDate || i.endDate)
        ? `${fmtDateRu(i.startDate)}${i.endDate && i.endDate !== i.startDate ? ` — ${fmtDateRu(i.endDate)}` : ""}`
        : null,
    ].filter(Boolean).join(" · ");
    return `<tr>
       <td style="padding:10px 0;border-bottom:1px solid #2a2a35;vertical-align:top">
         <div style="font-weight:600">${escapeHtml(i.title)}</div>
         ${sub ? `<div style="font-size:12px;color:#888;margin-top:2px">${sub}</div>` : ""}
       </td>
       <td style="padding:10px 0;border-bottom:1px solid #2a2a35;text-align:right;white-space:nowrap;vertical-align:top">${i.price > 0 ? fmtBYN(i.price) : "по запросу"}</td>
       <td style="padding:10px 0;border-bottom:1px solid #2a2a35;text-align:right;white-space:nowrap;font-weight:600;vertical-align:top">${i.price > 0 ? fmtBYN(i.qty * i.price) : "—"}</td>
     </tr>`;
  }).join("");

  const paid = Number(p.paid ?? 0);
  const remaining = Math.max(0, Number(p.total ?? 0) - paid);
  const orderUrl = `https://${FROM_DOMAIN}/profile`;

  const metaRow = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:6px 0;font-size:14px;color:#e5e5e5;vertical-align:top">${value}</td>
    </tr>`;

  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:24px;margin:0">
<div style="max-width:640px;margin:0 auto;background:#11111a;border-radius:12px;padding:28px">
  <h1 style="color:#a78bfa;margin:0 0 8px;font-size:22px">Заказ подтверждён ✅</h1>
  <p style="margin:0 0 20px;color:#b8b8c8">Здравствуйте, ${escapeHtml(p.clientName)}! Мы подтвердили ваш заказ и приступаем к подготовке.</p>

  <div style="background:#1a1a26;border-radius:8px;padding:16px 18px;margin:0 0 20px">
    <table style="width:100%;border-collapse:collapse">
      <tbody>
        ${metaRow("Номер заказа", `<span style="font-family:monospace">${escapeHtml(p.orderId.slice(0, 8))}</span>`)}
        ${metaRow("Статус", `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);font-size:13px;font-weight:500">${escapeHtml(statusLabel)}</span>`)}
        ${p.eventDate ? metaRow("Дата мероприятия", escapeHtml(fmtDateRu(p.eventDate))) : ""}
      </tbody>
    </table>
  </div>

  <div style="background:#1a1a26;border-radius:8px;padding:16px 18px;margin:0 0 20px">
    <div style="font-size:13px;color:#a78bfa;font-weight:600;margin-bottom:8px">Контактные данные</div>
    <table style="width:100%;border-collapse:collapse">
      <tbody>
        ${metaRow("Имя", escapeHtml(p.clientName))}
        ${metaRow("Email", escapeHtml(p.clientEmail))}
        ${p.clientPhone ? metaRow("Телефон", escapeHtml(p.clientPhone)) : ""}
        ${p.clientCompany ? metaRow("Компания", escapeHtml(p.clientCompany)) : ""}
      </tbody>
    </table>
  </div>

  <h2 style="font-size:16px;margin:0 0 12px;color:#e5e5e5">Состав заказа</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px">
    <thead>
      <tr>
        <th style="text-align:left;padding:0 0 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #2a2a35">Позиция</th>
        <th style="text-align:right;padding:0 0 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #2a2a35">Цена</th>
        <th style="text-align:right;padding:0 0 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #2a2a35">Сумма</th>
      </tr>
    </thead>
    <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:10px 0;color:#888;font-size:13px">Позиций нет</td></tr>`}</tbody>
  </table>

  <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
    <tbody>
      <tr><td style="padding:8px 0;color:#b8b8c8;font-size:14px">Итого</td><td style="padding:8px 0;text-align:right;font-size:18px;font-weight:bold;color:#fff">${fmtBYN(Number(p.total ?? 0))}</td></tr>
      ${paid > 0 ? `<tr><td style="padding:4px 0;color:#888;font-size:13px">Оплачено</td><td style="padding:4px 0;text-align:right;color:#34d399;font-size:14px">${fmtBYN(paid)}</td></tr>` : ""}
      ${paid > 0 && remaining > 0 ? `<tr><td style="padding:4px 0;color:#888;font-size:13px">Осталось доплатить</td><td style="padding:4px 0;text-align:right;color:#fbbf24;font-size:14px;font-weight:600">${fmtBYN(remaining)}</td></tr>` : ""}
    </tbody>
  </table>

  ${p.notes ? `<div style="background:#1a1a26;border-left:3px solid #a78bfa;border-radius:6px;padding:12px 14px;margin:0 0 24px">
    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Комментарий</div>
    <div style="font-size:14px;color:#e5e5e5;white-space:pre-wrap">${escapeHtml(p.notes)}</div>
  </div>` : ""}

  ${(p.documents && p.documents.length > 0) ? `
  <div style="background:#1a1a26;border-radius:8px;padding:16px 18px;margin:0 0 20px">
    <div style="font-size:13px;color:#a78bfa;font-weight:600;margin-bottom:10px">Документы по заказу</div>
    <div style="display:block">
      ${p.documents.map(d => `<a href="${escapeHtml(d.url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 14px;border-radius:6px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.35);color:#c4b5fd;text-decoration:none;font-size:13px;font-weight:500">📄 ${escapeHtml(d.label)}</a>`).join("")}
    </div>
    <div style="font-size:11px;color:#888;margin-top:8px">Ссылки действительны 30 дней. Откройте, чтобы посмотреть или сохранить документ в PDF.</div>
  </div>` : ""}

  <a href="${orderUrl}" style="display:inline-block;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500">Открыть личный кабинет</a>

  <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5">
    Если у вас есть вопросы — ответьте на это письмо или напишите нам в чат на сайте.<br/>
    С уважением, команда ${SITE_NAME}.
  </p>
</div></body></html>`;
  return { subject, html };
}

export async function notifyClientOrderConfirmedEmail(
  p: ClientOrderConfirmedPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!p.clientEmail) return { ok: false, error: "no client email" };
  const { subject, html } = buildClientOrderConfirmedEmail(p);
  // Включаем timestamp в message_id, чтобы повторная отправка не отбивалась
  // провайдером по идемпотентности (например, после починки sender-домена).
  const salt = Date.now().toString(36);
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-order-confirmed",
    messageId: `order-confirmed-${p.orderId}-${salt}`,
  });
}



