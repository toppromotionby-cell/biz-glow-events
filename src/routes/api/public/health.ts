import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const started = Date.now();
        const url = new URL("/", request.url);
        try {
          const res = await fetch(url.toString(), {
            headers: { "user-agent": "lovable-health-check" },
          });
          const ms = Date.now() - started;
          return Response.json(
            {
              ok: res.status < 500,
              status: res.status,
              ms,
              checkedUrl: url.toString(),
              checkedAt: new Date().toISOString(),
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          return Response.json(
            {
              ok: false,
              status: 0,
              ms: Date.now() - started,
              error: error instanceof Error ? error.message : String(error),
              checkedAt: new Date().toISOString(),
            },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
