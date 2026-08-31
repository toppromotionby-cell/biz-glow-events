// Email-уведомления (админу и клиенту). Шлёт письма через очередь pgmq
// (transactional_emails), либо напрямую через Resend (когда нужны вложения).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ORDER_STATUS_LABEL, formatOrderBYN } from "@/lib/order-status";
import { sendViaResend } from "@/lib/email/resend.server";
import { resolveSender, type SenderKind } from "@/lib/email/sender.server";

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

// Полностью убирает активные ссылки из тела письма:
//   • разворачивает <a href="...">текст</a> в <span style="..."> текст </span>
//   • стирает href/src на других тегах
//   • удаляет голые http(s)://... URL из текста (вне тегов)
//   • вычищает mailto:/tel: подстроки
// Используется для всех клиентских писем перед отправкой/предпросмотром.
export function stripActiveLinks(html: string): string {
  // 1) <a ...>inner</a> → <span style="...">inner</span>.
  //    Исключение: <a data-doc-link="1"> (ссылки скачивания PDF клиенту) сохраняем активными.
  let out = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    if (/data-doc-link\s*=\s*"1"/i.test(attrs)) return full;
    const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/i);
    const style = styleMatch ? styleMatch[1] : "";
    const cleanInner = inner.replace(/<a\b[^>]*>|<\/a>/gi, "");
    return `<span${style ? ` style="${style};cursor:default"` : ""}>${cleanInner}</span>`;
  });
  // 2) Удаляем href/src/action на всех тегах, КРОМЕ <a data-doc-link="1">.
  out = out.replace(/<([a-zA-Z0-9]+)\b([^>]*)>/g, (_m, tag: string, attrs: string) => {
    if (tag.toLowerCase() === "a" && /data-doc-link\s*=\s*"1"/i.test(attrs)) return `<${tag}${attrs}>`;
    const cleaned = attrs
      .replace(/\s(?:href|src|action|formaction|background|ping)\s*=\s*"[^"]*"/gi, "")
      .replace(/\s(?:href|src|action|formaction|background|ping)\s*=\s*'[^']*'/gi, "");
    return `<${tag}${cleaned}>`;
  });
  // 3) Голые URL в текстовых нодах вне тегов → пусто
  out = out.replace(/<[^>]+>|(https?:\/\/[^\s<"']+|mailto:[^\s<"']+|tel:[^\s<"']+)/gi,
    (m, url) => (url ? "" : m));
  return out;
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

