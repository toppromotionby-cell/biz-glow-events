// Серверные функции админки для бота-помощника: настройка, привязка, знания, гигиена.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }): Promise<void> {
  const { data } = await (context.supabase.rpc as (n: string, a: unknown) => Promise<{ data: boolean | null }>)(
    "has_role",
    { _user_id: context.userId, _role: "admin" },
  );
  if (!data) throw new Error("Недостаточно прав");
}

export const assistantStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { assistantBotConfigured, assistantTransportMode, tgGetMe, tgWebhookInfo } = await import(
      "@/lib/assistant/transport.server"
    );
    const { getSettings, allLinks } = await import("@/lib/assistant/store.server");
    const settings = await getSettings();
    const links = await allLinks();
    const mode = assistantTransportMode();
    if (!assistantBotConfigured()) {
      return { configured: false, mode, bot: null, webhook: null, settings, links };
    }
    const [bot, webhook] = await Promise.all([tgGetMe(), tgWebhookInfo()]);
    return { configured: true, mode, bot, webhook, settings, links };
  });

export const assistantRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { baseUrl: string }) => {
    if (!/^https:\/\/[\w.-]+$/.test(input.baseUrl.replace(/\/$/, ""))) throw new Error("Некорректный адрес сайта");
    return { baseUrl: input.baseUrl.replace(/\/$/, "") };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { assistantTgKey, assistantBotToken, tgSetWebhook, tgSetMyCommands } = await import(
      "@/lib/assistant/transport.server"
    );
    const key = assistantTgKey() ?? assistantBotToken();
    if (!key) throw new Error("Бот не подключён: нет ни ключа подключения, ни токена бота");
    const { assistantWebhookSecret } = await import("@/routes/api/public/assistant/webhook");
    const ok = await tgSetWebhook(`${data.baseUrl}/api/public/assistant/webhook`, assistantWebhookSecret(key));

    await tgSetMyCommands();
    if (!ok) throw new Error("Telegram отклонил регистрацию вебхука");
    return { ok: true };
  });

export const assistantSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { patchSettings } = await import("@/lib/assistant/store.server");
    return patchSettings(data as never);
  });

export const assistantIssueCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { issueLinkCode } = await import("@/lib/assistant/store.server");
    const code = await issueLinkCode((context as { userId: string }).userId);
    return { code };
  });

export const assistantUnlink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chatId: number }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { unlinkChat } = await import("@/lib/assistant/store.server");
    await unlinkChat(data.chatId);
    return { ok: true };
  });

export const assistantKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { listFacts } = await import("@/lib/knowledge/facts.server");
    return { facts: await listFacts({ limit: 200 }) };
  });

export const assistantSaveFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; fact: string; scope?: string }) => {
    if (!input.subject?.trim() || !input.fact?.trim()) throw new Error("Заполните тему и факт");
    return input;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { upsertFact } = await import("@/lib/knowledge/facts.server");
    return upsertFact({
      subject: data.subject,
      fact: data.fact,
      scope: data.scope ?? "manual",
      sourceKind: "manual",
      authorId: (context as { userId: string }).userId,
      confidence: 0.95,
    });
  });

export const assistantFactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "active" | "pending" | "stale" | "rejected" }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { setFactStatus } = await import("@/lib/knowledge/facts.server");
    await setFactStatus(data.id, data.status);
    return { ok: true };
  });

export const assistantHygieneState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { openFindings } = await import("@/lib/hygiene/engine.server");
    return { findings: await openFindings(100) };
  });

export const assistantRunHygiene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { runHygiene } = await import("@/lib/hygiene/engine.server");
    return runHygiene();
  });

export const assistantDecideFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "fixed" | "dismissed" }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { decideFinding } = await import("@/lib/hygiene/engine.server");
    await decideFinding(data.id, data.status, (context as { userId: string }).userId);
    return { ok: true };
  });
