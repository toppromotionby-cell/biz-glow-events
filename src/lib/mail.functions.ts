// Серверные функции почты. Все вызовы проксируются во внешний mail-worker
// (Render). Доступно только staff-ролям (admin/manager/marketer/content_editor).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  callMailWorker,
  mailWorkerHealth,
  type MailAccountCfg,
} from "@/lib/mail-worker.server";

type SbClient = SupabaseClient<any, any, any>;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// TanStack server fns serialize results, поэтому возвращаем уже-чистый JSON.
function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

const STAFF_ROLES = ["admin", "manager", "marketer", "content_editor"] as const;

async function assertStaff(supabase: SbClient, userId: string) {
  for (const role of STAFF_ROLES) {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: role,
    } as never);
    if (!error && data === true) return;
  }
  throw new Error("Forbidden: staff role required");
}

async function loadAccountCfg(supabase: SbClient, accountId: string): Promise<MailAccountCfg> {
  const { data, error } = await supabase
    .from("mail_accounts")
    .select(
      "email,username,password_encrypted,display_name,imap_host,imap_port,imap_secure,smtp_host,smtp_port,smtp_secure",
    )
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error("Account not found");
  const row = data as Record<string, unknown>;
  if (!row.imap_host || !row.smtp_host) throw new Error("Account is missing IMAP/SMTP host");
  if (!row.password_encrypted) throw new Error("Account password is not set");
  return {
    email: String(row.email),
    username: String(row.username ?? row.email),
    password: String(row.password_encrypted),
    display_name: (row.display_name as string | null) ?? null,
    imap_host: String(row.imap_host),
    imap_port: Number(row.imap_port ?? 993),
    imap_secure: Boolean(row.imap_secure ?? true),
    smtp_host: String(row.smtp_host),
    smtp_port: Number(row.smtp_port ?? 465),
    smtp_secure: Boolean(row.smtp_secure ?? true),
  };
}

// ───── /health (диагностика воркера, без секрета аккаунта) ─────
export const checkMailWorker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    try {
      const r = await mailWorkerHealth();
      return { ok: r.ok === true, ts: r.ts ?? null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

// ───── /test ─────
// Можно передать id уже сохранённого аккаунта ИЛИ полные креды для проверки
// перед сохранением.
const testInput = z.union([
  z.object({ accountId: z.string().uuid() }),
  z.object({
    email: z.string().email(),
    username: z.string().min(1),
    password: z.string().min(1),
    imap_host: z.string().min(1),
    imap_port: z.number().int().positive().optional(),
    imap_secure: z.boolean().optional(),
    smtp_host: z.string().min(1),
    smtp_port: z.number().int().positive().optional(),
    smtp_secure: z.boolean().optional(),
    display_name: z.string().nullable().optional(),
  }),
]);

export const testMailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const cfg: MailAccountCfg =
      "accountId" in data ? await loadAccountCfg(context.supabase, data.accountId) : data;
    return callMailWorker<{ ok: boolean; error?: string }>("/test", cfg, { timeoutMs: 30_000 });
  });

// ───── /folders ─────
export const listMailFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ accountId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Json> => {
    await assertStaff(context.supabase, context.userId);
    const cfg = await loadAccountCfg(context.supabase, data.accountId);
    return toJson(await callMailWorker("/folders", cfg, { timeoutMs: 30_000 }));
  });

// ───── /messages ─────
export const listMailMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        folder: z.string().min(1),
        since_uid: z.number().int().nonnegative().nullable().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        fetch_bodies: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<Json> => {
    await assertStaff(context.supabase, context.userId);
    const cfg = await loadAccountCfg(context.supabase, data.accountId);
    return toJson(
      await callMailWorker(
        "/messages",
        {
          account: cfg,
          folder: data.folder,
          since_uid: data.since_uid ?? null,
          limit: data.limit ?? 50,
          fetch_bodies: data.fetch_bodies ?? false,
        },
        { timeoutMs: 120_000 },
      ),
    );
  });

// ───── /send ─────
const addressSchema = z.union([
  z.string().email(),
  z.object({ name: z.string().optional(), address: z.string().email() }),
]);

export const sendMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        to: z.array(addressSchema).min(1),
        cc: z.array(addressSchema).optional(),
        bcc: z.array(addressSchema).optional(),
        subject: z.string().min(1),
        text: z.string().optional(),
        html: z.string().optional(),
        in_reply_to: z.string().optional(),
        references: z.array(z.string()).optional(),
        attachments: z
          .array(
            z.object({
              filename: z.string(),
              mime_type: z.string(),
              content_base64: z.string(),
            }),
          )
          .optional(),
        append_to_sent: z.boolean().optional(),
        sent_folder: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<Json> => {
    await assertStaff(context.supabase, context.userId);
    const cfg = await loadAccountCfg(context.supabase, data.accountId);
    const { accountId: _ignored, append_to_sent, sent_folder, ...message } = data;
    void _ignored;
    return toJson(
      await callMailWorker(
        "/send",
        {
          account: cfg,
          message,
          append_to_sent: append_to_sent ?? true,
          sent_folder: sent_folder ?? "Sent",
        },
        { timeoutMs: 60_000 },
      ),
    );
  });
