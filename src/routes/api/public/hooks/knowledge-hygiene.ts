// Ежедневная уборка базы знаний: слияние дублей и удаление редко используемых записей.
// Вызывается pg_cron. Авторизация — server-only секрет CRON_SECRET в заголовке `x-cron-secret`.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/knowledge-hygiene")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runKnowledgeHygiene, syncCatalogKnowledge } = await import("@/lib/doc-knowledge.server");
          // Сначала подтягиваем свежий каталог сайта, потом чистим дубли.
          let synced = 0;
          try { synced = (await syncCatalogKnowledge()).synced; }
          catch (e) { console.error("[knowledge-hygiene] catalog sync failed", e); }
          const result = await runKnowledgeHygiene();
          return Response.json({ ok: true, synced, ...result });

        } catch (err) {
          console.error("[knowledge-hygiene] failed", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
