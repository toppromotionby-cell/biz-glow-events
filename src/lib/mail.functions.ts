// Серверные функции почты. Все вызовы проксируются во внешний mail-worker
// (Render). Доступно только staff-ролям (admin/manager/accountant/content_editor).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  callMailWorker,
  mailWorkerHealth,
  MailWorkerError,
  type MailAccountCfg,
} from "@/lib/mail-worker.server";
import { mailErrorHint, type MailStep, type MailSuggestion } from "@/lib/mail-diagnostics";

type SbClient = SupabaseClient<any, any, any>;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// TanStack server fns serialize results, поэтому возвращаем уже-чистый JSON.
function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

const STAFF_ROLES = ["admin", "manager", "accountant", "content_editor"] as const;

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
  const { decryptMailPassword } = await import("@/lib/mail-crypto.server");
  return {
    email: String(row.email),
    username: String(row.username ?? row.email),
    password: decryptMailPassword(String(row.password_encrypted)),
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
    const started = Date.now();
    try {
      await assertStaff(context.supabase, context.userId);
      const accountId = "accountId" in data ? data.accountId : null;
      const cfg: MailAccountCfg =
        "accountId" in data ? await loadAccountCfg(context.supabase, data.accountId) : data;

      type WorkerTest = {
        ok?: boolean;
        error?: string;
        error_kind?: string;
        steps?: MailStep[];
        suggestion?: MailSuggestion | null;
      };

      let ok = false;
      let status: number | null = null;
      let message = "";
      let details: unknown = null;
      let result: WorkerTest = { ok: false };

      try {
        result = await callMailWorker<WorkerTest>("/test", cfg, {
          timeoutMs: 45_000,
          retryOnTimeout: false,
        });
        ok = result.ok === true;
        status = 200;
        message = ok ? "OK" : (result.error ?? "Unknown error");
        details = result;
      } catch (err) {
        ok = false;
        if (err instanceof MailWorkerError) {
          status = err.status || null;
          message = err.message;
          if (err.data && typeof err.data === "object") result = err.data as WorkerTest;
        } else {
          message = err instanceof Error ? err.message : String(err);
        }
        details = result.steps ? result : { error: message, status };
        result = { ...result, ok: false, error: result.error ?? message };
      }

      const steps: MailStep[] =
        result.steps && result.steps.length > 0
          ? result.steps
          : ok
            ? []
            : [
                {
                  step: "smtp",
                  ok: false,
                  kind: status === 504 ? "timeout" : (result.error_kind ?? "unknown"),
                  message,
                },
              ];
      const failed = steps.find((s) => !s.ok);
      const hint = ok
        ? null
        : mailErrorHint(failed?.kind ?? result.error_kind, failed?.step);

      const duration = Date.now() - started;

      // Автоприменение рабочих настроек, найденных подбором.
      let applied = false;
      const sug = result.suggestion ?? null;
      if (ok && accountId && sug) {
        const patch: Record<string, unknown> = {};
        if (sug.username && sug.username !== cfg.username) patch.username = sug.username;
        if (sug.imap_port && sug.imap_port !== cfg.imap_port) patch.imap_port = sug.imap_port;
        if (sug.imap_secure !== cfg.imap_secure) patch.imap_secure = sug.imap_secure;
        if (sug.smtp_port && sug.smtp_port !== cfg.smtp_port) patch.smtp_port = sug.smtp_port;
        if (sug.smtp_secure !== cfg.smtp_secure) patch.smtp_secure = sug.smtp_secure;
        if (Object.keys(patch).length > 0) {
          const { error: applyErr } = await context.supabase
            .from("mail_accounts")
            .update(patch as never)
            .eq("id", accountId);
          if (applyErr) console.error("mail settings auto-apply failed:", applyErr.message);
          else applied = true;
        }
      }

      if (accountId) {
        const logRow = {
          account_id: accountId,
          checked_by: context.userId,
          ok,
          status_code: status,
          message: message.slice(0, 2000),
          details: toJson(details),
          duration_ms: duration,
        };
        try {
          const [logRes, updRes] = await Promise.all([
            context.supabase.from("mail_account_checks").insert(logRow as never),
            context.supabase
              .from("mail_accounts")
              .update({
                status: ok ? "active" : "error",
                sync_error: ok ? null : `${message}${hint ? ` — ${hint}` : ""}`.slice(0, 1000),
                last_sync_at: ok ? new Date().toISOString() : undefined,
              } as never)
              .eq("id", accountId),
          ]);
          if (logRes.error) console.error("mail check log insert failed:", logRes.error.message);
          if (updRes.error) console.error("mail account status update failed:", updRes.error.message);
        } catch (logErr) {
          console.error("mail check logging crashed:", logErr);
        }
      }

      return {
        ok,
        status_code: status,
        message,
        hint,
        steps: toJson(steps) as unknown as MailStep[],
        suggestion: sug,
        applied,
        duration_ms: duration,
        error: result.error ?? null,
      };

    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      return {
        ok: false,
        status_code: 0,
        message: msg,
        duration_ms: Date.now() - started,
        error: msg,
      };
    }
  });

// ───── Журнал проверок ─────
export const listMailAccountChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("mail_account_checks")
      .select("id,ok,status_code,message,duration_ms,created_at")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (error) throw new Error(error.message);
    return { checks: rows ?? [] };
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
