// Server functions для блока «Приглашения новым клиентам».
// Заменили старый полноценный CRUD кампаний на простой сценарий:
// staff (admin/manager) отправляет фирменное письмо-приглашение
// на 1–10 email одной кнопкой через инфраструктуру Lovable Emails.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as React from "react";
import { render } from "@react-email/components";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEMPLATES } from "@/lib/email-templates/registry";

const TEMPLATE_NAME = "client-invite";
const FROM_DOMAIN = "event-hub.by";
const SENDER_DOMAIN = "notify.event-hub.by";
const SITE_NAME = "event-hub.by";
const FROM_EMAIL = `noreply@${FROM_DOMAIN}`;
const FROM_ADDRESS = `${SITE_NAME} <${FROM_EMAIL}>`;
const REPLY_TO_ADDRESS = FROM_EMAIL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string[]): string[] {
  const set = new Set<string>();
  for (const e of raw) {
    const v = (e ?? "").trim().toLowerCase();
    if (EMAIL_RE.test(v)) set.add(v);
  }
  return Array.from(set);
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertStaff(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = (data ?? []).some((r: { role: string }) =>
    ["admin", "manager"].includes(r.role),
  );
  if (!ok) throw new Error("Доступ запрещён: требуется роль admin или manager");
}

// ── Превью HTML ───────────────────────────────────────────────────
export const previewInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        recipient_name: z.string().max(120).optional(),
        personal_message: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const tpl = TEMPLATES[TEMPLATE_NAME];
    const element = React.createElement(tpl.component, {
      recipientName: data.recipient_name,
      personalMessage: data.personal_message,
    });
    const html = await render(element);
    const subject =
      typeof tpl.subject === "function"
        ? tpl.subject({ recipientName: data.recipient_name })
        : tpl.subject;
    return { html, subject };
  });

// ── Последние отправленные приглашения (для лога) ────────────────
export const listRecentInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, message_id, recipient_email, status, error_message, created_at")
      .eq("template_name", TEMPLATE_NAME)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    // Дедуп по message_id — оставляем последнюю запись (она первая после сортировки DESC).
    const seen = new Set<string>();
    const out: typeof data = [];
    for (const row of data ?? []) {
      const key = row.message_id ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= 20) break;
    }
    return out;
  });

// ── Отправка приглашений (1–10 адресов за раз) ───────────────────
export const sendClientInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        emails: z.array(z.string()).min(1).max(10),
        recipient_name: z.string().max(120).optional(),
        personal_message: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const emails = parseEmails(data.emails);
    if (emails.length === 0) throw new Error("Не распознано ни одного email");
    if (emails.length > 10) throw new Error("Максимум 10 адресов за раз");

    const tpl = TEMPLATES[TEMPLATE_NAME];
    if (!tpl) throw new Error("Шаблон client-invite не найден");

    // Если адресов больше одного — индивидуальное обращение по имени теряет смысл.
    const recipientName = emails.length === 1 ? data.recipient_name : undefined;

    const element = React.createElement(tpl.component, {
      recipientName,
      personalMessage: data.personal_message,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof tpl.subject === "function"
        ? tpl.subject({ recipientName })
        : tpl.subject;

    // Проверяем suppression одним запросом.
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    const suppressedSet = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));

    const results: Array<{ email: string; status: "queued" | "suppressed" | "failed"; error?: string }> = [];

    for (const email of emails) {
      if (suppressedSet.has(email)) {
        const messageId = crypto.randomUUID();
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: email,
          status: "suppressed",
        });
        results.push({ email, status: "suppressed" });
        continue;
      }

      // Unsubscribe-токен: один на адрес. Берём существующий или создаём.
      let unsubscribeToken: string;
      const { data: existingToken } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token, used_at")
        .eq("email", email)
        .maybeSingle();

      if (existingToken && !existingToken.used_at) {
        unsubscribeToken = existingToken.token;
      } else if (!existingToken) {
        unsubscribeToken = generateToken();
        await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .upsert(
            { token: unsubscribeToken, email },
            { onConflict: "email", ignoreDuplicates: true },
          );
        const { data: stored } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", email)
          .maybeSingle();
        unsubscribeToken = stored?.token ?? unsubscribeToken;
      } else {
        // Токен использован — адрес уже отписался, но не попал в suppressed_emails (редкий кейс).
        results.push({ email, status: "suppressed" });
        continue;
      }

      const messageId = crypto.randomUUID();
      const idempotencyKey = `client-invite-${email}-${new Date().toISOString().slice(0, 10)}`;

      // Лог pending до enqueue.
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: TEMPLATE_NAME,
        recipient_email: email,
        status: "pending",
      });

      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: email,
          from: FROM_ADDRESS,
          reply_to: REPLY_TO_ADDRESS,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: TEMPLATE_NAME,
          idempotency_key: idempotencyKey,
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqErr) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: email,
          status: "failed",
          error_message: enqErr.message,
        });
        results.push({ email, status: "failed", error: enqErr.message });
      } else {
        results.push({ email, status: "queued" });
      }
    }

    return {
      total: emails.length,
      queued: results.filter((r) => r.status === "queued").length,
      suppressed: results.filter((r) => r.status === "suppressed").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  });
