// Подписка на e-mail рассылку — публичная серверная функция + админский список.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EmailSchema = z.object({
  email: z.string().email().max(160),
  source: z.string().max(80).optional().nullable(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    // SECURITY: не перезаписываем unsubscribed_at — это бы re-subscribe'нуло
    // отписавшихся (GDPR). Если запись существует и unsubscribed_at != null —
    // отвечаем ok без действий (anti-enumeration).
    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, unsubscribed_at")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      // Уже подписан или явно отписан — никаких изменений.
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email, source: data.source ?? "footer" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteSubscriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("newsletter_subscribers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
