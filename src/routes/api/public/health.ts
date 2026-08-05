import { createFileRoute } from "@tanstack/react-router";

// Ключевые страницы, которые должны отдавать < 500.
// Сюда можно добавлять новые разделы — баннер в админке автоматически их подхватит.
const PATHS = ["/", "/zones", "/equipment", "/services", "/production", "/cases", "/blog", "/contacts"] as const;

type Check = { path: string; status: number; ms: number; ok: boolean; error?: string };

async function checkOne(base: URL, path: string, timeoutMs = 8000): Promise<Check> {
  const started = Date.now();
  const url = new URL(path, base);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { "user-agent": "lovable-health-check" },
      signal: ctl.signal,
      redirect: "manual",
    });
    return { path, status: res.status, ms: Date.now() - started, ok: res.status < 500 };
  } catch (error) {
    return {
      path,
      status: 0,
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(t);
  }
}

const CORS = {
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
} as const;

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const base = new URL("/", request.url);
        const checks = await Promise.all(PATHS.map((p) => checkOne(base, p)));
        const failed = checks.filter((c) => !c.ok);
        return Response.json(
          {
            ok: failed.length === 0,
            status: failed.length === 0 ? 200 : 500,
            ms: Date.now() - started,
            checkedUrl: base.toString(),
            checkedAt: new Date().toISOString(),
            checks,
            failedCount: failed.length,
          },
          { headers: CORS },
        );
      },
    },
  },
});

