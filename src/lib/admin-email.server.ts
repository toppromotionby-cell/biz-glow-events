// Email-уведомления (админу и клиенту). Шлёт письма через очередь pgmq
// (transactional_emails), либо напрямую через Resend (когда нужны вложения).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ORDER_STATUS_LABEL, formatOrderBYN } from "@/lib/order-status";
import { sendViaResend } from "@/lib/email/resend.server";

const SITE_NAME = "event-hub.by";
const SENDER_DOMAIN = "notify.event-hub.by";
const FROM_DOMAIN = "event-hub.by";
// Единый отправитель для всех писем (админ-уведомления, клиентские письма, авто-письма).
const FROM_EMAIL = `noreply@${FROM_DOMAIN}`;
const FROM_ADDRESS = `${SITE_NAME} <${FROM_EMAIL}>`;
const REPLY_TO_ADDRESS = FROM_EMAIL;

// === Брендовые токены сайта (event-hub.by) — чёрный фон + оранжевый акцент ===
// Inline-стили: внешние шрифты письма не подгружают, спокойно деградируем
// в system-ui. Заголовки — display, тело — sans-serif.
const BRAND = {
  bg: "#000000",
  surface: "#0c0c10",
  surfaceAlt: "#13131a",
  border: "#1d1d24",
  text: "#ececef",
  textSoft: "#b8b8c2",
  muted: "#8a8a96",
  accent: "#f0a040",
  accentSoft: "rgba(240,160,64,0.12)",
  accentBorder: "rgba(240,160,64,0.35)",
  success: "#34d399",
  warning: "#fbbf24",
};
const FONT_DISPLAY = "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

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

// Кодируем Uint8Array → base64 без лишних аллокаций (worker-friendly).
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa доступен в воркере.
  return btoa(binary);
}

async function resolveUnsubscribeToken(email: string): Promise<string | null> {
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
    reply_to: REPLY_TO_ADDRESS,
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

// Отправка с PDF-вложениями — минуя Lovable Email API (он вложения не поддерживает).
// Идём напрямую через Resend, сохраняя suppression-чек и запись в email_send_log.
async function sendWithAttachments(opts: {
  to: string;
  subject: string;
  html: string;
  label: string;
  messageId: string;
  attachments: Array<{ filename: string; bytes: Uint8Array }>;
}): Promise<{ ok: boolean; error?: string }> {
  const to = opts.to.trim().toLowerCase();

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

  await supabaseAdmin.from("email_send_log").insert({
    message_id: opts.messageId,
    template_name: opts.label,
    recipient_email: to,
    status: "pending",
  });

  const resendRes = await sendViaResend({
    from: FROM_ADDRESS,
    to,
    subject: opts.subject,
    html: opts.html,
    text: htmlToPlainText(opts.html),
    reply_to: REPLY_TO_ADDRESS,
    headers: { "X-Entity-Ref-ID": opts.messageId },
    // Resend принимает attachments как { filename, content } — content в base64.
    // sendViaResend пробрасывает все доп. поля через JSON.stringify(args).
    attachments: opts.attachments.map((a) => ({
      filename: a.filename,
      content: bytesToBase64(a.bytes),
    })),
  } as Parameters<typeof sendViaResend>[0] & {
    attachments: Array<{ filename: string; content: string }>;
  });

  if (!resendRes.ok) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: opts.messageId,
      template_name: opts.label,
      recipient_email: to,
      status: "failed",
      error_message: resendRes.error,
    });
    return { ok: false, error: resendRes.error };
  }

  await supabaseAdmin.from("email_send_log").insert({
    message_id: opts.messageId,
    template_name: opts.label,
    recipient_email: to,
    status: "sent",
  });
  return { ok: true };
}

