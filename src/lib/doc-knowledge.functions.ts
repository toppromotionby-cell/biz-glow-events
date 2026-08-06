// Клиентский доступ к базе знаний документов (подсказки в конструкторах).
// Только для staff: проверка ролей внутри обработчика.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContactHit, ItemHit, TextHit } from "@/lib/doc-knowledge.server";

export type { ContactHit, ItemHit, TextHit };

const TEXT_KINDS = ["note", "footer", "section", "venue", "event_format", "term"] as const;

async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!isAdmin && !isManager) throw new Error("Forbidden");
}

export const suggestContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { term?: string }) => z.object({ term: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<ContactHit[]> => {
    await assertStaff(context as never);
    const { searchContacts } = await import("@/lib/doc-knowledge.server");
    return searchContacts(data.term ?? "");
  });

export const suggestItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { term?: string; section?: string }) =>
    z.object({ term: z.string().max(200).optional(), section: z.string().max(120).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ItemHit[]> => {
    await assertStaff(context as never);
    const { searchItems } = await import("@/lib/doc-knowledge.server");
    return searchItems(data.term ?? "", data.section);
  });

export const suggestTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string; term?: string }) =>
    z.object({ kind: z.enum(TEXT_KINDS), term: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TextHit[]> => {
    await assertStaff(context as never);
    const { searchTexts } = await import("@/lib/doc-knowledge.server");
    return searchTexts(data.kind, data.term ?? "");
  });
