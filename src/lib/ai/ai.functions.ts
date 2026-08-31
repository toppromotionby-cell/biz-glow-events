// Серверные функции панели «ИИ-провайдеры»: статус бесплатных нейросетей и роли самообучения.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Недостаточно прав");
}

export const aiProvidersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { providerStats } = await import("@/lib/ai/free-router.server");
    return { providers: providerStats() };
  });

export const aiRolesList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listRoles } = await import("@/lib/ai/self-roles.server");
    return { roles: await listRoles(supabaseAdmin) };
  });

export const aiLearnRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().trim().min(3).max(160), context: z.string().trim().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureRole } = await import("@/lib/ai/self-roles.server");
    const role = await ensureRole(supabaseAdmin, data.topic, {
      ...(data.context ? { context: data.context } : {}),
      refresh: true,
    });
    return { role };
  });
