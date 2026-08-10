import { createServerFn } from "@tanstack/react-start";
import { PROD_URL } from "@/lib/prod-health";

/**
 * Проверка прода выполняется на сервере, чтобы не упираться в CORS
 * (браузерный fetch на другой домен падал с "Load failed" и давал ложную тревогу).
 */
export const getProdHealth = createServerFn({ method: "GET" }).handler(async () => {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(`${PROD_URL}/api/public/health`, {
      headers: { "user-agent": "lovable-admin-health" },
      signal: ctl.signal,
    });
    const json = (await res.json()) as Record<string, unknown>;
    return { reachable: true as const, ...json };
  } catch (error) {
    return {
      reachable: false as const,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
});
