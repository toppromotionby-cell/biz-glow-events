// Тик диджей-бота: рассылка очереди, сводка отклонений, дайджесты.
// Вызывается pg_cron с заголовком x-cron-secret.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { drainOutbox, flushRejectDigest, runDigests } from "@/lib/dj/telegram/notify.server";

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export const Route = createFileRoute("/api/public/dj/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) return Response.json({ error: "Cron secret not configured" }, { status: 503 });
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!safeEqual(provided, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const outbox = await drainOutbox();
          const rejects = await flushRejectDigest();
          const digests = await runDigests();
          return Response.json({ ok: true, outbox, rejects, digests });
        } catch (e) {
          console.error("[dj-tick] failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
        }
      },
    },
  },
});
