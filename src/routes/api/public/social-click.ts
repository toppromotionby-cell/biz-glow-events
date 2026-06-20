// Публичный эндпоинт для записи кликов по соц.иконкам в marketing_logs.
// Вызывается из браузера через navigator.sendBeacon (см. trackSocialClick).
// Защита: строгая валидация payload + ограничение длины URL, никаких PII.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

const SCHEMA = z.object({
  network: z.enum(["instagram", "tiktok"]),
  placement: z.enum(["footer", "contacts_page", "floating_widget"]),
  url: z.string().trim().max(500).url().nullable().optional(),
});

export const Route = createFileRoute("/api/public/social-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const parsed = SCHEMA.safeParse(body);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }
        const { network, placement, url } = parsed.data;

        // Усечённый IP и UA — только для дедупликации/спам-защиты, без PII.
        const ipRaw = getRequestIP({ xForwardedFor: true }) ?? "";
        const ip = ipRaw.split(/[.:]/).slice(0, 3).join(".") || null;
        const ua = (getRequestHeader("user-agent") ?? "").slice(0, 200) || null;
        const referer = (getRequestHeader("referer") ?? "").slice(0, 300) || null;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("marketing_logs").insert({
            event: "social_click",
            payload: { network, placement, url: url ?? null, ip, ua, referer },
          });
        } catch {
          // Лог не должен ломать пользовательский переход.
        }

        // 204 — sendBeacon доволен.
        return new Response(null, { status: 204 });
      },
    },
  },
});
