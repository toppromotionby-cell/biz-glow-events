import { assertPermission } from "@/lib/authz";
// Серверные функции догрузки медиа аттракционов (только staff).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BackfillResult } from "@/lib/attractions-media.server";

export type { BackfillResult };

async function assertStaff(context: { supabase: unknown; userId: string }) {
  await assertPermission(context as never, "content.manage");
}

export const getMissingPhotoCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    await assertStaff(context as never);
    const { countAttractionsMissingPhotos } = await import("@/lib/attractions-media.server");
    return countAttractionsMissingPhotos();
  });

export const backfillAttractionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(25).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<BackfillResult> => {
    await assertStaff(context as never);
    const { backfillAttractionPhotos } = await import("@/lib/attractions-media.server");
    return backfillAttractionPhotos(data.limit ?? 10);
  });
