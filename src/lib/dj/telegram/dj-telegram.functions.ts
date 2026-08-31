// Серверные функции админки для диджей-бота. Только тонкие обёртки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireDjManager } from "@/lib/dj/guard.server";

export const djTgStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    const { botStatus } = await import("./admin.server");
    return botStatus(context.userId);
  });

export const djTgIssueCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    const { issueLinkCode } = await import("./store.server");
    return { code: await issueLinkCode(context.userId) };
  });

export const djTgSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        notify_applications: z.boolean().optional(),
        notify_tracks: z.boolean().optional(),
        notify_rejects: z.boolean().optional(),
        notify_digest: z.boolean().optional(),
        announce_publications: z.boolean().optional(),
        daily_digest_hour: z.number().int().min(0).max(23).optional(),
        weekly_digest_dow: z.number().int().min(0).max(6).optional(),
        group_chat_id: z.number().int().nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    const { patchSettings } = await import("./store.server");
    return patchSettings(data);
  });

export const djTgRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    const { registerWebhook } = await import("./admin.server");
    return registerWebhook();
  });

export const djTgUnlink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    const { unlinkChat } = await import("./store.server");
    await unlinkChat(data.chatId);
    return { ok: true };
  });

export const djTgTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    const { sendTestMessage } = await import("./admin.server");
    return sendTestMessage(context.userId);
  });
