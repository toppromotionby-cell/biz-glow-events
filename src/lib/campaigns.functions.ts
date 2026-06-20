// Server functions для админ-модуля email-кампаний.
// Все доступно только admin. Отправка через Resend connector gateway.
// Каждое письмо отправляется индивидуально — у каждого получателя свой unsubscribe-токен.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendViaResend } from "@/lib/email/resend.server";
import { wrapCampaignHtml, htmlToPlainText } from "@/lib/email/campaign-template.server";

async function assertAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Доступ запрещён: требуется роль admin");
}

const RecipientsConfigSchema = z.object({
  all_confirmed: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
  manual_emails: z.array(z.string().email()).default([]),
});

const CampaignInputSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(255),
  body_html: z.string().max(200_000).default(""),
  body_text: z.string().max(200_000).default(""),
  sender_email: z.string().email().max(255),
  sender_name: z.string().max(120).nullable().optional(),
  recipients_config: RecipientsConfigSchema,
});

// ─── Список и CRUD ──────────────────────────────────────────────

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

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: c, error } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return c;
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CampaignInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        name: data.name,
        subject: data.subject,
        body_html: data.body_html,
        body_text: data.body_text,
        sender_email: data.sender_email,
        sender_name: data.sender_name ?? null,
        recipients_config: data.recipients_config,
        status: "draft",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    CampaignInputSchema.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { id, ...rest } = data;
    // Запрещаем редактировать после отправки.
    const { data: existing } = await supabaseAdmin
      .from("email_campaigns")
      .select("status")
      .eq("id", id)
      .single();
    if (existing && (existing.status === "sending" || existing.status === "sent")) {
      throw new Error("Нельзя редактировать кампанию после отправки");
    }
    const { data: row, error } = await supabaseAdmin
      .from("email_campaigns")
      .update({
        name: rest.name,
        subject: rest.subject,
        body_html: rest.body_html,
        body_text: rest.body_text,
        sender_email: rest.sender_email,
        sender_name: rest.sender_name ?? null,
        recipients_config: rest.recipients_config,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("email_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Превью получателей ────────────────────────────────────────

export const previewRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RecipientsConfigSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const emails = await resolveRecipients(data);
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email");
    const suppressedSet = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));
    const willSend = emails.filter((e) => !suppressedSet.has(e.toLowerCase()));
    return {
      total: emails.length,
      suppressed: emails.length - willSend.length,
      will_send: willSend.length,
      sample: willSend.slice(0, 20),
    };
  });

// ─── Отчёт по кампании ────────────────────────────────────────

export const getCampaignReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const [{ data: campaign }, { data: recipients }] = await Promise.all([
      supabaseAdmin.from("email_campaigns").select("*").eq("id", data.id).single(),
      supabaseAdmin
        .from("email_campaign_recipients")
        .select("*")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);
    return { campaign, recipients: recipients ?? [] };
  });

// ─── Тестовая отправка себе ────────────────────────────────────

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), to: z.string().email() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: campaign, error } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !campaign) throw new Error("Кампания не найдена");

  
  

    const html = wrapCampaignHtml({
      subject: campaign.subject,
      bodyHtml: campaign.body_html,
      unsubscribeUrl: "https://event-hub.by/unsubscribe?token=test",
    });
    const text = campaign.body_text || htmlToPlainText(campaign.body_html);

    const result = await sendViaResend({
      from: campaign.sender_name
        ? `${campaign.sender_name} <${campaign.sender_email}>`
        : campaign.sender_email,
      to: data.to,
      subject: `[TEST] ${campaign.subject}`,
      html,
      text,
    });

    if (!result.ok) throw new Error(`Не удалось отправить тест: ${result.error}`);
    return { ok: true, message_id: result.id };
  });

