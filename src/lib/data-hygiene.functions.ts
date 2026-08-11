// Гигиена данных портала: серверные функции для админки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/authz";
import type { HygieneReport, HygieneTable } from "@/lib/data-hygiene.server";

export type { HygieneReport, HygieneTable };

const TABLES = [
  "zones",
  "services",
  "tech_equipment",
  "production_items",
  "attractions",
  "cases",
  "blog_posts",
  "catalog_sections",
] as const;

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  await assertPermission(context as never, "system.manage");
}

export const scanHygieneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HygieneReport> => {
    await assertAdmin(context as never);
    const { scanHygiene } = await import("@/lib/data-hygiene.server");
    return scanHygiene();
  });

export const hideHygieneRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(TABLES), ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ affected: number }> => {
    await assertAdmin(context as never);
    const { hideRecords } = await import("@/lib/data-hygiene.server");
    return { affected: await hideRecords(data.table, data.ids) };
  });

export const deleteHygieneRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(TABLES), ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ affected: number }> => {
    await assertAdmin(context as never);
    const { deleteRecords } = await import("@/lib/data-hygiene.server");
    return { affected: await deleteRecords(data.table, data.ids) };
  });
