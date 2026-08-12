// Клиентский доступ к каталогу сайта для конструкторов документов (только staff).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaffRole } from "@/lib/authz";
import { CATALOG_PICK_TYPES, type CatalogPick } from "@/lib/catalog-pick";

export const searchCatalogPicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        term: z.string().max(200).optional(),
        type: z.enum(CATALOG_PICK_TYPES as [string, ...string[]]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<CatalogPick[]> => {
    await assertStaffRole(context as never);
    const { searchCatalog } = await import("@/lib/catalog-pick.server");
    return searchCatalog(data as Parameters<typeof searchCatalog>[0]);
  });
