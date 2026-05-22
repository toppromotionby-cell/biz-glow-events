// Промокоды: валидация (публичная) и инкремент использования. Админский CRUD идёт через supabase из админки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeSchema = z.object({
  code: z.string().min(2).max(40),
  order_total: z.number().nonnegative().default(0),
});

export type PromoValidation = {
  valid: boolean;
  reason?: string;
  code?: string;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  description?: string | null;
};

export const validatePromo = createServerFn({ method: "POST" })
  .inputValidator((input) => CodeSchema.parse(input))
  .handler(async ({ data }): Promise<PromoValidation> => {
    const code = data.code.trim().toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) return { valid: false, reason: error.message };
    if (!row) return { valid: false, reason: "Промокод не найден" };
    if (!row.active) return { valid: false, reason: "Промокод неактивен" };
    const now = Date.now();
    if (row.valid_from && new Date(row.valid_from).getTime() > now) return { valid: false, reason: "Срок ещё не начался" };
    if (row.valid_to && new Date(row.valid_to).getTime() < now) return { valid: false, reason: "Срок действия истёк" };
    if (row.max_uses != null && row.used_count >= row.max_uses) return { valid: false, reason: "Лимит применений исчерпан" };
    if (Number(row.min_order_total) > 0 && data.order_total < Number(row.min_order_total)) {
      return { valid: false, reason: `Мин. сумма заказа: ${row.min_order_total} BYN` };
    }
    const value = Number(row.discount_value);
    const amount = row.discount_type === "percent"
      ? Math.round((data.order_total * value) / 100)
      : Math.min(value, data.order_total);
    return {
      valid: true,
      code: row.code,
      discount_type: row.discount_type as "percent" | "fixed",
      discount_value: value,
      discount_amount: amount,
      description: row.description,
    };
  });

export const redeemPromo = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string().min(2).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const code = data.code.trim().toUpperCase();
    const { data: row } = await supabaseAdmin.from("promo_codes").select("id, used_count").eq("code", code).maybeSingle();
    if (!row) return { ok: false };
    await supabaseAdmin.from("promo_codes").update({ used_count: (row.used_count ?? 0) + 1 }).eq("id", row.id);
    return { ok: true };
  });