// ─── Запуск массовой рассылки ──────────────────────────────────

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (cErr || !campaign) throw new Error("Кампания не найдена");
    if (campaign.status === "sending") throw new Error("Кампания уже отправляется");
    if (campaign.status === "sent") throw new Error("Кампания уже отправлена");

    const recipientsCfg = RecipientsConfigSchema.parse(campaign.recipients_config ?? {});
    const allEmails = await resolveRecipients(recipientsCfg);

    // Фильтр по suppression-list.
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email");
    const suppressedSet = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));
    const toSend = allEmails.filter((e) => !suppressedSet.has(e.toLowerCase()));

    if (toSend.length === 0) throw new Error("Нет получателей для отправки");

    // Помечаем кампанию как sending и засеиваем строки получателей.
    await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "sending",
        total_recipients: toSend.length,
        sent_count: 0,
        failed_count: 0,
      })
      .eq("id", data.id);

    // Удаляем старые записи (на случай повторного запуска) и засеиваем pending.
    await supabaseAdmin.from("email_campaign_recipients").delete().eq("campaign_id", data.id);
    await supabaseAdmin.from("email_campaign_recipients").insert(
      toSend.map((email) => ({
        campaign_id: data.id,
        email: email.toLowerCase(),
        status: "pending" as const,
      })),
    );

    // Запускаем отправку асинхронно (не ждём завершения).
    // На Cloudflare Workers ctx.waitUntil недоступен напрямую в server-fn,
    // поэтому делаем fire-and-forget с маленьким делеем между чанками.
    void runCampaignSend(data.id).catch((err) => {
      console.error("[campaigns] runCampaignSend failed", err);
    });

    return {
      ok: true,
      total: toSend.length,
      skipped_suppressed: allEmails.length - toSend.length,
    };
  });

// ─── helpers ───────────────────────────────────────────────────

async function resolveRecipients(cfg: z.infer<typeof RecipientsConfigSchema>): Promise<string[]> {
  const set = new Set<string>();

  if (cfg.all_confirmed) {
    // Все подтверждённые пользователи из auth.users.
    let page = 1;
    // perPage limit на Supabase admin API.
    while (page <= 10) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      for (const u of users) {
        const confirmed = u.email_confirmed_at ?? u.confirmed_at;
        if (confirmed && u.email) set.add(u.email.toLowerCase());
      }
      if (users.length < 1000) break;
      page += 1;
    }
  }

  if (cfg.roles.length > 0) {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", cfg.roles);
    const userIds = (roles ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        if (p.email) set.add(p.email.toLowerCase());
      }
    }
  }

  for (const e of cfg.manual_emails) {
    if (e) set.add(e.toLowerCase());
  }

  return Array.from(set);
}

async function runCampaignSend(campaignId: string): Promise<void> {



  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) return;

  const { data: pending } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("id, email")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const list = pending ?? [];
  let sent = 0;
  let failed = 0;
  const fromAddr = campaign.sender_name
    ? `${campaign.sender_name} <${campaign.sender_email}>`
    : campaign.sender_email;

  for (const r of list) {
    // Генерируем уникальный unsubscribe-токен для адреса.
    const token = crypto.randomUUID().replace(/-/g, "");
    await supabaseAdmin.from("email_unsubscribe_tokens").insert({
      email: r.email,
      token,
    });

    const unsubscribeUrl = `https://event-hub.by/unsubscribe?token=${token}`;
    const html = wrapCampaignHtml({
      subject: campaign.subject,
      bodyHtml: campaign.body_html,
      unsubscribeUrl,
    });
    const text = campaign.body_text || htmlToPlainText(campaign.body_html);

    const result = await sendViaResend({
      from: fromAddr,
      to: r.email,
      subject: campaign.subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@event-hub.by?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (result.ok) {
      sent += 1;
      await supabaseAdmin
        .from("email_campaign_recipients")
        .update({
          status: "sent",
          message_id: result.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", r.id);
    } else {
      failed += 1;
      await supabaseAdmin
        .from("email_campaign_recipients")
        .update({ status: "failed", error: result.error })
        .eq("id", r.id);
    }

    // Throttle ~5 req/sec.
    await new Promise((res) => setTimeout(res, 200));
  }

  await supabaseAdmin
    .from("email_campaigns")
    .update({
      status: failed === list.length ? "failed" : "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

export const STAFF_ROLES = ["admin", "manager", "content_editor", "marketer"] as const;
