import { assertPermission } from "@/lib/authz";
// Клиентский доступ к базе знаний документов (подсказки в конструкторах).
// Только для staff: проверка ролей внутри обработчика.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContactHit, ItemHit, TextHit } from "@/lib/doc-knowledge.server";

export type { ContactHit, ItemHit, TextHit };

const TEXT_KINDS = ["note", "footer", "section", "venue", "event_format", "term"] as const;

async function assertStaff(context: { supabase: unknown; userId: string }) {
  await assertPermission(context as never, "documents.knowledge");
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

/* ---------------- Управление базой знаний (админка) ---------------- */

import type { KbRow, KbSort, KbTable } from "@/lib/doc-knowledge.server";

export type { KbRow, KbSort, KbTable };

export const listKnowledgeRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(["contacts", "items", "texts"]),
      term: z.string().max(200).optional(),
      sort: z.enum(["usage", "recent", "alpha"]).optional(),
      kind: z.string().max(40).optional(),
      page: z.number().int().min(0).max(10000).optional(),
      pageSize: z.number().int().min(1).max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ rows: KbRow[]; total: number }> => {
    await assertStaff(context as never);
    const { listKnowledge } = await import("@/lib/doc-knowledge.server");
    return listKnowledge(data);
  });

export const deleteKnowledgeRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["contacts", "items", "texts"]), ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ deleted: number }> => {
    await assertStaff(context as never);
    const { deleteKnowledge } = await import("@/lib/doc-knowledge.server");
    return { deleted: await deleteKnowledge(data.table, data.ids) };
  });

export const countStaleKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["contacts", "items", "texts"]), months: z.number().int().min(1).max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ count: number }> => {
    await assertStaff(context as never);
    const { countStale } = await import("@/lib/doc-knowledge.server");
    return { count: await countStale(data.table, data.months ?? 6) };
  });

export const pruneStaleKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["contacts", "items", "texts"]), months: z.number().int().min(1).max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ deleted: number }> => {
    await assertStaff(context as never);
    const { pruneStale } = await import("@/lib/doc-knowledge.server");
    return { deleted: await pruneStale(data.table, data.months ?? 6) };
  });

export const syncCatalogKnowledgeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ synced: number }> => {
    await assertStaff(context as never);
    const { syncCatalogKnowledge } = await import("@/lib/doc-knowledge.server");
    return syncCatalogKnowledge();
  });

import type { ItemBrowseHit } from "@/lib/doc-knowledge.server";

export type { ItemBrowseHit };

/** Каталог позиций базы знаний для массового добавления в КП/смету. */
export const browseKnowledgeItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      term: z.string().max(200).optional(),
      section: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: ItemBrowseHit[]; sections: string[] }> => {
    await assertStaff(context as never);
    const { browseItems } = await import("@/lib/doc-knowledge.server");
    return browseItems(data);
  });

/* ---------------- Гигиена базы знаний ---------------- */

import type { KnowledgeHealth, RetentionPolicy } from "@/lib/doc-knowledge.server";

export type { KnowledgeHealth, RetentionPolicy };

const policySchema = z
  .object({ minUsage: z.number().int().min(1).max(20).optional(), months: z.number().int().min(1).max(60).optional() })
  .optional();

const toPolicy = (p?: { minUsage?: number; months?: number }): RetentionPolicy => ({
  minUsage: p?.minUsage ?? 2,
  months: p?.months ?? 6,
});

export const knowledgeHealthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => policySchema.parse(d ?? undefined))
  .handler(async ({ data, context }): Promise<KnowledgeHealth[]> => {
    await assertStaff(context as never);
    const { knowledgeHealth } = await import("@/lib/doc-knowledge.server");
    return knowledgeHealth(toPolicy(data));
  });

export const runKnowledgeHygieneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => policySchema.parse(d ?? undefined))
  .handler(async ({ data, context }): Promise<{ merged: number; pruned: number }> => {
    await assertStaff(context as never);
    const { runKnowledgeHygiene } = await import("@/lib/doc-knowledge.server");
    return runKnowledgeHygiene(toPolicy(data));
  });

export const mergeKnowledgeDuplicatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: z.enum(["contacts", "items", "texts"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ merged: number }> => {
    await assertStaff(context as never);
    const { mergeKnowledgeDuplicates } = await import("@/lib/doc-knowledge.server");
    return { merged: await mergeKnowledgeDuplicates(data.table) };
  });
