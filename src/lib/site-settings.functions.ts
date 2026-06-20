// Server functions для публичных настроек сайта (соц. ссылки).
// Чтение — публично (TanStack-серверный publishable клиент).
// Запись — только admin/manager.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type SiteSettings = {
  instagram_url: string | null;
  tiktok_url: string | null;
};

const URL_SCHEMA = z
  .string()
  .trim()
  .max(500)
  .url({ message: "Введите корректный URL (https://…)" })
  .refine((v) => /^https?:\/\//i.test(v), "URL должен начинаться с http(s)://")
  .nullable()
  .or(z.literal("").transform(() => null));

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async (): Promise<SiteSettings> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("instagram_url, tiktok_url")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    // Не валим SSR — возвращаем пустые ссылки.
    return { instagram_url: null, tiktok_url: null };
  }
  return {
    instagram_url: data?.instagram_url ?? null,
    tiktok_url: data?.tiktok_url ?? null,
  };
});

async function assertStaff(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: { role: string }) => ["admin", "manager"].includes(r.role));
  if (!ok) throw new Error("Доступ запрещён: требуется роль admin или manager");
}

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        instagram_url: URL_SCHEMA,
        tiktok_url: URL_SCHEMA,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        {
          id: true,
          instagram_url: data.instagram_url,
          tiktok_url: data.tiktok_url,
          updated_by: context.userId,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, instagram_url: data.instagram_url, tiktok_url: data.tiktok_url };
  });