/** Тип письма → настройка отправителя из «Настройки → Письма → Отправители». */
function senderKindFor(label: string): SenderKind {
  if (label.startsWith("admin-")) return "admin";
  if (label.includes("quote")) return "quotes";
  if (label.includes("order")) return "orders";
  if (label.includes("lead") || label.includes("inquiry")) return "leads";
  return "default";
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

  // Клиентские письма — без активных ссылок.
  const html = opts.label.startsWith("client-") ? stripActiveLinks(opts.html) : opts.html;

  const sender = await resolveSender(senderKindFor(opts.label));

  const payload = {
    message_id: opts.messageId,
    to,
    from: sender.from,
    reply_to: sender.replyTo,
    sender_domain: SENDER_DOMAIN,
    subject: opts.subject,
    html,
    text: htmlToPlainText(html),
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

  // Клиентские письма — без активных ссылок.
  const html = opts.label.startsWith("client-") ? stripActiveLinks(opts.html) : opts.html;

  const attachSender = await resolveSender(senderKindFor(opts.label));

  const resendRes = await sendViaResend({
    from: attachSender.from,
    to,
    subject: opts.subject,
    html,
    text: htmlToPlainText(html),
    reply_to: attachSender.replyTo,
    headers: { "X-Entity-Ref-ID": opts.messageId },
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
  orderNumber?: string | null;
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

function orderDisplayId(orderId: string, orderNumber?: string | null): string {
  const n = (orderNumber ?? "").trim();
  return n || orderId.slice(0, 8);
}

export async function notifyAdminOrderEmail(p: AdminOrderPayload): Promise<{ ok: boolean; error?: string }> {
  const to = adminEmail();
  if (!to) return { ok: false, error: "ADMIN_EMAIL not set" };
  const subject = `Новый заказ от ${p.clientName} — ${fmtBYN(p.total)}`;
  const itemsHtml = p.items.map(i => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:14px">${escapeHtml(i.title)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};text-align:right;color:${BRAND.textSoft};font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums">${i.qty} × ${i.price > 0 ? fmtBYN(i.price) : "по запросу"}</td>
  </tr>`).join("");
  const body = `
    ${sectionLabel("Новый заказ")}
    <h1 style="font-family:${FONT_DISPLAY};margin:0 0 16px;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text}">Поступил новый заказ</h1>
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>
        ${metaRow("Номер", `<span style="font-family:ui-monospace,monospace">${escapeHtml(orderDisplayId(p.orderId, p.orderNumber))}</span>`)}
        ${metaRow("Источник", escapeHtml(p.source ?? "—"))}
        ${metaRow("Клиент", escapeHtml(p.clientName) + (p.clientCompany ? ` · ${escapeHtml(p.clientCompany)}` : ""))}
        ${metaRow("Телефон", `<a href="tel:${escapeHtml(p.clientPhone)}" style="color:${BRAND.accent};text-decoration:none">${escapeHtml(p.clientPhone)}</a>`)}
        ${metaRow("Email", `<a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.accent};text-decoration:none">${escapeHtml(p.clientEmail)}</a>`)}
        ${p.eventDate ? metaRow("Дата мероприятия", escapeHtml(p.eventDate)) : ""}
      </tbody></table>
    </div>
    ${p.notes ? `<div style="background:${BRAND.surfaceAlt};border-left:3px solid ${BRAND.accent};border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 18px">
      ${sectionLabel("Комментарий клиента")}
      <div style="font-size:14px;color:${BRAND.text};white-space:pre-wrap;line-height:1.55">${escapeHtml(p.notes)}</div>
    </div>` : ""}
    ${sectionLabel(`Позиции (${p.items.length})`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
      <tbody>${itemsHtml || `<tr><td style="padding:12px 0;color:${BRAND.muted};font-size:13px">Позиций нет</td></tr>`}</tbody>
    </table>
    <div style="text-align:right;font-family:${FONT_DISPLAY};font-size:20px;font-weight:700;color:${BRAND.accent};font-variant-numeric:tabular-nums">Итого: ${fmtBYN(p.total)}</div>`;
  const html = brandShell({ title: subject, previewText: `Новый заказ от ${p.clientName}`, body });
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
  const body = `
    ${sectionLabel("Новая заявка")}
    <h1 style="font-family:${FONT_DISPLAY};margin:0 0 16px;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text}">Новая заявка с сайта</h1>
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>
        ${metaRow("ID", `<span style="font-family:ui-monospace,monospace">${escapeHtml(p.leadId.slice(0, 8))}</span>`)}
        ${metaRow("Источник", escapeHtml(p.source ?? "—"))}
        ${metaRow("Клиент", escapeHtml(p.clientName))}
        ${metaRow("Телефон", `<a href="tel:${escapeHtml(p.clientPhone)}" style="color:${BRAND.accent};text-decoration:none">${escapeHtml(p.clientPhone)}</a>`)}
        ${p.clientEmail ? metaRow("Email", `<a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.accent};text-decoration:none">${escapeHtml(p.clientEmail)}</a>`) : ""}
      </tbody></table>
    </div>
    ${p.notes ? `<div style="background:${BRAND.surfaceAlt};border-left:3px solid ${BRAND.accent};border-radius:0 10px 10px 0;padding:14px 16px">
      ${sectionLabel("Комментарий")}
      <div style="font-size:14px;color:${BRAND.text};white-space:pre-wrap;line-height:1.55">${escapeHtml(p.notes)}</div>
    </div>` : ""}`;
  const html = brandShell({ title: subject, previewText: `Заявка от ${p.clientName}`, body });
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
  const body = `
    <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,0.15);color:${BRAND.warning};border:1px solid rgba(251,191,36,0.35);font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 14px">Запрос · требуется связаться</div>
    <h1 style="font-family:${FONT_DISPLAY};margin:0 0 10px;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text}">Новый запрос на консультацию</h1>
    <p style="margin:0 0 18px;color:${BRAND.textSoft};font-size:14px;line-height:1.55">Клиент оставил запрос — не оформленный заказ. Нужно перезвонить и уточнить, что именно ему нужно.</p>
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>
        ${metaRow("ID", `<span style="font-family:ui-monospace,monospace">${escapeHtml(p.inquiryId.slice(0, 8))}</span>`)}
        ${metaRow("Источник", escapeHtml(p.source ?? "—"))}
        ${metaRow("Клиент", escapeHtml(p.clientName) + (p.clientCompany ? ` · ${escapeHtml(p.clientCompany)}` : ""))}
        ${metaRow("Телефон", `<a href="tel:${escapeHtml(p.clientPhone)}" style="color:${BRAND.warning};text-decoration:none">${escapeHtml(p.clientPhone)}</a>`)}
        ${metaRow("Email", `<a href="mailto:${escapeHtml(p.clientEmail)}" style="color:${BRAND.warning};text-decoration:none">${escapeHtml(p.clientEmail)}</a>`)}
        ${p.eventDate ? metaRow("Дата", escapeHtml(p.eventDate)) : ""}
      </tbody></table>
    </div>
    ${p.notes ? `<div style="background:${BRAND.surfaceAlt};border-left:3px solid ${BRAND.warning};border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 18px">
      ${sectionLabel("Сообщение клиента")}
      <div style="font-size:14px;color:${BRAND.text};white-space:pre-wrap;line-height:1.55">${escapeHtml(p.notes)}</div>
    </div>` : ""}
    <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.warning},#f59e0b);color:#1a1208;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;font-family:${FONT_DISPLAY}">Открыть в админке</a>`;
  const html = brandShell({ title: subject, previewText: `Запрос от ${p.clientName}`, body });
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
  orderNumber?: string | null;
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
  // Документы клиента — отображаются в письме как ссылки на скачивание из приватного Storage.
  documents?: Array<{ label: string; filename: string; url: string }>;
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
  const documents = p.documents ?? [];
  const hasDocuments = documents.length > 0;
  const documentsHtml = hasDocuments
    ? documents.map((d) => `
        <a href="${escapeHtml(d.url)}" data-doc-link="1" target="_blank" rel="noopener noreferrer"
           style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin:6px 0;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;text-decoration:none;color:${BRAND.text};font-size:14px">
          <span style="display:flex;align-items:center;gap:10px;min-width:0">
            <span style="display:inline-block;padding:4px 8px;border-radius:6px;background:${BRAND.accentSoft};color:${BRAND.accent};font-size:11px;font-weight:600;letter-spacing:0.04em">PDF</span>
            <span style="font-weight:600;color:${BRAND.text};overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.label)}</span>
          </span>
          <span style="color:${BRAND.accent};font-size:13px;font-weight:600;white-space:nowrap">Скачать ↓</span>
        </a>`).join("")
    : "";

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
        ${metaRow("Номер заказа", `<span style="font-family:ui-monospace,monospace;color:${BRAND.text}">${escapeHtml(orderDisplayId(p.orderId, p.orderNumber))}</span>`)}
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

    ${hasDocuments ? `<div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin:0 0 24px">
      <div style="font-family:${FONT_DISPLAY};font-size:13px;font-weight:600;color:${BRAND.accent};margin-bottom:8px">Документы по заказу</div>
      <div style="font-size:13px;color:${BRAND.textSoft};line-height:1.55;margin-bottom:4px">
        Нажмите на нужный документ — он откроется в браузере или сохранится на устройство.
      </div>
      ${documentsHtml}
    </div>` : ""}

    <a href="${orderUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.accent},#f5c97a);color:#1a1208;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:14px;font-family:${FONT_DISPLAY}">Открыть личный кабинет</a>

    <p style="margin:26px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.55">
      Если у вас есть вопросы — ответьте на это письмо или напишите нам в чат на сайте.
    </p>`;

  const html = brandShell({
    title: subject,
    previewText: `Заказ ${orderDisplayId(p.orderId, p.orderNumber)} подтверждён. Итого ${fmtBYN(Number(p.total ?? 0))}.`,
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

  // PDF-документы передаются в письме как ссылки на скачивание из приватного Storage
  // (см. p.documents). Это позволяет отправлять через верифицированный Lovable Emails
  // и не зависеть от верификации домена в Resend для вложений.
  return enqueue({
    to: p.clientEmail,
    subject,
    html,
    label: "client-order-confirmed",
    messageId,
  });
}

// ===== Клиенту: коммерческое предложение (ссылка + PDF) =====

export type QuoteShareEmailPayload = {
  to: string;
  clientName: string;
  docTitle: string;
  docNumber: string;
  url: string;
  total: number;
  validUntil?: string | null;
  managerNote?: string;
  pdf?: { filename: string; bytes: Uint8Array } | null;
};

export async function sendQuoteShareEmail(p: QuoteShareEmailPayload): Promise<{ ok: boolean; error?: string }> {
  const to = (p.to ?? "").trim();
  if (!to) return { ok: false, error: "no client email" };

  const subject = `${p.docTitle} ${p.docNumber} — ${SITE_NAME}`;
  const body = `
    ${sectionLabel("Коммерческое предложение")}
    <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${BRAND.text};margin:0 0 12px">
      ${escapeHtml(p.docTitle)} ${escapeHtml(p.docNumber)}
    </div>
    <div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7;margin:0 0 18px">
      Здравствуйте${p.clientName ? `, ${escapeHtml(p.clientName)}` : ""}!<br/>
      Подготовили для вас предложение. Его можно открыть по ссылке, скачать в PDF
      и прямо там согласовать или задать вопрос.
    </div>
    ${p.managerNote ? `<div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7;margin:0 0 18px;white-space:pre-line">${escapeHtml(p.managerNote)}</div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
      ${metaRow("Сумма", `<strong>${escapeHtml(fmtBYN(p.total))}</strong>`)}
      ${p.validUntil ? metaRow("Действительно до", escapeHtml(p.validUntil)) : ""}
    </table>
    <a href="${escapeHtml(p.url)}"
       style="display:inline-block;background:${BRAND.accent};color:#16110a;font-weight:700;font-size:14px;
              padding:13px 26px;border-radius:12px;text-decoration:none">Открыть предложение</a>
    <div style="font-size:12px;color:${BRAND.muted};margin:16px 0 0;word-break:break-all">${escapeHtml(p.url)}</div>
  `;

  const html = brandShell({ title: subject, previewText: `${p.docTitle} ${p.docNumber}`, body });
  const messageId = `quote-share-${p.docNumber || "doc"}-${Date.now().toString(36)}`;

  if (p.pdf) {
    return sendWithAttachments({
      to, subject, html, label: "quote-share", messageId,
      attachments: [{ filename: p.pdf.filename, bytes: p.pdf.bytes }],
    });
  }
  return enqueue({ to, subject, html, label: "quote-share", messageId });
}

// ===== Клиенту: доступ в личный кабинет (после заказа) =====

export type AccountAccessEmailPayload = {
  to: string;
  clientName?: string | null;
  orderId: string;
  orderNumber?: string | null;
  /** Временный пароль. null — аккаунт уже существовал, пароль не менялся. */
  tempPassword: string | null;
};

export async function sendAccountAccessEmail(
  p: AccountAccessEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  const to = (p.to ?? "").trim();
  if (!to) return { ok: false, error: "no client email" };

  const loginUrl = `https://${FROM_DOMAIN}/login`;
  const resetUrl = `https://${FROM_DOMAIN}/forgot-password`;
  const orderLabel = orderDisplayId(p.orderId, p.orderNumber);
  const subject = p.tempPassword
    ? `Доступ в личный кабинет — заказ ${orderLabel}`
    : `Заказ ${orderLabel} добавлен в ваш личный кабинет`;

  const credentials = p.tempPassword
    ? `
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.accentBorder};border-radius:12px;padding:16px 18px;margin:0 0 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
        ${metaRow("Логин", `<span style="font-family:ui-monospace,monospace">${escapeHtml(to)}</span>`)}
        ${metaRow("Пароль", `<span style="font-family:ui-monospace,monospace;font-size:16px;letter-spacing:0.04em">${escapeHtml(p.tempPassword)}</span>`)}
      </table>
      <div style="font-size:12px;color:${BRAND.muted};margin-top:10px;line-height:1.55">
        Пароль временный — смените его в кабинете после первого входа.
      </div>
    </div>`
    : `
    <div style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin:0 0 20px">
      <div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7">
        У вас уже есть кабинет с логином
        <span style="font-family:ui-monospace,monospace;color:${BRAND.text}">${escapeHtml(to)}</span>.
        Войдите под своим паролем — заказ уже там. Забыли пароль?
        <a href="${resetUrl}" style="color:${BRAND.accent}">Восстановите доступ</a>.
      </div>
    </div>`;

  const body = `
    ${sectionLabel("Личный кабинет")}
    <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${BRAND.text};margin:0 0 12px">
      Здравствуйте${p.clientName ? `, ${escapeHtml(p.clientName)}` : ""}!
    </div>
    <div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7;margin:0 0 18px">
      Мы приняли заказ <strong style="color:${BRAND.text}">${escapeHtml(orderLabel)}</strong>
      и открыли для вас личный кабинет: там видно статус заказа, состав и историю обращений.
    </div>
    ${credentials}
    <a href="${loginUrl}" style="display:inline-block;background:${BRAND.accent};color:#16110a;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:700;font-size:14px;font-family:${FONT_DISPLAY}">Войти в кабинет</a>
    <div style="font-size:12px;color:${BRAND.muted};margin:16px 0 0;word-break:break-all">${loginUrl}</div>
    <p style="margin:22px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.55">
      Если вы не оформляли заказ — просто проигнорируйте это письмо.
    </p>`;

  const html = brandShell({
    title: subject,
    previewText: p.tempPassword
      ? `Данные для входа в личный кабинет по заказу ${orderLabel}`
      : `Заказ ${orderLabel} добавлен в ваш личный кабинет`,
    body,
  });

  return enqueue({
    to,
    subject,
    html,
    label: "account-access",
    messageId: `account-access-${p.orderId}`,
  });
}

// ===== Диджею: решение по заявке в DJ-клуб =====

export type DjMembershipEmailPayload = {
  to: string;
  nickname?: string | null;
  /** Куда вести из письма (уже проверенный путь вида /dj/pool). */
  path?: string;
  decision: "approved" | "rejected" | "blocked";
};

export async function sendDjMembershipEmail(
  p: DjMembershipEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  const to = (p.to ?? "").trim();
  if (!to) return { ok: false, error: "no email" };

  const url = `https://${FROM_DOMAIN}${p.path && p.path.startsWith("/dj") ? p.path : "/dj/pool"}`;
  const hello = p.nickname ? `, ${escapeHtml(p.nickname)}` : "";

  if (p.decision !== "approved") {
    const subject = "Заявка в DJ-клуб event-hub.by";
    const body = `
      ${sectionLabel("DJ-клуб")}
      <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${BRAND.text};margin:0 0 12px">
        Здравствуйте${hello}!
      </div>
      <div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7">
        Сейчас мы не можем открыть доступ к закрытому разделу. Если считаете, что это ошибка —
        ответьте на это письмо, мы разберёмся.
      </div>`;
    return enqueue({
      to,
      subject,
      html: brandShell({ title: subject, previewText: "Решение по заявке в DJ-клуб", body }),
      label: "dj-membership",
      messageId: `dj-membership-${p.decision}-${to}-${Date.now().toString(36)}`,
    });
  }

  const subject = "Доступ в DJ-клуб открыт";
  const body = `
    ${sectionLabel("DJ-клуб")}
    <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${BRAND.text};margin:0 0 12px">
      Добро пожаловать${hello}!
    </div>
    <div style="font-size:14px;color:${BRAND.textSoft};line-height:1.7;margin:0 0 18px">
      Заявка одобрена — библиотека треков, софт и загрузки уже доступны. Ссылка ведёт сразу в нужный раздел.
    </div>
    <a href="${url}" style="display:inline-block;background:${BRAND.accent};color:#16110a;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:700;font-size:14px;font-family:${FONT_DISPLAY}">Открыть библиотеку</a>
    <div style="font-size:12px;color:${BRAND.muted};margin:16px 0 0;word-break:break-all">${url}</div>`;

  return enqueue({
    to,
    subject,
    html: brandShell({ title: subject, previewText: "Доступ к библиотеке треков открыт", body }),
    label: "dj-membership",
    messageId: `dj-membership-approved-${to}-${Date.now().toString(36)}`,
  });
}
