// Серверные функции догрузки медиа аттракционов (только staff).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BackfillResult } from "@/lib/attractions-media.server";

export type { BackfillResult };

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
