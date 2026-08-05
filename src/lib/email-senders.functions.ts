// Server functions для настройки отправителя писем (admin/manager).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SENDER_KINDS,
  buildSender,
  invalidateSenderCache,
  type SenderRow,
} from "@/lib/email/sender.server";

async function assertStaff(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: { role: string }) => ["admin", "manager"].includes(r.role));
  if (!ok) throw new Error("Доступ запрещён: требуется роль admin или manager");
}

export type EmailSender = SenderRow & { preview: string; replyPreview: string };

const decorate = (r: SenderRow): EmailSender => {
  const s = buildSender({
    fromName: r.from_name,
    fromEmail: r.from_email,
    replyTo: r.reply_to,
  });
  return { ...r, preview: s.from, replyPreview: s.replyTo };
};

export const listEmailSenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailSender[]> => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("email_senders")
      .select("kind, from_name, from_email, reply_to, inherit_default");
    if (error) throw new Error(error.message);
    const byKind = new Map((data ?? []).map((r: any) => [r.kind, r as SenderRow]));
    return SENDER_KINDS.map((kind) =>
      decorate(
        byKind.get(kind) ?? {
          kind,
          from_name: "",
          from_email: "",
          reply_to: "",
          inherit_default: kind !== "default",
        },
      ),
    );
  });

const EMAIL = z
  .string()
  .trim()
  .max(255)
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Некорректный e-mail");

export const updateEmailSender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.enum(SENDER_KINDS),
        from_name: z.string().trim().max(120),
        from_email: EMAIL,
        reply_to: EMAIL,
        inherit_default: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EmailSender> => {
    await assertStaff(context.supabase, context.userId);
    const row = {
      ...data,
      inherit_default: data.kind === "default" ? false : data.inherit_default,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase.from("email_senders").upsert(row, { onConflict: "kind" });
    if (error) throw new Error(error.message);
    invalidateSenderCache();
    return decorate(row as SenderRow);
  });

export const sendSenderTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ kind: z.enum(SENDER_KINDS), recipient: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context.supabase, context.userId);
    invalidateSenderCache();
    const { resolveSender } = await import("@/lib/email/sender.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sender = await resolveSender(data.kind);
    const messageId = crypto.randomUUID();
    const html = `<div style="font-family:system-ui,sans-serif;padding:24px">
      <h2 style="margin:0 0 12px">Тестовое письмо event-hub.by</h2>
      <p>Отправитель: <b>${sender.from}</b></p>
      <p>Ответы придут на: <b>${sender.replyTo}</b></p>
    </div>`;
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: `sender-test-${data.kind}`,
      recipient_email: data.recipient,
      status: "pending",
    });
    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: data.recipient,
        from: sender.from,
        reply_to: sender.replyTo,
        sender_domain: "notify.event-hub.by",
        subject: "[ТЕСТ] Проверка отправителя",
        html,
        text: `Отправитель: ${sender.from}. Ответы: ${sender.replyTo}`,
        purpose: "transactional",
        label: `sender-test-${data.kind}`,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