// === Общий каркас письма в стиле сайта ===
function brandShell(opts: { title: string; previewText?: string; body: string }): string {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_BODY};color:${BRAND.text}">
${opts.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(opts.previewText)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px">
      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${FONT_DISPLAY};font-size:20px;font-weight:700;color:${BRAND.text};letter-spacing:-0.01em">
              <span style="color:${BRAND.accent}">●</span>&nbsp;${SITE_NAME}
            </td>
            <td align="right" style="font-size:12px;color:${BRAND.muted}">Минск · Беларусь</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;padding:32px;box-shadow:0 1px 0 rgba(255,255,255,0.04) inset">
        ${opts.body}
      </td></tr>
      <tr><td style="padding:18px 4px 0;font-size:12px;color:${BRAND.muted};line-height:1.6">
        Это служебное письмо от ${SITE_NAME}. Если вопросов больше нет — просто игнорируйте его.<br/>
        С уважением, команда ${SITE_NAME}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const sectionLabel = (txt: string) =>
  `<div style="font-family:${FONT_DISPLAY};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.accent};margin:0 0 12px">${escapeHtml(txt)}</div>`;

const metaRow = (label: string, value: string) => `
  <tr>
    <td style="padding:7px 14px 7px 0;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-size:14px;color:${BRAND.text};vertical-align:top">${value}</td>
  </tr>`;

// ===== Admin: новый заказ =====

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
  <h1 style="color:${BRAND.accent};margin:0 0 16px">Новый заказ</h1>
  <p><strong>ID:</strong> ${escapeHtml(p.orderId)}</p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#333"/>
  <h2 style="font-size:18px">Клиент</h2>
  <p>${escapeHtml(p.clientName)}${p.clientCompany ? " · " + escapeHtml(p.clientCompany) : ""}</p>
  <p>Тел: ${escapeHtml(p.clientPhone)}
     · Email: <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.accent}">${escapeHtml(p.clientEmail)}</a></p>
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
  <h1 style="color:${BRAND.accent};margin:0 0 16px">Новая заявка</h1>
  <p><strong>ID:</strong> ${escapeHtml(p.leadId)}</p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#333"/>
  <p>${escapeHtml(p.clientName)}</p>
  <p>Тел: ${escapeHtml(p.clientPhone)}
  ${p.clientEmail ? ` · Email: <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.accent}">${escapeHtml(p.clientEmail)}</a>` : ""}</p>
  ${p.notes ? `<p>Комментарий: ${escapeHtml(p.notes)}</p>` : ""}
</div></body></html>`;
  return enqueue({ to, subject, html, label: "admin-lead", messageId: `lead-${p.leadId}` });
}

// ===== Admin: inquiry / запрос на консультацию =====

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
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,0.15);color:${BRAND.warning};border:1px solid rgba(251,191,36,0.35);font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px">ЗАПРОС · требуется связаться</div>
  <h1 style="color:${BRAND.warning};margin:0 0 8px;font-size:22px">Новый запрос на консультацию</h1>
  <p style="margin:0 0 20px;color:#b8b8c8">Клиент оставил запрос — не оформленный заказ. Нужно перезвонить и уточнить, что именно ему нужно.</p>
  <p><strong>ID:</strong> <span style="font-family:monospace">${escapeHtml(p.inquiryId.slice(0, 8))}</span></p>
  <p><strong>Источник:</strong> ${escapeHtml(p.source ?? "—")}</p>
  <hr style="border-color:#2a2a35"/>
  <h2 style="font-size:16px;color:#e5e5e5">Контакты клиента</h2>
  <p style="margin:6px 0">${escapeHtml(p.clientName)}${p.clientCompany ? " · " + escapeHtml(p.clientCompany) : ""}</p>
  <p style="margin:6px 0">📞 <a href="tel:${escapeHtml(p.clientPhone)}" style="color:${BRAND.warning}">${escapeHtml(p.clientPhone)}</a>
     · ✉ <a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.warning}">${escapeHtml(p.clientEmail)}</a></p>
  ${p.eventDate ? `<p style="margin:6px 0">📅 Дата: ${escapeHtml(p.eventDate)}</p>` : ""}
  ${p.notes ? `<div style="background:#1a1a26;border-left:3px solid ${BRAND.warning};border-radius:6px;padding:12px 14px;margin:16px 0"><div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:6px">Сообщение клиента</div><div style="white-space:pre-wrap">${escapeHtml(p.notes)}</div></div>` : ""}
  <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:linear-gradient(135deg,${BRAND.warning},#f59e0b);color:#0a0a0f;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Открыть в админке</a>
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

  const body = `
    ${sectionLabel("Запрос принят")}
    <h1 style="font-family:${FONT_DISPLAY};margin:0 0 12px;font-size:26px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text}">
      Спасибо, ${escapeHtml(p.clientName)}!
    </h1>
    <p style="margin:0 0 16px;color:${BRAND.textSoft};font-size:15px;line-height:1.6">
      Мы получили ваш запрос и уже разбираем детали. Менеджер свяжется с вами в течение
      рабочего дня, чтобы уточнить задачу и подобрать оптимальное решение.
    </p>
    ${clarifyUrl ? `
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;margin:24px 0">
      <div style="font-family:${FONT_DISPLAY};font-weight:600;color:${BRAND.accent};margin-bottom:8px;font-size:14px">Поможет ускорить ответ</div>
      <p style="margin:0 0 16px;color:${BRAND.textSoft};font-size:14px;line-height:1.55">
        Если есть пара минут — заполните короткую анкету: дата, формат, число гостей, бюджет.
        Менеджер сразу подготовит подходящие варианты.
      </p>
      <a href="${clarifyUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.accent},#f5c97a);color:#1a1208;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Уточнить детали</a>
    </div>` : ""}
    <p style="margin:18px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.55">
      Если что-то срочно — просто ответьте на это письмо.
    </p>`;
  const html = brandShell({
    title: subject,
    previewText: "Мы получили ваш запрос и скоро свяжемся.",
    body,
  });

  const salt = Date.now().toString(36);
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-inquiry-received",
    messageId: `inquiry-received-${p.inquiryId}-${salt}`,
  });
}

