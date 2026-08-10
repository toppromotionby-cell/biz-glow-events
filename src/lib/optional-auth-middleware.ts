// Мягкая авторизация: если валидный Bearer-токен есть — отдаёт userId, иначе null.
// Используется для публичных действий (гостевое оформление заказа).
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    let userId: string | null = null;

    try {
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization") ?? null;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (token && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase.auth.getClaims(token);
        if (!error && data?.claims?.sub) userId = String(data.claims.sub);
      }
    } catch {
      userId = null;
    }

    return next({ context: { userId } });
  },
);
