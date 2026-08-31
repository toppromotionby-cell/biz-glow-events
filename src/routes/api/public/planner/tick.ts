// Тик планера: импорт из Google, напоминания, утренний и вечерний дайджест.
// Вызывается pg_cron с заголовком x-cron-secret.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { admin } from "@/lib/calendar/store.server";
import { runTick } from "@/lib/calendar/agent.server";

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export const Route = createFileRoute("/api/public/planner/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) return Response.json({ error: "Cron secret not configured" }, { status: 503 });
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!safeEqual(provided, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const db = await admin();
          const result = await runTick(db);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[planner-tick] failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
        }
      },
    },
  },
});