// ===== Client: подтверждение заказа (с PDF-вложениями) =====

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
  // Прикрепляемые к письму PDF-файлы (КП/Счёт/Договор/Акт).
  attachments?: Array<{ filename: string; bytes: Uint8Array }>;
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
       <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top">
         <div style="font-weight:600;color:${BRAND.text};font-size:14px">${escapeHtml(i.title)}</div>
         ${sub ? `<div style="font-size:12px;color:${BRAND.muted};margin-top:3px">${sub}</div>` : ""}
       </td>
       <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;vertical-align:top;color:${BRAND.textSoft};font-size:13px;font-variant-numeric:tabular-nums">${i.price > 0 ? fmtBYN(i.price) : "по запросу"}</td>
       <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;font-weight:700;vertical-align:top;color:${BRAND.text};font-size:14px;font-variant-numeric:tabular-nums">${i.price > 0 ? fmtBYN(i.qty * i.price) : "—"}</td>
     </tr>`;
  }).join("");

  const paid = Number(p.paid ?? 0);
  const remaining = Math.max(0, Number(p.total ?? 0) - paid);
  const orderUrl = `https://${FROM_DOMAIN}/profile`;
  const hasAttachments = Boolean(p.attachments && p.attachments.length > 0);

  const body = `
    ${sectionLabel("Заказ подтверждён")}
    <h1 style="font-family:${FONT_DISPLAY};margin:0 0 10px;font-size:26px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text}">
      Здравствуйте, ${escapeHtml(p.clientName)}!
    </h1>
    <p style="margin:0 0 24px;color:${BRAND.textSoft};font-size:15px;line-height:1.6">
      Мы подтвердили ваш заказ и приступаем к подготовке. Ниже — детали и состав.
    </p>

    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>
        ${metaRow("Номер заказа", `<span style="font-family:ui-monospace,monospace;color:${BRAND.text}">${escapeHtml(p.orderId.slice(0, 8).toUpperCase())}</span>`)}
        ${metaRow("Статус", `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${BRAND.accentSoft};color:${BRAND.accent};border:1px solid ${BRAND.accentBorder};font-size:12px;font-weight:600;letter-spacing:0.02em">${escapeHtml(statusLabel)}</span>`)}
        ${p.eventDate ? metaRow("Дата мероприятия", escapeHtml(fmtDateRu(p.eventDate))) : ""}
      </tbody></table>
    </div>

    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 24px">
      ${sectionLabel("Контактные данные")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>
        ${metaRow("Имя", escapeHtml(p.clientName))}
        ${metaRow("Email", escapeHtml(p.clientEmail))}
        ${p.clientPhone ? metaRow("Телефон", escapeHtml(p.clientPhone)) : ""}
        ${p.clientCompany ? metaRow("Компания", escapeHtml(p.clientCompany)) : ""}
      </tbody></table>
    </div>

    ${sectionLabel("Состав заказа")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin:0 0 8px">
      <thead><tr>
        <th style="text-align:left;padding:0 0 10px;font-family:${FONT_DISPLAY};font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${BRAND.border}">Позиция</th>
        <th style="text-align:right;padding:0 0 10px;font-family:${FONT_DISPLAY};font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${BRAND.border}">Цена</th>
        <th style="text-align:right;padding:0 0 10px;font-family:${FONT_DISPLAY};font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${BRAND.border}">Сумма</th>
      </tr></thead>
      <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:14px 0;color:${BRAND.muted};font-size:13px">Позиций нет</td></tr>`}</tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px">
      <tbody>
        <tr>
          <td style="padding:10px 0;color:${BRAND.textSoft};font-size:14px">Итого</td>
          <td style="padding:10px 0;text-align:right;font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${BRAND.accent};font-variant-numeric:tabular-nums">${fmtBYN(Number(p.total ?? 0))}</td>
        </tr>
        ${paid > 0 ? `<tr>
          <td style="padding:4px 0;color:${BRAND.muted};font-size:13px">Оплачено</td>
          <td style="padding:4px 0;text-align:right;color:${BRAND.success};font-size:14px;font-variant-numeric:tabular-nums">${fmtBYN(paid)}</td>
        </tr>` : ""}
        ${paid > 0 && remaining > 0 ? `<tr>
          <td style="padding:4px 0;color:${BRAND.muted};font-size:13px">Осталось доплатить</td>
          <td style="padding:4px 0;text-align:right;color:${BRAND.warning};font-size:14px;font-weight:600;font-variant-numeric:tabular-nums">${fmtBYN(remaining)}</td>
        </tr>` : ""}
      </tbody>
    </table>

    ${p.notes ? `<div style="background:${BRAND.surfaceAlt};border-left:3px solid ${BRAND.accent};border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 24px">
      ${sectionLabel("Комментарий")}
      <div style="font-size:14px;color:${BRAND.text};white-space:pre-wrap;line-height:1.55">${escapeHtml(p.notes)}</div>
    </div>` : ""}

    ${hasAttachments ? `<div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin:0 0 24px">
      <div style="font-family:${FONT_DISPLAY};font-size:13px;font-weight:600;color:${BRAND.accent};margin-bottom:6px">Документы во вложении</div>
      <div style="font-size:13px;color:${BRAND.textSoft};line-height:1.55">
        К письму приложены коммерческое предложение, счёт, договор и акт в формате PDF.
      </div>
    </div>` : ""}

    <a href="${orderUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.accent},#f5c97a);color:#1a1208;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:14px;font-family:${FONT_DISPLAY}">Открыть личный кабинет</a>

    <p style="margin:26px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.55">
      Если у вас есть вопросы — ответьте на это письмо или напишите нам в чат на сайте.
    </p>`;

  const html = brandShell({
    title: subject,
    previewText: `Заказ ${p.orderId.slice(0, 8).toUpperCase()} подтверждён. Итого ${fmtBYN(Number(p.total ?? 0))}.`,
    body,
  });
  return { subject, html };
}

export async function notifyClientOrderConfirmedEmail(
  p: ClientOrderConfirmedPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!p.clientEmail) return { ok: false, error: "no client email" };
  const { subject, html } = buildClientOrderConfirmedEmail(p);
  // Соль в message_id, чтобы повторная отправка не отбивалась по идемпотентности.
  const salt = Date.now().toString(36);
  const messageId = `order-confirmed-${p.orderId}-${salt}`;

  // Если есть PDF-вложения — идём напрямую через Resend (Lovable Email API
  // вложения не поддерживает). Иначе — обычный pgmq-путь.
  if (p.attachments && p.attachments.length > 0) {
    return sendWithAttachments({
      to: p.clientEmail,
      subject,
      html,
      label: "client-order-confirmed",
      messageId,
      attachments: p.attachments,
    });
  }
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-order-confirmed",
    messageId,
  });
}
