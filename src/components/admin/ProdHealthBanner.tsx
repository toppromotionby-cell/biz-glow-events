import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, WifiOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getProdHealth } from "@/lib/prod-health.functions";
import { PROD_URL } from "@/lib/prod-health";

type Check = { path: string; status: number; ms: number; ok: boolean; error?: string };
type HealthData = {
  reachable?: boolean;
  ok: boolean;
  status: number;
  ms: number;
  checkedUrl?: string;
  checkedAt: string;
  error?: string;
  checks?: Check[];
  failedCount?: number;
};

const POLL_MS = 60_000;

export function ProdHealthBanner() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchHealth = useServerFn(getProdHealth);

  async function check() {
    setLoading(true);
    try {
      const json = (await fetchHealth({})) as unknown as HealthData;
      setData(json);
    } catch (err) {
      setData({
        reachable: false,
        ok: false,
        status: 0,
        ms: 0,
        checkedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;

  if (data.ok) {
    return (
      <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Прод работает · {data.checks?.length ?? 0} страниц · {data.ms}ms
        </span>
        <button onClick={check} disabled={loading} className="hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Проверить
        </button>
      </div>
    );
  }

  // Не удалось выполнить саму проверку — это не значит, что прод лежит.
  if (data.reachable === false) {
    return (
      <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-500" />
          Проверка недоступна{data.error ? ` · ${data.error}` : ""}
        </span>
        <button onClick={check} disabled={loading} className="hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Повторить
        </button>
      </div>
    );
  }


  if (data.ok) {
    return (
      <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Прод работает · {data.checks?.length ?? 0} страниц · {data.ms}ms
        </span>
        <button onClick={check} disabled={loading} className="hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Проверить
        </button>
      </div>
    );
  }

  const failed = (data.checks ?? []).filter((c) => !c.ok);

  return (
    <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-destructive">
              Прод недоступен{failed.length > 0 ? ` · ${failed.length} страниц с ошибкой` : ""}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Проверено {new Date(data.checkedAt).toLocaleTimeString("ru")}
              {data.error && ` · ${data.error}`}
            </div>
            {failed.length > 0 && (
              <ul className="mt-1.5 text-xs text-destructive/90 space-y-0.5">
                {failed.slice(0, 6).map((c) => (
                  <li key={c.path}>
                    <code className="font-mono">{c.path}</code> → {c.status || "ERR"}
                    {c.error ? ` · ${c.error}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={check}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border/60 hover:border-destructive/60 inline-flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Повторить
          </button>
          <a
            href={PROD_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2.5 py-1.5 rounded-md bg-destructive text-destructive-foreground inline-flex items-center gap-1"
          >
            Открыть <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
