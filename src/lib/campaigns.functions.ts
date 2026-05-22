// Массовые email-кампании — для пиара портала.
// Использует существующую очередь Lovable Emails (transactional_emails) для постепенной отправки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SENDER_DOMAIN = "z.event-hub.by";
const FROM_ADDRESS = "Event Hub <noreply@z.event-hub.by>";
const BATCH_SIZE = 50;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) {
    throw new Error("Только администратор может управлять кампаниями");
  }
}

// === Список и получение ===
export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: c, error } = await supabaseAdmin
      .from("email_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Кампания не найдена");
    const { data: recipients } = await supabaseAdmin
      .from("email_campaign_recipients")
      .select("*")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true })
      .limit(2000);
    return { campaign: c, recipients: recipients ?? [] };
  });

// === Создание / обновление черновика ===
const CampaignInput = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().min(1).max(255),
  html_content: z.string().min(1).max(200000),
  recipient_filter: z.object({
    mode: z.enum(["confirmed_subscribers", "all_subscribers", "manual"]),
    emails: z.array(z.string().email()).max(5000).optional(),
  }),
});

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CampaignInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("email_campaigns")
        .update({
          subject: data.subject,
          html_content: data.html_content,
          recipient_filter: data.recipient_filter,
        })
        .eq("id", data.id)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("email_campaigns")
        .insert({
          subject: data.subject,
          html_content: data.html_content,
          recipient_filter: data.recipient_filter,
          created_by: context.userId,
        })
        .select("id").single();
      if (error) throw new Error(error.message);
      return { id: created.id };
    }
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("email_campaigns").delete().eq("id", data.id).eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === Запуск отправки ===
async function resolveRecipients(filter: { mode: string; emails?: string[] }): Promise<{ email: string; name?: string | null }[]> {
  if (filter.mode === "manual") {
    const list = (filter.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(list)).map((email) => ({ email }));
  }
  let q = supabaseAdmin.from("newsletter_subscribers")
    .select("email, confirmed, unsubscribed_at")
    .is("unsubscribed_at", null);
  if (filter.mode === "confirmed_subscribers") q = q.eq("confirmed", true);
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ email: r.email }));
}

function renderEmailHtml(subject: string, body: string): string {
  // Простая обёртка с базовой стилизацией + плейсхолдеры заменяются при отправке.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
<tr><td style="padding:32px 32px 16px 32px;border-bottom:3px solid #6366f1;">
<h1 style="margin:0;font-size:22px;color:#111;">Event Hub</h1>
</td></tr>
<tr><td style="padding:24px 32px;color:#333;font-size:15px;line-height:1.6;">
${body}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center;">
event-hub.by · Минск, Беларусь
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const startCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("email_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!campaign) throw new Error("Кампания не найдена");
    if (campaign.status !== "draft") throw new Error("Кампания уже запущена");

    const recipients = await resolveRecipients(campaign.recipient_filter as any);
    if (recipients.length === 0) throw new Error("Нет получателей");

    // Проверяем suppressed
    const emails = recipients.map((r) => r.email);
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails").select("email").in("email", emails);
    const suppressedSet = new Set((suppressed ?? []).map((s) => s.email));

    // Вставляем получателей
    const rows = recipients.map((r) => ({
      campaign_id: campaign.id,
      email: r.email,
      name: r.name ?? null,
      status: suppressedSet.has(r.email) ? "suppressed" : "pending",
    }));
    // вставляем чанками по 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("email_campaign_recipients").insert(chunk);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("email_campaigns").update({
      status: "sending",
      total_recipients: rows.length,
      suppressed_count: suppressedSet.size,
      started_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    // Запускаем фоновую постановку в очередь (не ждём)
    enqueueAllForCampaign(campaign.id).catch((e) => console.error("enqueue failed", e));

    return { ok: true, total: rows.length, suppressed: suppressedSet.size };
  });

// Фоновое: ставит всех pending получателей в очередь
async function enqueueAllForCampaign(campaignId: string) {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns").select("subject, html_content").eq("id", campaignId).single();
  if (!campaign) return;

  const html = renderEmailHtml(campaign.subject, campaign.html_content);

  while (true) {
    const { data: pending } = await supabaseAdmin
      .from("email_campaign_recipients")
      .select("id, email")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .limit(BATCH_SIZE);

    if (!pending || pending.length === 0) break;

    for (const rec of pending) {
      const messageId = `campaign-${campaignId}-${rec.id}`;
      const payload = {
        to: rec.email,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject: campaign.subject,
        html,
        label: "campaign-broadcast",
        message_id: messageId,
        idempotency_key: messageId,
        purpose: "transactional",
        queued_at: new Date().toISOString(),
      };
      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });
      if (enqErr) {
        await supabaseAdmin.from("email_campaign_recipients")
          .update({ status: "failed", error: enqErr.message }).eq("id", rec.id);
      } else {
        await supabaseAdmin.from("email_campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", rec.id);
      }
    }
  }

  // Обновляем статистику кампании
  const { data: stats } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  const sent = (stats ?? []).filter((r) => r.status === "sent").length;
  const failed = (stats ?? []).filter((r) => r.status === "failed").length;

  await supabaseAdmin.from("email_campaigns").update({
    status: "completed",
    sent_count: sent,
    failed_count: failed,
    completed_at: new Date().toISOString(),
  }).eq("id", campaignId);
}

export const refreshCampaignStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: stats } = await supabaseAdmin
      .from("email_campaign_recipients").select("status").eq("campaign_id", data.id);
    const sent = (stats ?? []).filter((r) => r.status === "sent").length;
    const failed = (stats ?? []).filter((r) => r.status === "failed").length;
    const pending = (stats ?? []).filter((r) => r.status === "pending").length;
    await supabaseAdmin.from("email_campaigns").update({
      sent_count: sent,
      failed_count: failed,
    }).eq("id", data.id);
    return { sent, failed, pending };
  });
