// CRUD для mail_accounts. RLS уже ограничивает доступ admin/manager,
// плюс requireSupabaseAuth прикладывает токен пользователя.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const accountInput = z.object({
  email: z.string().email(),
  username: z.string().min(1).nullable().optional(),
  display_name: z.string().nullable().optional(),
  password: z.string().min(1).nullable().optional(),
  provider: z.string().default("imap"),
  imap_host: z.string().min(1),
  imap_port: z.number().int().positive().default(993),
  imap_secure: z.boolean().default(true),
  smtp_host: z.string().min(1),
  smtp_port: z.number().int().positive().default(465),
  smtp_secure: z.boolean().default(true),
});

export const listMailAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mail_accounts")
      .select(
        "id,email,display_name,username,provider,imap_host,imap_port,imap_secure,smtp_host,smtp_port,smtp_secure,status,sync_error,last_sync_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const createMailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => accountInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      email: data.email,
      username: data.username ?? data.email,
      display_name: data.display_name ?? null,
      password_encrypted: data.password ?? null,
      provider: data.provider,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_secure: data.imap_secure,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_secure: data.smtp_secure,
      status: "pending",
    };
    const { data: inserted, error } = await context.supabase
      .from("mail_accounts")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted!.id as string };
  });

export const updateMailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: accountInput.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const p = data.patch;
    const update: Record<string, unknown> = {};
    if (p.email !== undefined) update.email = p.email;
    if (p.username !== undefined) update.username = p.username;
    if (p.display_name !== undefined) update.display_name = p.display_name;
    if (p.password) update.password_encrypted = p.password; // не перетираем пустой
    if (p.provider !== undefined) update.provider = p.provider;
    if (p.imap_host !== undefined) update.imap_host = p.imap_host;
    if (p.imap_port !== undefined) update.imap_port = p.imap_port;
    if (p.imap_secure !== undefined) update.imap_secure = p.imap_secure;
    if (p.smtp_host !== undefined) update.smtp_host = p.smtp_host;
    if (p.smtp_port !== undefined) update.smtp_port = p.smtp_port;
    if (p.smtp_secure !== undefined) update.smtp_secure = p.smtp_secure;
    const { error } = await context.supabase
      .from("mail_accounts")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mail_accounts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
