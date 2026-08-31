// Отправка сохранённого документа администратору в Telegram.
// Доступ — только сотрудники с правом работы с документами.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaffRole } from "@/lib/authz";
import { TG_DOC_KINDS } from "@/lib/telegram/doc-export.server";

export type SendDocResult = { ok: boolean; error?: string };

const input = z.object({
  kind: z.enum(TG_DOC_KINDS),
  id: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export const sendDocumentToTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<SendDocResult> => {
    await assertStaffRole(context as never);

    const [{ buildTelegramDoc }, { tgSendDocument, adminChatId }] = await Promise.all([
      import("@/lib/telegram/doc-export.server"),
      import("@/lib/telegram/send.server"),
    ]);

    const chatId = adminChatId();
    if (!chatId) return { ok: false, error: "Не задан чат администратора в настройках Telegram" };

    let doc: Awaited<ReturnType<typeof buildTelegramDoc>>;
    try {
      doc = await buildTelegramDoc(data.kind, data.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось собрать документ";
      console.error("[tg-doc] build failed", { kind: data.kind, id: data.id, msg });
      return { ok: false, error: msg };
    }

    const caption = data.note ? `${doc.caption}\n\n${data.note}` : doc.caption;
    const res = await tgSendDocument(chatId, doc.filename, doc.bytes, caption);
    if (!res.ok) return { ok: false, error: res.error ?? "Telegram отклонил файл" };
    return { ok: true };
  });

/** Проверка готовности интеграции — чтобы кнопка не появлялась «в никуда». */
export const telegramDocsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ready: boolean; reason?: string }> => {
    await assertStaffRole(context as never);
    const { adminChatId, siteTgKey } = await import("@/lib/telegram/send.server");
    if (!siteTgKey()) return { ready: false, reason: "Telegram-бот не подключён" };
    if (!adminChatId()) return { ready: false, reason: "Не задан чат администратора" };
    return { ready: true };
  });
