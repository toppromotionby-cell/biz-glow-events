// Ежедневный прогон гигиены данных по расписанию (pg_cron). Публичный маршрут, защищён секретом.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export function hygieneHookSecret(apiKey: string): string {
  return createHash("sha256").update(`assistant-hygiene:${apiKey}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

export const Route = createFileRoute("/api/public/hooks/assistant-hygiene")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretSource = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.LOVABLE_API_KEY;
        if (!secretSource) return new Response("Not configured", { status: 503 });
        const provided = request.headers.get("x-hygiene-secret") ?? "";
        if (!safeEqual(provided, hygieneHookSecret(secretSource))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { getSettings, patchSettings } = await import("@/lib/assistant/store.server");
        const settings = await getSettings();
        if (!settings.hygiene_enabled) return Response.json({ ok: true, skipped: "disabled" });

        const { runHygiene, renderReport } = await import("@/lib/hygiene/engine.server");
        const report = await runHygiene();
        await patchSettings({ last_hygiene_at: new Date().toISOString() });

        if (settings.hygiene_notify && (report.needsReview > 0 || report.autoFixed > 0)) {
          const { notifyAdmins } = await import("@/lib/assistant/agent.server");
          await notifyAdmins(renderReport(report));
        }
        return Response.json({ ok: true, ...report });
      },
    },
  },
});
