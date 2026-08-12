// Server functions журнала аудита. Тонкая обёртка: вся логика в audit.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FiltersSchema = z.object({
  table: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FiltersSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const { assertPermission } = await import("@/lib/authz");
    await assertPermission(context as never, "audit.view");
    const { queryAuditLog } = await import("@/lib/audit.server");
    return queryAuditLog(data);
  });

export const getAuditFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPermission } = await import("@/lib/authz");
    await assertPermission(context as never, "audit.view");
    const { queryAuditFacets } = await import("@/lib/audit.server");
    return queryAuditFacets();
  });
